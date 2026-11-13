import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import ItineraryScreen from "./itinerary-edit-page";
import { AppDialogProvider } from "@/shared/ui/app-dialog";

const mockSetPlacesForDate = jest.fn();
const mockRemoveFromItinerary = jest.fn();
const mockReorderWithinDay = jest.fn();
const mockReplaceDayLodging = jest.fn();
const mockSearchPlaces = jest.fn();
const mockSavePlace = jest.fn();
const mockUpdateDayWithAi = jest.fn().mockResolvedValue(true);
let mockDates = ["2026-11-08"];
let mockItinerary = { items: [] as Record<string, unknown>[], unplaced: [] as Record<string, unknown>[] };
let mockPlaces: { id: string; name: string; address: string; tag: string; isPrimaryLodging?: boolean }[] = [{ id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" }];
let mockSearchParams: { aiGenerated?: string; tripId: string } = { tripId: "trip-1" };
let mockUpdatingDate: string | undefined;

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => mockSearchParams,
}));
jest.mock("@/domains/places/api/places.api", () => ({
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
  savePlace: (...args: unknown[]) => mockSavePlace(...args),
}));
jest.mock("./use-itinerary-edit", () => ({
  useItineraryEdit: () => ({
    dates: mockDates,
    error: undefined,
    itinerary: mockItinerary,
    moveToAdjacentDay: jest.fn(),
    places: mockPlaces,
    reload: jest.fn(),
    removeFromItinerary: mockRemoveFromItinerary,
    reorderWithinDay: mockReorderWithinDay,
    replaceDayLodging: mockReplaceDayLodging,
    save: jest.fn(),
    saving: false,
    setPlacesForDate: mockSetPlacesForDate,
    updateDayWithAi: mockUpdateDayWithAi,
    updatingDate: mockUpdatingDate,
  }),
}));

const renderItineraryScreen = () => render(<AppDialogProvider><ItineraryScreen /></AppDialogProvider>);

describe("ItineraryScreen day editing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDates = ["2026-11-08"];
    mockItinerary = { items: [], unplaced: [] };
    mockPlaces = [{ id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" }];
    mockSearchParams = { tripId: "trip-1" };
    mockUpdatingDate = undefined;
  });

  it("selects travel places from an individual day", async () => {
    const screen = await renderItineraryScreen();

    expect(screen.queryByText("미배치 장소")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("itinerary-add-places-2026-11-08"));
    expect(screen.getByText("Day 1 장소")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("itinerary-place-option-place-1"));
    await fireEvent.press(screen.getByTestId("itinerary-place-picker-apply"));

    expect(mockSetPlacesForDate).toHaveBeenCalledWith("2026-11-08", ["place-1"], expect.any(Array));
  });

  it("hides the unplaced summary and still allows selecting an unplaced place", async () => {
    mockItinerary = {
      items: [{ id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-09", position: 0 }],
      unplaced: [{ savedPlaceId: "place-2", placeName: "흰여울문화마을" }],
    };
    mockPlaces = [
      { id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" },
      { id: "place-2", name: "흰여울문화마을", address: "부산 영도구", tag: "attraction" },
    ];
    const screen = await renderItineraryScreen();

    expect(screen.queryByText("배치되지 않은 장소")).not.toBeOnTheScreen();
    expect(screen.queryByText("• 흰여울문화마을")).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("itinerary-add-places-2026-11-08"));
    expect(screen.queryByTestId("itinerary-place-option-place-1")).not.toBeOnTheScreen();
    expect(screen.getByTestId("itinerary-place-option-place-2")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("itinerary-place-tab-all"));
    await fireEvent.press(screen.getByTestId("itinerary-place-option-place-1"));
    await fireEvent.press(screen.getByTestId("itinerary-place-picker-apply"));

    expect(mockSetPlacesForDate).toHaveBeenCalledWith("2026-11-08", ["place-1"], expect.any(Array));
  });

  it("does not show a separate AI-generated confirmation area", async () => {
    mockSearchParams = { aiGenerated: "1", tripId: "trip-1" };

    const screen = await renderItineraryScreen();

    expect(screen.queryByText("AI 일정이 생성됐어요")).not.toBeOnTheScreen();
  });

  it("does not show the recent AI undo action", async () => {
    const screen = await renderItineraryScreen();

    expect(screen.queryByText("최근 AI 변경 한 번 되돌리기")).not.toBeOnTheScreen();
    expect(screen.queryByText("되돌릴 AI 변경이 없어요.")).not.toBeOnTheScreen();
  });

  it("searches, saves, and selects a place that was not registered", async () => {
    mockSearchPlaces.mockResolvedValue([{
      googlePlaceId: "google-new-1",
      name: "부산 타워",
      address: "부산 중구",
      primaryType: "tourist_attraction",
      latitude: 35.1,
      longitude: 129.0,
    }]);
    mockSavePlace.mockResolvedValue({
      status: "created",
      place: { id: "place-new-1", tripId: "trip-1", googlePlaceId: "google-new-1", name: "부산 타워", address: "부산 중구", tag: "attraction", preference: "want_to_visit", note: null, isPrimaryLodging: false },
    });
    const screen = await renderItineraryScreen();

    await fireEvent.press(screen.getByTestId("itinerary-add-places-2026-11-08"));
    await fireEvent.press(screen.getByTestId("itinerary-new-place-toggle"));
    await fireEvent.changeText(screen.getByTestId("itinerary-new-place-query"), "부산 타워");
    await fireEvent.press(screen.getByTestId("itinerary-new-place-search"));
    await waitFor(() => expect(screen.getByText("부산 타워")).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId("itinerary-new-place-google-new-1"));
    await fireEvent.press(screen.getByTestId("itinerary-place-picker-apply"));

    expect(mockSavePlace).toHaveBeenCalledWith("trip-1", expect.objectContaining({ googlePlaceId: "google-new-1" }));
    expect(mockSetPlacesForDate).toHaveBeenCalledWith(
      "2026-11-08",
      expect.arrayContaining(["place-new-1"]),
      expect.arrayContaining([expect.objectContaining({ id: "place-new-1" })]),
    );
  });

  it("shows one date at a time and removes a place with the simple X action", async () => {
    mockDates = ["2026-11-08", "2026-11-09"];
    mockItinerary = {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-08", position: 0 },
        { id: "item-2", savedPlaceId: "place-2", placeName: "흰여울문화마을", date: "2026-11-09", position: 0 },
      ],
      unplaced: [],
    };
    const screen = await renderItineraryScreen();

    expect(screen.getByText("감천문화마을")).toBeOnTheScreen();
    expect(screen.queryByText("흰여울문화마을")).not.toBeOnTheScreen();
    expect(screen.queryByText("일정 잠금")).not.toBeOnTheScreen();
    expect(screen.queryByText("제외")).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText("감천문화마을 일정에서 제외"));
    expect(mockRemoveFromItinerary).toHaveBeenCalledWith("item-1");

    await fireEvent.press(screen.getByTestId("itinerary-date-tab-2026-11-09"));
    expect(screen.queryByText("감천문화마을")).not.toBeOnTheScreen();
    expect(screen.getByText("흰여울문화마을")).toBeOnTheScreen();
  });

  it("shows the arrival time under the place name", async () => {
    mockItinerary = {
      items: [{ id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-08", position: 0, scheduledTime: "10:30", source: "manual" }],
      unplaced: [],
    };

    const screen = await renderItineraryScreen();

    expect(screen.getByText("감천문화마을")).toBeOnTheScreen();
    expect(screen.getByText("도착 10:30")).toBeOnTheScreen();
    expect(screen.queryByText(/소요/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/상세 설명/)).not.toBeOnTheScreen();
    expect(screen.getByTestId("mock-sortable").props.testUseFlatList).toBe(false);
  });

  it("updates only the selected day after confirmation", async () => {
    const screen = await renderItineraryScreen();

    await fireEvent.press(screen.getByTestId("itinerary-ai-update-2026-11-08"));

    expect(screen.getByText("Day 1 일정을 업데이트할까요?")).toBeOnTheScreen();
    expect(screen.getByText(/다른 날짜 일정은 변경하지 않아요/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("업데이트"));
    expect(mockUpdateDayWithAi).toHaveBeenCalledWith("2026-11-08");
  });

  it("blocks the itinerary with a full-screen loading view while a day is updating", async () => {
    mockUpdatingDate = "2026-11-08";

    const screen = await renderItineraryScreen();

    expect(screen.getByTestId("ai-plan-loading")).toBeOnTheScreen();
    expect(screen.getByText("Day 1 장소를 살펴보고 있어요")).toBeOnTheScreen();
    expect(screen.getByLabelText("AI가 Day 1 일정을 업데이트하는 중")).toBeOnTheScreen();
  });

  it("shows travel time on the connector between itinerary cards", async () => {
    mockItinerary = {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-08", position: 0 },
        { id: "item-2", savedPlaceId: "place-2", placeName: "흰여울문화마을", date: "2026-11-08", position: 1, travelDurationMinutes: 18 },
      ],
      unplaced: [],
    };

    const screen = await renderItineraryScreen();

    expect(screen.getByText("이동 약 18분")).toBeOnTheScreen();
    expect(screen.getByLabelText("이동 시간 약 18분")).toBeOnTheScreen();
  });

  it("does not show transit or external directions actions between visits", async () => {
    mockItinerary = {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-08", position: 0 },
        { id: "item-2", savedPlaceId: "place-2", placeName: "흰여울문화마을", date: "2026-11-08", position: 1 },
      ],
      unplaced: [],
    };

    const screen = await renderItineraryScreen();

    expect(screen.queryByText("다음 장소까지 대중교통")).not.toBeOnTheScreen();
    expect(screen.queryByText("Google Maps에서 길 찾기")).not.toBeOnTheScreen();
  });

  it("opens the lodging editor and applies a saved lodging to the selected endpoint", async () => {
    mockDates = ["2026-11-08", "2026-11-09", "2026-11-10"];
    mockPlaces = [
      { id: "lodging-1", name: "기본 호텔", address: "서울 중구", tag: "lodging", isPrimaryLodging: true },
      { id: "lodging-2", name: "새 호텔", address: "서울 종로구", tag: "lodging", isPrimaryLodging: false },
      { id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction", isPrimaryLodging: false },
    ];
    mockItinerary = {
      items: [
        { id: "start", savedPlaceId: "lodging-1", placeName: "기본 호텔", date: "2026-11-09", position: 0 },
        { id: "visit", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-09", position: 1 },
        { id: "end", savedPlaceId: "lodging-1", placeName: "기본 호텔", date: "2026-11-09", position: 2 },
      ],
      unplaced: [],
    };
    const screen = await renderItineraryScreen();

    await fireEvent.press(screen.getByTestId("itinerary-date-tab-2026-11-09"));
    await fireEvent.press(screen.getByLabelText("기본 호텔 시작 숙소 수정"));
    expect(screen.getByText("Day 2 시작 숙소")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("lodging-endpoint-option-lodging-2"));

    expect(mockReplaceDayLodging).toHaveBeenCalledWith(
      "2026-11-09",
      "start",
      expect.objectContaining({ id: "lodging-2" }),
      expect.any(Array),
    );
  });

  it("commits the new order after the drop animation settles", async () => {
    jest.useFakeTimers();
    mockItinerary = {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-08", position: 0 },
        { id: "item-2", savedPlaceId: "place-2", placeName: "흰여울문화마을", date: "2026-11-08", position: 1 },
      ],
      unplaced: [],
    };
    const screen = await renderItineraryScreen();
    const item = screen.getByTestId("sortable-item-item-1");

    await act(() => item.props.onDragStart("item-1", 0));
    await act(() => item.props.onDrop("item-1", 1));
    expect(mockReorderWithinDay).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(310));
    expect(mockReorderWithinDay).toHaveBeenCalledWith("item-1", 1);
    jest.useRealTimers();
  });
});

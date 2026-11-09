import { fireEvent, render } from "@testing-library/react-native";

import ItineraryScreen from "./itinerary-edit-page";

const mockUpdateDaySetting = jest.fn();
const mockSaveDaySettings = jest.fn();
const mockSetPlacesForDate = jest.fn();
const mockRemoveFromItinerary = jest.fn();
let mockDates = ["2026-11-08"];
let mockItinerary = { items: [] as Record<string, unknown>[], unplaced: [] as Record<string, unknown>[] };
let mockPlaces = [{ id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" }];

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-itinerary-edit", () => ({
  useItineraryEdit: () => ({
    dates: mockDates,
    error: undefined,
    itinerary: mockItinerary,
    loadTransitRoute: jest.fn(),
    moveToAdjacentDay: jest.fn(),
    places: mockPlaces,
    reload: jest.fn(),
    removeFromItinerary: mockRemoveFromItinerary,
    reorderWithinDay: jest.fn(),
    routes: {},
    save: jest.fn(),
    saving: false,
    setPlacesForDate: mockSetPlacesForDate,
    undoAiChange: jest.fn(),
    undoing: false,
  }),
}));
jest.mock("./use-itinerary-day-settings", () => ({
  useItineraryDaySettings: () => ({
    loading: false,
    lodgings: [{ id: "lodging-1", name: "부산 바다 호텔", tag: "lodging" }],
    message: undefined,
    reload: jest.fn(),
    save: mockSaveDaySettings,
    saving: false,
    settings: [{
      date: "2026-11-08",
      endPlaceId: null,
      endPlaceName: null,
      endTime: "21:00",
      startPlaceId: null,
      startPlaceName: null,
      startTime: "09:00",
    }],
    update: mockUpdateDaySetting,
  }),
}));

describe("ItineraryScreen day lodging settings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDates = ["2026-11-08"];
    mockItinerary = { items: [], unplaced: [] };
    mockPlaces = [{ id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" }];
  });

  it("changes and saves a lodging for an individual date", async () => {
    const screen = await render(<ItineraryScreen />);

    await fireEvent.press(screen.getAllByText("부산 바다 호텔")[0]);
    expect(mockUpdateDaySetting).toHaveBeenCalledWith("2026-11-08", {
      startPlaceId: "lodging-1",
    });

    await fireEvent.press(screen.getByTestId("itinerary-day-settings-save"));
    expect(mockSaveDaySettings).toHaveBeenCalledTimes(1);
  });

  it("selects travel places from an individual day", async () => {
    const screen = await render(<ItineraryScreen />);

    expect(screen.queryByText("미배치 장소")).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("itinerary-add-places-2026-11-08"));
    expect(screen.getByText("Day 1 장소")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("itinerary-place-option-place-1"));
    await fireEvent.press(screen.getByTestId("itinerary-place-picker-apply"));

    expect(mockSetPlacesForDate).toHaveBeenCalledWith("2026-11-08", ["place-1"]);
  });

  it("shows unplaced places by default and allows a place from another day in the all tab", async () => {
    mockItinerary = {
      items: [{ id: "item-1", savedPlaceId: "place-1", placeName: "감천문화마을", date: "2026-11-09", position: 0 }],
      unplaced: [{ savedPlaceId: "place-2", placeName: "흰여울문화마을" }],
    };
    mockPlaces = [
      { id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" },
      { id: "place-2", name: "흰여울문화마을", address: "부산 영도구", tag: "attraction" },
    ];
    const screen = await render(<ItineraryScreen />);

    await fireEvent.press(screen.getByTestId("itinerary-add-places-2026-11-08"));
    expect(screen.queryByTestId("itinerary-place-option-place-1")).not.toBeOnTheScreen();
    expect(screen.getByTestId("itinerary-place-option-place-2")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("itinerary-place-tab-all"));
    await fireEvent.press(screen.getByTestId("itinerary-place-option-place-1"));
    await fireEvent.press(screen.getByTestId("itinerary-place-picker-apply"));

    expect(mockSetPlacesForDate).toHaveBeenCalledWith("2026-11-08", ["place-1"]);
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
    const screen = await render(<ItineraryScreen />);

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
});

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { AppDialogProvider } from "@/shared/ui/app-dialog";
import CompleteTripScreen from "./complete-trip-page";

const mockComplete = jest.fn();
const mockAddPhoto = jest.fn();
let mockTrip: { archivedAt?: string | null };
let mockItinerary: { items: Record<string, unknown>[] };
let mockPhotos: Record<string, unknown>[];

jest.mock("expo-router", () => ({
  usePreventRemove: () => jest.fn(),
  router: { dismissTo: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-complete-trip", () => ({
  useCompleteTrip: () => ({
    accessToken: "access-token",
    addPhoto: mockAddPhoto,
    complete: mockComplete,
    error: undefined,
    itinerary: mockItinerary,
    photos: mockPhotos,
    retry: jest.fn(),
    saving: false,
    trip: mockTrip,
    uploadingItemId: undefined,
  }),
}));

describe("CompleteTripScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComplete.mockResolvedValue(true);
    mockTrip = { archivedAt: null };
    mockPhotos = [];
    mockItinerary = {
      items: [
        { id: "boundary:start_point:trip-1", savedPlaceId: "trip-1", placeName: "인천공항", boundaryType: "start_point" },
        { id: "item-1", savedPlaceId: "place-1", placeName: "서울숲" },
        { id: "item-2", savedPlaceId: "place-2", placeName: "한강공원" },
        { id: "item-3", savedPlaceId: "place-1", placeName: "서울숲" },
      ],
    };
  });

  it("shows one representative photo above the rating and disables additional uploads for that place", async () => {
    mockPhotos = [{
      id: "photo-1",
      itineraryItemId: "item-3",
      thumbnailUrl: "https://images.example.com/photo-1.jpg",
      optimizedUrl: null,
      originalUrl: null,
      status: "ready",
    }];
    const screen = await render(<CompleteTripScreen />);

    expect(screen.getByLabelText("서울숲 대표 사진")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "사진 등록 완료" })).toBeDisabled();
    expect(screen.getAllByText("사진 추가")).toHaveLength(1);
    expect(mockAddPhoto).not.toHaveBeenCalled();
  });

  it("submits rated and not-visited places without status tabs", async () => {
    const screen = await render(<CompleteTripScreen />);

    expect(screen.queryByText("인천공항")).toBeNull();
    expect(screen.getAllByText("서울숲")).toHaveLength(1);
    await fireEvent.press(screen.getAllByLabelText("5점")[0]);
    await fireEvent.press(screen.getAllByText("미방문으로 설정")[1]);

    expect(screen.getAllByLabelText("5점")).toHaveLength(1);
    expect(screen.getAllByPlaceholderText("이 장소의 기억을 남겨 보세요")).toHaveLength(1);
    expect(screen.getAllByText("사진 추가")).toHaveLength(1);
    await fireEvent.press(screen.getByTestId("complete-trip-submit"));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith([
      { itineraryItemId: "item-1", notVisited: false, rating: 5, review: undefined },
      { itineraryItemId: "item-3", notVisited: false, rating: 5, review: undefined },
      { itineraryItemId: "item-2", notVisited: true, rating: undefined, review: undefined },
    ]));
    expect(router.dismissTo).toHaveBeenCalledWith("/trips/trip-1/summary");
  });

  it("archives every visit as unrated when the user skips review", async () => {
    const screen = await render(<CompleteTripScreen />);

    await fireEvent.press(screen.getByTestId("complete-trip-without-review"));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith([]));
    expect(router.dismissTo).toHaveBeenCalledWith("/trips/trip-1/summary");
  });

  it("loads and preserves an archived trip's existing records while editing", async () => {
    mockTrip = { archivedAt: "2026-11-14T00:00:00.000Z" };
    mockItinerary = {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "서울숲", visitStatus: "rated", rating: 4, review: "좋았어요" },
        { id: "item-2", savedPlaceId: "place-2", placeName: "한강공원", visitStatus: "not_visited", rating: null, review: null },
      ],
    };
    const screen = await render(<CompleteTripScreen />);

    expect(screen.getByText("여행의 기억을 다듬어요.")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("좋았어요")).toBeOnTheScreen();
    expect(screen.getByText("미방문")).toBeOnTheScreen();
    expect(screen.queryByTestId("complete-trip-without-review")).toBeNull();
    await fireEvent.press(screen.getByTestId("complete-trip-submit"));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith([
      { itineraryItemId: "item-1", notVisited: false, rating: 4, review: "좋았어요" },
      { itineraryItemId: "item-2", notVisited: true, rating: undefined, review: undefined },
    ]));
  });
  it("keeps a written review until the user resolves the navigation warning", async () => {
    const screen = await render(<AppDialogProvider><CompleteTripScreen /></AppDialogProvider>);
    await fireEvent.changeText(screen.getAllByPlaceholderText("이 장소의 기억을 남겨 보세요")[0], "기억하고 싶은 산책");
    await fireEvent.press(screen.getByRole("tab", { name: "장소" }));
    expect(screen.getByText("작성 중인 기록이 있어요")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "계속 작성" }));
    expect(screen.getByDisplayValue("기억하고 싶은 산책")).toBeOnTheScreen();
    expect(mockComplete).not.toHaveBeenCalled();
  });

});

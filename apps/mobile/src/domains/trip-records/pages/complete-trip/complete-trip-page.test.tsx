import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import CompleteTripScreen from "./complete-trip-page";

const mockComplete = jest.fn();
let mockTrip: { archivedAt?: string | null };
let mockItinerary: { items: Record<string, unknown>[] };

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-complete-trip", () => ({
  useCompleteTrip: () => ({
    addPhoto: jest.fn(),
    complete: mockComplete,
    error: undefined,
    itinerary: mockItinerary,
    photos: [],
    reload: jest.fn(),
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
    mockItinerary = {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "서울숲" },
        { id: "item-2", savedPlaceId: "place-2", placeName: "한강공원" },
        { id: "item-3", savedPlaceId: "place-1", placeName: "서울숲" },
      ],
    };
  });

  it("submits rated and not-visited places without status tabs", async () => {
    const screen = await render(<CompleteTripScreen />);

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
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1/summary");
  });

  it("archives every visit as unrated when the user skips review", async () => {
    const screen = await render(<CompleteTripScreen />);

    await fireEvent.press(screen.getByTestId("complete-trip-without-review"));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith([]));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1/summary");
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

    expect(screen.getByText("여행 기록을 수정해요")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("좋았어요")).toBeOnTheScreen();
    expect(screen.getByText("미방문")).toBeOnTheScreen();
    expect(screen.queryByTestId("complete-trip-without-review")).toBeNull();
    await fireEvent.press(screen.getByTestId("complete-trip-submit"));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith([
      { itineraryItemId: "item-1", notVisited: false, rating: 4, review: "좋았어요" },
      { itineraryItemId: "item-2", notVisited: true, rating: undefined, review: undefined },
    ]));
  });
});

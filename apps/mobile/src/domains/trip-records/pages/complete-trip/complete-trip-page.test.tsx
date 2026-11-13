import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import CompleteTripScreen from "./complete-trip-page";

const mockComplete = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-complete-trip", () => ({
  useCompleteTrip: () => ({
    addPhoto: jest.fn(),
    complete: mockComplete,
    error: undefined,
    itinerary: {
      items: [
        { id: "item-1", savedPlaceId: "place-1", placeName: "서울숲" },
        { id: "item-2", savedPlaceId: "place-2", placeName: "한강공원" },
        { id: "item-3", savedPlaceId: "place-1", placeName: "서울숲" },
      ],
    },
    photos: [],
    reload: jest.fn(),
    saving: false,
    uploadingItemId: undefined,
  }),
}));

describe("CompleteTripScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComplete.mockResolvedValue(true);
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
});

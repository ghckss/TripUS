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
        { id: "item-1", placeName: "서울숲" },
        { id: "item-2", placeName: "한강공원" },
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

    await fireEvent.press(screen.getAllByLabelText("5점")[0]);
    await fireEvent.press(screen.getAllByText("미방문으로 설정")[1]);
    await fireEvent.press(screen.getByTestId("complete-trip-submit"));

    await waitFor(() => expect(mockComplete).toHaveBeenCalledWith([
      { itineraryItemId: "item-1", notVisited: false, rating: 5, review: undefined },
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

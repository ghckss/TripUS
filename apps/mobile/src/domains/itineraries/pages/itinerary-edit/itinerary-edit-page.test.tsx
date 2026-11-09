import { fireEvent, render } from "@testing-library/react-native";

import ItineraryScreen from "./itinerary-edit-page";

const mockUpdateDaySetting = jest.fn();
const mockSaveDaySettings = jest.fn();
const mockSetPlacesForDate = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn(),
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("./use-itinerary-edit", () => ({
  useItineraryEdit: () => ({
    dates: ["2026-11-08"],
    error: undefined,
    itinerary: { items: [], unplaced: [] },
    loadTransitRoute: jest.fn(),
    moveToAdjacentDay: jest.fn(),
    moveWithinDay: jest.fn(),
    places: [{ id: "place-1", name: "감천문화마을", address: "부산 사하구", tag: "attraction" }],
    reload: jest.fn(),
    removeFromItinerary: jest.fn(),
    routes: {},
    save: jest.fn(),
    saving: false,
    setPlacesForDate: mockSetPlacesForDate,
    toggleLocked: jest.fn(),
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
});

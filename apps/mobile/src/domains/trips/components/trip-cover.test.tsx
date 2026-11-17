import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { getTripCover, type Trip } from "../api/trips.api";
import { TripCover, tripCoverVariant } from "./trip-cover";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("../api/trips.api", () => ({ getTripCover: jest.fn() }));
const mockCover = jest.mocked(getTripCover);
const trip = { id: "a", destination: "프랑스", startDate: "2026-12-01", endDate: "2026-12-07", regions: [{ name: "파리", googlePlaceId: "paris" }] } as Trip;

describe("TripCover", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the city photo without an attribution row after the image loads", async () => {
    mockCover.mockResolvedValue({ imageUrl: "https://example.com/paris.jpg", googleMapsUri: "https://maps.google.com/paris", authorNames: ["Photographer"] });
    const screen = await render(<TripCover trip={trip} />);
    const photo = await screen.findByTestId("trip-cover-photo-a");
    await fireEvent(photo, "load", { nativeEvent: {} });
    expect(screen.queryByText("Google Maps · Photographer ↗")).toBeNull();
    expect(screen.getByText("파리")).toBeOnTheScreen();
    expect(screen.getByText("2026-12-01 — 2026-12-07")).toBeOnTheScreen();
    await fireEvent(photo, "error", { nativeEvent: { error: "unavailable" } });
    expect(screen.queryByTestId("trip-cover-photo-a")).toBeNull();
    expect(screen.getByTestId("trip-cover-a")).toBeOnTheScreen();
    expect(screen.queryByText("Google Maps · Photographer ↗")).toBeNull();
  });

  it("keeps the fallback usable when cover fetching fails", async () => {
    mockCover.mockRejectedValue(new Error("offline"));
    const screen = await render(<TripCover trip={trip} />);
    await waitFor(() => expect(mockCover).toHaveBeenCalledWith("a"));
    expect(screen.getByText("파리")).toBeOnTheScreen();
    expect(screen.queryByTestId("trip-cover-photo-a")).toBeNull();
  });

  it("assigns stable illustration and color combinations by trip identity", () => {
    expect(tripCoverVariant("a")).toEqual(tripCoverVariant("a"));
    expect(tripCoverVariant("a")).not.toEqual(tripCoverVariant("b"));
  });
});

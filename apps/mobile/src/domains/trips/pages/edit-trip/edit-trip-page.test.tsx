import { fireEvent, render, waitFor } from "@testing-library/react-native";
import EditTripScreen from "./edit-trip-page";

const mockGetTrip = jest.fn();
const mockUpdateTrip = jest.fn().mockResolvedValue({});
const airport = { googlePlaceId: "airport", name: "김포공항", address: "서울", latitude: 37, longitude: 127, time: "09:30" };
const station = { googlePlaceId: "station", name: "서울역", address: "서울", latitude: 37.5, longitude: 127, time: null };
const trip = { title: "서울 여행", destination: "한국", timezone: "Asia/Seoul", regions: [{ googlePlaceId: "seoul", name: "서울", address: "서울", latitude: 37, longitude: 127 }], startDate: "2026-11-15", endDate: "2026-11-17", startPoint: null, endPoint: null };
jest.mock("expo-router", () => ({ usePreventRemove: () => jest.fn(), router: { back: jest.fn() }, useLocalSearchParams: () => ({ tripId: "trip-1" }) }));
jest.mock("@/domains/trips/api/trips.api", () => ({ getTrip: (...args: unknown[]) => mockGetTrip(...args), updateTrip: (...args: unknown[]) => mockUpdateTrip(...args) }));
jest.mock("@/domains/places/api/lodgings.api", () => ({ getPrimaryLodging: jest.fn().mockResolvedValue(null), savePrimaryLodging: jest.fn().mockResolvedValue({}) }));
jest.mock("@/domains/places/api/places.api", () => ({ searchPlacesByDestination: jest.fn().mockResolvedValue([{ googlePlaceId: "station", name: "서울역", address: "서울", latitude: 37.5, longitude: 127 }]) }));
beforeEach(() => { jest.clearAllMocks(); mockGetTrip.mockResolvedValue(trip); });

it("saves the selected range and mirrors the first end place in an empty existing trip", async () => {
  const screen = await render(<EditTripScreen />);
  await screen.findByDisplayValue("서울 여행");
  await fireEvent.press(screen.getByTestId("edit-trip-period"));
  await fireEvent.press(screen.getByTestId("edit-trip-period-day-2026-11-20"));
  await fireEvent.press(screen.getByTestId("edit-trip-period-day-2026-11-22"));
  await fireEvent.press(screen.getByTestId("edit-trip-period-apply"));
  await fireEvent.changeText(screen.getByTestId("trip-end-point-search-input"), "서울역");
  await fireEvent.press(screen.getByTestId("trip-end-point-search-button"));
  await fireEvent.press(await screen.findByTestId("trip-end-point-result-station"));
  expect(screen.queryByTestId("trip-start-point-search-input")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "변경사항 저장" }));
  await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledWith("trip-1", expect.objectContaining({ startDate: "2026-11-20", endDate: "2026-11-22", startPoint: station, endPoint: station })));
});
it("keeps a saved partial boundary unchanged while loading and filling the missing place", async () => {
  mockGetTrip.mockResolvedValue({ ...trip, startPoint: airport });
  const screen = await render(<EditTripScreen />);
  await screen.findByDisplayValue("서울 여행");
  expect(screen.getByTestId("trip-start-point-edit")).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId("trip-end-point-search-input"), "서울역");
  await fireEvent.press(screen.getByTestId("trip-end-point-search-button"));
  await fireEvent.press(await screen.findByTestId("trip-end-point-result-station"));
  await fireEvent.press(screen.getByRole("button", { name: "변경사항 저장" }));
  await waitFor(() => expect(mockUpdateTrip).toHaveBeenCalledWith("trip-1", expect.objectContaining({ startPoint: airport, endPoint: station })));
});

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import NewTripScreen from "./new-trip-page";

const mockCreateTrip = jest.fn();
const mockSavePrimaryLodging = jest.fn();
const mockSearchPlacesByDestination = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useFocusEffect: jest.fn(),
}));
jest.mock("@/domains/entitlements/api/entitlements.api", () => ({
  getEntitlements: jest.fn().mockResolvedValue({ tier: "free", tripLimit: 1, tripCount: 0, aiGenerationLimit: 1, aiGenerationsUsed: 0 }),
}));
jest.mock("@/domains/trips/api/trips.api", () => ({
  createTrip: (...args: unknown[]) => mockCreateTrip(...args),
}));
jest.mock("@/domains/places/api/lodgings.api", () => ({
  savePrimaryLodging: (...args: unknown[]) => mockSavePrimaryLodging(...args),
}));
jest.mock("@/domains/places/api/places.api", () => ({
  searchPlacesByDestination: (...args: unknown[]) => mockSearchPlacesByDestination(...args),
}));

function localDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

describe("NewTripScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("searches a country and applies its timezone when creating a trip", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "일본 단풍 여행");
    await fireEvent.press(screen.getByTestId("new-trip-destination"));
    await fireEvent.changeText(screen.getByTestId("country-search-input"), "Japan");
    await fireEvent.press(screen.getByTestId("country-option-JP"));
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    await waitFor(() => expect(mockCreateTrip).toHaveBeenCalledWith({
      destination: "일본",
      endDate: localDate(2),
      startDate: localDate(0),
      timezone: "Asia/Tokyo",
      title: "일본 단풍 여행",
    }));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1");
  });

  it("saves a lodging selected from map search results", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    mockSavePrimaryLodging.mockResolvedValue({ id: "lodging-1" });
    mockSearchPlacesByDestination.mockResolvedValue([{
      googlePlaceId: "google-hotel-1",
      name: "서울 지도 호텔",
      address: "서울특별시 중구",
    }]);
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "서울 여행");
    await fireEvent.changeText(screen.getByTestId("lodging-search-input"), "지도 호텔");
    await fireEvent.press(screen.getByText("검색"));
    await fireEvent.press(await screen.findByLabelText("서울 지도 호텔 숙소 선택"));
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    await waitFor(() => expect(mockSavePrimaryLodging).toHaveBeenCalledWith("trip-1", {
      address: "서울특별시 중구",
      googlePlaceId: "google-hotel-1",
      name: "서울 지도 호텔",
    }));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1");
  });

  it("keeps the form visible when creation fails", async () => {
    mockCreateTrip.mockRejectedValue(new Error("서버에 연결하지 못했어요."));
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "실패 테스트 여행");
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    expect(await screen.findByText("서버에 연결하지 못했어요.")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { Platform } from "react-native";

import NewTripScreen from "./new-trip-page";

const mockCreateTrip = jest.fn();
const mockSavePrimaryLodging = jest.fn();
const mockSearchPlacesByDestination = jest.fn();
const mockSearchCities = jest.fn();

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
  searchCities: (country: string, countryCode: string, query: string) => {
    mockSearchCities(country, countryCode, query);
    return mockSearchPlacesByDestination(country, query);
  },
}));

function localDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function selectTime(screen: Awaited<ReturnType<typeof render>>, testID: string, hours: number, minutes: number) {
  const selected = new Date();
  selected.setHours(hours, minutes, 0, 0);
  await fireEvent.press(screen.getByTestId(testID));
  await fireEvent(screen.getByTestId(`${testID}-picker`), "onChange", {
    nativeEvent: { timestamp: selected.getTime(), utcOffset: 0 },
  });
  if (Platform.OS === "ios") await fireEvent.press(screen.getByTestId(`${testID}-confirm`));
}

describe("NewTripScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("searches a country and applies its timezone when creating a trip", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    mockSearchPlacesByDestination.mockResolvedValue([{
      googlePlaceId: "region-tokyo", name: "도쿄", address: "일본 도쿄도", latitude: 35.6762, longitude: 139.6503,
    }]);
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "일본 단풍 여행");
    await fireEvent.press(screen.getByTestId("new-trip-destination"));
    await fireEvent.changeText(screen.getByTestId("country-search-input"), "Japan");
    await fireEvent.press(screen.getByTestId("country-option-JP"));
    await fireEvent.press(screen.getByTestId("region-dropdown-open"));
    await fireEvent.changeText(screen.getByTestId("region-search-input"), "도쿄");
    await fireEvent.press(screen.getByTestId("region-search-button"));
    await fireEvent.press(await screen.findByTestId("region-result-region-tokyo"));
    await fireEvent.press(screen.getByTestId("region-selection-apply"));
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    expect(mockSearchCities).toHaveBeenCalledWith("일본", "JP", expect.any(String));
    await waitFor(() => expect(mockCreateTrip).toHaveBeenCalledWith({
      destination: "일본",
      endDate: localDate(2),
      endPoint: null,
      regions: [{
        googlePlaceId: "region-tokyo", name: "도쿄", address: "일본 도쿄도", latitude: 35.6762, longitude: 139.6503,
      }],
      startDate: localDate(0),
      startPoint: null,
      timezone: "Asia/Tokyo",
      title: "일본 단풍 여행",
    }));
    expect(router.replace).toHaveBeenCalledWith("/trips/trip-1");
  });

  it("adds multiple cities and regions to a trip", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    mockSearchPlacesByDestination.mockImplementation((_destination: string, query: string) => Promise.resolve(query === "서울" ? [{
      googlePlaceId: "region-seoul",
      name: "서울",
      address: "대한민국 서울특별시",
      latitude: 37.5665,
      longitude: 126.978,
    }] : [{
      googlePlaceId: "region-inje",
      name: "인제군",
      address: "대한민국 강원특별자치도 인제군",
      latitude: 38.0695,
      longitude: 128.1707,
    }]));
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "서울과 인제 여행");
    await fireEvent.press(screen.getByTestId("region-dropdown-open"));
    await fireEvent.changeText(screen.getByTestId("region-search-input"), "서울");
    await fireEvent.press(screen.getByTestId("region-search-button"));
    await fireEvent.press(await screen.findByTestId("region-result-region-seoul"));
    await fireEvent.changeText(screen.getByTestId("region-search-input"), "인제");
    await fireEvent.press(screen.getByTestId("region-search-button"));
    await fireEvent.press(await screen.findByTestId("region-result-region-inje"));
    await fireEvent.press(screen.getByTestId("region-selection-apply"));
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    await waitFor(() => expect(mockCreateTrip).toHaveBeenCalledWith(expect.objectContaining({
      regions: [
        {
          googlePlaceId: "region-seoul", name: "서울", address: "대한민국 서울특별시",
          latitude: 37.5665, longitude: 126.978,
        },
        {
          googlePlaceId: "region-inje", name: "인제군", address: "대한민국 강원특별자치도 인제군",
          latitude: 38.0695, longitude: 128.1707,
        },
      ],
    })));
  });

  it("saves optional trip start and end points with their times", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    mockSearchPlacesByDestination.mockImplementation((_destination: string, query: string) => Promise.resolve({
      "서울": [{ googlePlaceId: "region-seoul", name: "서울", address: "대한민국 서울특별시", latitude: 37.5665, longitude: 126.978 }],
      "김포공항": [{ googlePlaceId: "airport-gimpo", name: "김포국제공항", address: "서울 강서구", latitude: 37.5583, longitude: 126.7906 }],
      "서울역": [{ googlePlaceId: "station-seoul", name: "서울역", address: "서울 용산구", latitude: 37.5547, longitude: 126.9707 }],
    }[query] ?? []));
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "서울 여행");
    await fireEvent.press(screen.getByTestId("region-dropdown-open"));
    await fireEvent.changeText(screen.getByTestId("region-search-input"), "서울");
    await fireEvent.press(screen.getByTestId("region-search-button"));
    await fireEvent.press(await screen.findByTestId("region-result-region-seoul"));
    await fireEvent.press(screen.getByTestId("region-selection-apply"));

    await fireEvent.changeText(screen.getByTestId("trip-start-point-search-input"), "김포공항");
    await fireEvent.press(screen.getByTestId("trip-start-point-search-button"));
    await fireEvent.press(await screen.findByTestId("trip-start-point-result-airport-gimpo"));
    expect(screen.queryByText("서울 강서구")).toBeNull();
    expect(screen.queryByTestId("trip-start-point-search-input")).toBeNull();
    await fireEvent.press(screen.getByTestId("trip-start-point-edit"));
    expect(screen.getByTestId("trip-start-point-search-input")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("trip-start-point-edit"));
    expect(screen.queryByTestId("trip-start-point-search-input")).toBeNull();
    await selectTime(screen, "trip-start-point-time", 10, 30);

    await fireEvent.changeText(screen.getByTestId("trip-end-point-search-input"), "서울역");
    await fireEvent.press(screen.getByTestId("trip-end-point-search-button"));
    await fireEvent.press(await screen.findByTestId("trip-end-point-result-station-seoul"));
    await selectTime(screen, "trip-end-point-time", 18, 0);
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    await waitFor(() => expect(mockCreateTrip).toHaveBeenCalledWith(expect.objectContaining({
      startPoint: expect.objectContaining({ googlePlaceId: "airport-gimpo", name: "김포국제공항", time: "10:30" }),
      endPoint: expect.objectContaining({ googlePlaceId: "station-seoul", name: "서울역", time: "18:00" }),
    })));
  });

  it("saves a lodging selected from map search results", async () => {
    mockCreateTrip.mockResolvedValue({ id: "trip-1" });
    mockSavePrimaryLodging.mockResolvedValue({ id: "lodging-1" });
    mockSearchPlacesByDestination.mockImplementation((_destination: string, query: string) => Promise.resolve(query === "서울" ? [{
      googlePlaceId: "region-seoul", name: "서울", address: "대한민국 서울특별시", latitude: 37.5665, longitude: 126.978,
    }] : [{ googlePlaceId: "google-hotel-1", name: "서울 지도 호텔", address: "서울특별시 중구" }]));
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "서울 여행");
    await fireEvent.press(screen.getByTestId("region-dropdown-open"));
    await fireEvent.changeText(screen.getByTestId("region-search-input"), "서울");
    await fireEvent.press(screen.getByTestId("region-search-button"));
    await fireEvent.press(await screen.findByTestId("region-result-region-seoul"));
    await fireEvent.press(screen.getByTestId("region-selection-apply"));
    await fireEvent.changeText(screen.getByTestId("lodging-search-input"), "지도 호텔");
    await fireEvent.press(screen.getByTestId("lodging-search-button"));
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
    mockSearchPlacesByDestination.mockResolvedValue([{
      googlePlaceId: "region-seoul", name: "서울", address: "대한민국 서울특별시", latitude: 37.5665, longitude: 126.978,
    }]);
    const screen = await render(<NewTripScreen />);

    await fireEvent.changeText(screen.getByTestId("new-trip-title"), "실패 테스트 여행");
    await fireEvent.press(screen.getByTestId("region-dropdown-open"));
    await fireEvent.changeText(screen.getByTestId("region-search-input"), "서울");
    await fireEvent.press(screen.getByTestId("region-search-button"));
    await fireEvent.press(await screen.findByTestId("region-result-region-seoul"));
    await fireEvent.press(screen.getByTestId("region-selection-apply"));
    await fireEvent.press(screen.getByTestId("new-trip-submit"));

    expect(await screen.findByText("서버에 연결하지 못했어요.")).toBeOnTheScreen();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, waitFor } from "@testing-library/react-native";

import AddPlacePage from "./add-place-page";
import { AppDialogProvider } from "@/shared/ui/app-dialog";

jest.mock("@/domains/trips/api/trips.api", () => ({
  getTrip: jest.fn().mockResolvedValue({ regions: [{ latitude: 37.54, longitude: 127.04 }] }),
}));

const mockSavePlace = jest.fn();
const mockSearchPlaces = jest.fn();

jest.mock("expo-router", () => ({
  usePreventRemove: () => jest.fn(),
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
}));
jest.mock("@/domains/places/api/places.api", () => ({
  savePlace: (...args: unknown[]) => mockSavePlace(...args),
  searchPlaces: (...args: unknown[]) => mockSearchPlaces(...args),
}));

describe("AddPlacePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("searches for a place and adds it to the current trip", async () => {
    mockSearchPlaces.mockResolvedValue([
      {
        address: "서울특별시 성동구 뚝섬로 273",
        googlePlaceId: "google-seoul-forest",
        name: "서울숲",
        primaryType: "park",
      },
    ]);
    mockSavePlace.mockResolvedValue({ status: "created" });
    const screen = await render(<AppDialogProvider><AddPlacePage /></AppDialogProvider>);

    await fireEvent.changeText(screen.getByTestId("add-place-query"), "서울숲");
    await fireEvent.press(screen.getByTestId("add-place-search"));

    expect(await screen.findByText("서울숲")).toBeOnTheScreen();
    expect(screen.getByText("서울특별시 성동구 뚝섬로 273")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("add-place-google-seoul-forest"));

    await waitFor(() => expect(mockSavePlace).toHaveBeenCalledWith("trip-1", {
      address: "서울특별시 성동구 뚝섬로 273",
      googlePlaceId: "google-seoul-forest",
      isPrimaryLodging: false,
      name: "서울숲",
      preference: "want_to_visit",
      tag: "activity",
    }));
    expect(await screen.findByText("장소 추가 완료")).toBeOnTheScreen();
    expect(screen.getByText("서울숲을(를) 추가했어요.")).toBeOnTheScreen();
    expect(screen.getByTestId("add-place-query")).toHaveProp("value", "");
    expect(screen.queryByText("서울숲")).toBeNull();
  });
  it("searches the visible map bounds and saves the optional description", async () => {
    mockSearchPlaces.mockResolvedValue([{ googlePlaceId: "park", name: "서울숲", latitude: 37.54, longitude: 127.04, primaryType: "park" }]);
    mockSavePlace.mockResolvedValue({ status: "created" });
    const screen = await render(<AppDialogProvider><AddPlacePage /></AppDialogProvider>);
    const map = await screen.findByTestId("add-place-map");
    expect(map).toHaveProp("initialRegion", { latitude: 37.54, longitude: 127.04, latitudeDelta: 0.08, longitudeDelta: 0.08 });
    await fireEvent(map, "regionChangeComplete");
    await fireEvent.changeText(screen.getByTestId("add-place-query"), "공원");
    await waitFor(() => expect(screen.getByTestId("add-place-search-area")).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId("add-place-search"));
    await screen.findByText("서울숲");
    expect(mockSearchPlaces).toHaveBeenLastCalledWith("trip-1", "공원", { north: 38, south: 37, east: 128, west: 126 });
    await fireEvent.changeText(screen.getByTestId("add-place-note"), "  산책하고 사진 찍기  ");
    await fireEvent.press(screen.getByTestId("add-place-park"));
    await waitFor(() => expect(mockSavePlace).toHaveBeenCalledWith("trip-1", expect.objectContaining({ note: "산책하고 사진 찍기", latitude: 37.54, longitude: 127.04 })));
  });

  it("keeps each selected place's description and preserves it when saving fails", async () => {
    mockSearchPlaces.mockResolvedValue([{ googlePlaceId: "a", name: "장소 A" }, { googlePlaceId: "b", name: "장소 B" }]);
    mockSavePlace.mockRejectedValue(new Error("저장 실패"));
    const screen = await render(<AppDialogProvider><AddPlacePage /></AppDialogProvider>);
    await fireEvent.changeText(screen.getByTestId("add-place-query"), "카페");
    await fireEvent.press(screen.getByTestId("add-place-search"));
    await screen.findByText("장소 A");
    await fireEvent.changeText(screen.getByTestId("add-place-note"), "A 메모");
    await fireEvent.press(screen.getByTestId("add-place-select-b"));
    expect(screen.getByTestId("add-place-note")).toHaveProp("value", "");
    await fireEvent.press(screen.getByTestId("add-place-select-a"));
    await fireEvent.press(screen.getByTestId("add-place-a"));
    await screen.findByText("저장 실패");
    expect(screen.getByTestId("add-place-note")).toHaveProp("value", "A 메모");
  });

  it("clears hidden candidate drafts after a place is saved", async () => {
    const candidates = [{ googlePlaceId: "a", name: "장소 A" }, { googlePlaceId: "b", name: "장소 B" }];
    mockSearchPlaces.mockResolvedValue(candidates);
    mockSavePlace.mockResolvedValue({ status: "created" });
    const screen = await render(<AppDialogProvider><AddPlacePage /></AppDialogProvider>);
    await fireEvent.changeText(screen.getByTestId("add-place-query"), "카페");
    await fireEvent.press(screen.getByTestId("add-place-search"));
    await screen.findByText("장소 A");
    await fireEvent.changeText(screen.getByTestId("add-place-note"), "A 메모");
    await fireEvent.press(screen.getByTestId("add-place-select-b"));
    await fireEvent.press(screen.getByTestId("add-place-b"));
    await screen.findByText("장소 추가 완료");

    await fireEvent.changeText(screen.getByTestId("add-place-query"), "카페");
    await fireEvent.press(screen.getByTestId("add-place-search"));
    await screen.findByText("장소 A");
    expect(screen.getByTestId("add-place-note")).toHaveProp("value", "");
  });

});

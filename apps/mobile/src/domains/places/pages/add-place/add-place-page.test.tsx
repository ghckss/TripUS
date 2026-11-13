import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import AddPlacePage from "./add-place-page";

const mockSavePlace = jest.fn();
const mockSearchPlaces = jest.fn();

jest.mock("expo-router", () => ({
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
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockSearchPlaces.mockResolvedValue([
      {
        address: "서울특별시 성동구 뚝섬로 273",
        googlePlaceId: "google-seoul-forest",
        name: "서울숲",
        primaryType: "park",
      },
    ]);
    mockSavePlace.mockResolvedValue({ status: "created" });
    const screen = await render(<AddPlacePage />);

    await fireEvent.changeText(screen.getByTestId("add-place-query"), "서울숲");
    await fireEvent.press(screen.getByTestId("add-place-search"));

    expect(await screen.findByText("서울숲")).toBeOnTheScreen();
    expect(screen.queryByText("서울특별시 성동구 뚝섬로 273")).toBeNull();
    await fireEvent.press(screen.getByTestId("add-place-google-seoul-forest"));

    await waitFor(() => expect(mockSavePlace).toHaveBeenCalledWith("trip-1", {
      address: "서울특별시 성동구 뚝섬로 273",
      googlePlaceId: "google-seoul-forest",
      isPrimaryLodging: false,
      name: "서울숲",
      preference: "want_to_visit",
      tag: "activity",
    }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith("장소 추가 완료", "서울숲을(를) 추가했어요."));
    expect(screen.getByTestId("add-place-query")).toHaveProp("value", "");
    expect(screen.queryByText("서울숲")).toBeNull();
  });
});

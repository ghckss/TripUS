import { fireEvent, render } from "@testing-library/react-native";
import PlacesScreen from "./place-library-page";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn(), router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({ tripId: "trip-1" }) }));
jest.mock("@/domains/places/api/places.api", () => ({ getPlacePhoto: jest.fn().mockResolvedValue({ imageUrl: null }) }));
jest.mock("./use-place-library", () => ({
  usePlaceLibrary: () => ({
    places: [
      { id: "park", name: "서울숲", tag: "attraction", note: "오래 걷기" },
      { id: "cafe", name: "오월카페", tag: "cafe", note: "창가에서 쉬기" },
    ],
    selectedIds: new Set(), loading: false, saving: false, message: undefined,
    clearSelection: jest.fn(), reload: jest.fn(), removePlaces: jest.fn(), selectPlaces: jest.fn(), toggleSelection: jest.fn(),
  }),
}));
it("combines the selected category with name or memo search", async () => {
  const screen = await render(<PlacesScreen />);
  await fireEvent.changeText(screen.getByLabelText("저장한 장소 검색"), "창가");
  expect(screen.getByText("오월카페")).toBeOnTheScreen();
  expect(screen.queryByText("서울숲")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "명소" }));
  expect(screen.getByText("검색 조건에 맞는 장소가 없어요.")).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText("저장한 장소 검색"), "서울");
  expect(screen.getByText("서울숲")).toBeOnTheScreen();
});
it("keeps bulk removal inside the explicit management panel", async () => {
  const screen = await render(<PlacesScreen />);
  expect(screen.queryByText("전체 제거")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "장소 선택·관리" }));
  expect(screen.getByText("전체 제거")).toBeOnTheScreen();
  expect(screen.getByRole("button", { name: "선택 제거" })).toBeDisabled();
});

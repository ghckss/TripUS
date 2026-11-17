import { fireEvent, render } from "@testing-library/react-native";
import * as Sharing from "expo-sharing";
import TripRecapPage from "./trip-recap-page";

const mockCapture = jest.fn().mockResolvedValue("file:///recap.png");
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ tripId: "trip-1" }) }));
jest.mock("expo-media-library", () => ({ requestPermissionsAsync: jest.fn(), Asset: { create: jest.fn() } }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("react-native-view-shot", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function MockViewShot({ children }: { children: React.ReactNode }, ref) {
      React.useImperativeHandle(ref, () => ({ capture: mockCapture }));
      return <View>{children}</View>;
    }),
  };
});
jest.mock("./use-trip-recap", () => ({
  useTripRecap: () => ({
    trip: { title: "파리 여행", startDate: "2026-12-01", endDate: "2026-12-01" },
    itinerary: { items: [{ id: "item-1", savedPlaceId: "place-1", placeName: "루브르 박물관", date: "2026-12-01", position: 0, locked: false, source: "manual", visitStatus: "rated", rating: 5 }] },
    photos: [{ id: "photo-1", itineraryItemId: "item-1", status: "ready", filename: "louvre.jpg", optimizedUrl: "https://example.com/louvre.jpg" }],
    loading: false,
  }),
}));

const scrollAt = (x: number) => ({
  nativeEvent: { contentOffset: { x, y: 0 }, contentSize: { width: 3000, height: 500 }, layoutMeasurement: { width: 400, height: 500 } },
});

beforeEach(() => jest.clearAllMocks());

it("updates page dots during consecutive scroll events before momentum ends", async () => {
  const screen = await render(<TripRecapPage />);
  const carousel = screen.getByTestId("trip-recap-carousel");
  const slideWidth = carousel.props.snapToInterval as number;
  expect(screen.getByLabelText("전체 3장 중 1번째 이미지")).toBeOnTheScreen();
  await fireEvent.scroll(carousel, scrollAt(slideWidth * 1.1));
  expect(screen.getByLabelText("전체 3장 중 2번째 이미지")).toBeOnTheScreen();
  await fireEvent.scroll(carousel, scrollAt(slideWidth * 2.1));
  expect(screen.getByLabelText("전체 3장 중 3번째 이미지")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "현재 장 공유" }));
  expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///recap.png", expect.objectContaining({ dialogTitle: "3번째 여행 이미지 공유" }));
});

it("clamps page indicators during overscroll and settles on the final snap", async () => {
  const screen = await render(<TripRecapPage />);
  const carousel = screen.getByTestId("trip-recap-carousel");
  const interval = carousel.props.snapToInterval as number;
  await fireEvent.scroll(carousel, scrollAt(-interval));
  expect(screen.getByLabelText("전체 3장 중 1번째 이미지")).toBeOnTheScreen();
  await fireEvent.scroll(carousel, scrollAt(interval * 20));
  expect(screen.getByLabelText("전체 3장 중 3번째 이미지")).toBeOnTheScreen();
  await fireEvent(carousel, "momentumScrollEnd", scrollAt(interval));
  expect(screen.getByLabelText("전체 3장 중 2번째 이미지")).toBeOnTheScreen();
});

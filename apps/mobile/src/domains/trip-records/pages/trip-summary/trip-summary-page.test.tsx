import { TripWorkspaceContext } from "@/shared/ui/trip-workspace";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import TripSummaryScreen, { selectTripSummaryHero } from "./trip-summary-page";

let mockTripSummary = {
  trip: { title: "파리에서의 일주일", startDate: "2026-12-01", endDate: "2026-12-07" },
  itinerary: { items: [] as never[] },
  photos: [] as never[],
};

jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), canGoBack: jest.fn().mockReturnValue(false), back: jest.fn() },
  useLocalSearchParams: () => ({ tripId: "trip-1" }),
  useFocusEffect: jest.fn(),
  Stack: { Screen: ({ options }: { options: { headerLeft: () => React.ReactNode } }) => options.headerLeft() },
}));
jest.mock("./use-trip-summary", () => ({
  useTripSummary: () => mockTripSummary,
}));
jest.mock("@/domains/trips/components/trip-cover", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { TripCover: () => React.createElement(View, { testID: "trip-summary-city-cover" }) };
});

beforeEach(() => {
  mockTripSummary = {
    trip: { title: "파리에서의 일주일", startDate: "2026-12-01", endDate: "2026-12-07" },
    itinerary: { items: [] }, photos: [],
  };
});

it("shows an icon back control while keeping the trip name in the body", async () => {
  const screen = await render(<TripSummaryScreen />);
  const back = screen.getByRole("button", { name: "뒤로가기" });
  expect(screen.getAllByText("파리에서의 일주일")).toHaveLength(1);
  expect(back).not.toHaveTextContent("파리에서의 일주일");
  await fireEvent.press(back);
  expect(router.replace).toHaveBeenCalledWith("/(tabs)/completed");
});

it("closes the existing workspace instead of replacing the original tab", async () => {
  const close = jest.fn();
  const screen = await render(<TripWorkspaceContext.Provider value={close}><TripSummaryScreen /></TripWorkspaceContext.Provider>);
  await fireEvent.press(screen.getByRole("button", { name: "뒤로가기" }));
  expect(close).toHaveBeenCalledTimes(1);
});

it("chooses the highest-rated visited place photo as the main image", () => {
  const items = [
    { id: "low", placeName: "낮은 평점 장소", rating: 3, visitStatus: "rated" },
    { id: "high", placeName: "가장 좋았던 장소", rating: 5, visitStatus: "rated" },
    { id: "missed", placeName: "미방문 장소", rating: 5, visitStatus: "not_visited" },
  ] as never;
  const photos = [
    { id: "photo-low", itineraryItemId: "low", status: "ready", optimizedUrl: "https://example.com/low.jpg" },
    { id: "photo-high", itineraryItemId: "high", status: "ready", optimizedUrl: "https://example.com/high.jpg" },
    { id: "photo-missed", itineraryItemId: "missed", status: "ready", optimizedUrl: "https://example.com/missed.jpg" },
  ] as never;
  expect(selectTripSummaryHero(items, photos)).toMatchObject({ item: { id: "high" }, photo: { id: "photo-high" }, uri: "https://example.com/high.jpg" });
});

it("shows the selected place photo and its place name instead of the placeholder illustration", async () => {
  mockTripSummary = {
    trip: { title: "파리에서의 일주일", startDate: "2026-12-01", endDate: "2026-12-07" },
    itinerary: { items: [{ id: "place-1", placeName: "루브르 박물관", rating: 5, visitStatus: "rated" }] },
    photos: [{ id: "photo-1", itineraryItemId: "place-1", status: "ready", optimizedUrl: "https://example.com/louvre.jpg" }],
  } as never;
  const screen = await render(<TripSummaryScreen />);
  expect(screen.getByTestId("trip-summary-hero-photo")).toHaveProp("source", [{ uri: "https://example.com/louvre.jpg", cacheKey: "trip-photo:photo-1:optimized" }]);
  expect(screen.getByTestId("trip-summary-hero-photo")).toHaveProp("cachePolicy", "memory-disk");
  expect(screen.getByLabelText("루브르 박물관 여행 대표 사진")).toBeOnTheScreen();
});

it("uses the same city or country cover as the trip list when no place photo is linked", async () => {
  const screen = await render(<TripSummaryScreen />);
  expect(screen.getByTestId("trip-summary-city-cover")).toBeOnTheScreen();
  expect(screen.queryByTestId("trip-summary-hero-photo")).not.toBeOnTheScreen();
});

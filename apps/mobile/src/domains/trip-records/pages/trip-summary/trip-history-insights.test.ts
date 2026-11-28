import { act, fireEvent, render } from "@testing-library/react-native";
import { createElement } from "react";
import { regionVisitCounts, straightLineDistanceKm, TripHistoryInsights, visitedHistoryItems } from "./trip-history-insights";

const trip = { title: "도쿄", destination: "일본", startDate: "2026-11-01", endDate: "2026-11-02", regions: [
  { googlePlaceId: null, name: "도쿄", address: null, latitude: 35.68, longitude: 139.76 },
  { googlePlaceId: null, name: "요코하마", address: null, latitude: 35.44, longitude: 139.64 },
] } as never;
const items = [
  { id: "boundary", placeName: "공항", boundaryType: "start_point", date: "2026-11-01", position: 0, latitude: 35.7, longitude: 139.7 },
  { id: "a", placeName: "도쿄역", address: "도쿄", date: "2026-11-01", position: 1, latitude: 35.681, longitude: 139.767, visitStatus: "rated" },
  { id: "b", placeName: "야마시타 공원", address: "요코하마", date: "2026-11-01", position: 2, latitude: 35.449, longitude: 139.65, visitStatus: "unrated" },
  { id: "c", placeName: "가지 않은 곳", date: "2026-11-02", position: 0, latitude: 35.5, longitude: 139.5, visitStatus: "not_visited" },
] as never;

it("excludes boundaries and unvisited places from completed-trip insights", () => {
  expect(visitedHistoryItems(items).map((item) => item.id)).toEqual(["a", "b"]);
  expect(regionVisitCounts(trip, items)).toEqual([{ name: "도쿄", count: 1 }, { name: "요코하마", count: 1 }]);
});

it("computes only same-day straight-line segments", () => {
  expect(straightLineDistanceKm(items)).toBeGreaterThan(20);
  expect(straightLineDistanceKm(items)).toBeLessThan(40);
});

it("allows the completed-trip map to zoom and pan", async () => {
  const screen = await render(createElement(TripHistoryInsights, { trip, items }));
  expect(screen.getByTestId("trip-history-map")).toHaveProp("zoomEnabled", true);
  expect(screen.getByTestId("trip-history-map")).toHaveProp("scrollEnabled", true);
});

it("replays the visited places in order and resets without animating back to the start", async () => {
  jest.useFakeTimers();
  const screen = await render(createElement(TripHistoryInsights, { trip, items }));

  expect(screen.queryByTestId("trip-history-replay-marker")).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId("trip-history-replay"));
  expect(screen.getByTestId("trip-history-replay-marker")).toBeOnTheScreen();
  expect(screen.getByText("방문 순서 재생 중…")).toBeOnTheScreen();

  await act(() => { jest.advanceTimersByTime(900); });
  expect(screen.queryByTestId("trip-history-replay-marker")).not.toBeOnTheScreen();
  await act(() => { jest.advanceTimersByTime(350); });
  expect(screen.getByText("방문 순서 재생")).toBeOnTheScreen();
  jest.useRealTimers();
});

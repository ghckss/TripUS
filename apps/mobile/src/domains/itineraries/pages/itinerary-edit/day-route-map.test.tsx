import { fireEvent, render } from "@testing-library/react-native";

import type { ItineraryItem } from "../../api/itineraries.api";
import { DayRouteMap } from "./day-route-map";

function itineraryItem(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id: "item-1",
    savedPlaceId: "place-1",
    placeName: "감천문화마을",
    address: "부산 사하구",
    latitude: 35.0974,
    longitude: 129.0106,
    date: "2026-11-09",
    position: 0,
    locked: false,
    source: "manual",
    visitStatus: null,
    rating: null,
    review: null,
    ...overrides,
  };
}

describe("DayRouteMap", () => {
  it("renders a Google map using the saved place coordinates", async () => {
    const screen = await render(<DayRouteMap items={[itineraryItem()]} />);

    expect(screen.getByLabelText("오늘의 Google 지도 동선, 1개 장소")).toBeOnTheScreen();
    expect(screen.getByTestId("route-marker-1")).toBeOnTheScreen();
    expect(screen.getByText("실제 위치 기반 방문 동선")).toBeOnTheScreen();
  });

  it("shows a coordinate backfill state instead of a fabricated map", async () => {
    const screen = await render(<DayRouteMap items={[itineraryItem({ latitude: null, longitude: null })]} />);

    expect(screen.getByText("장소 위치를 확인하고 있어요")).toBeOnTheScreen();
    expect(screen.queryByLabelText(/오늘의 Google 지도 동선/)).not.toBeOnTheScreen();
  });

  it("combines itinerary markers at the same lodging coordinates", async () => {
    const lodging = itineraryItem({ id: "lodging-start", placeName: "부산 호텔" });
    const attraction = itineraryItem({
      id: "attraction",
      latitude: 35.101,
      longitude: 129.03,
      placeName: "부산 타워",
    });
    const screen = await render(<DayRouteMap items={[
      lodging,
      attraction,
      { ...lodging, id: "lodging-end", position: 2 },
    ]} />);

    expect(screen.getByTestId("route-marker-1-3")).toBeOnTheScreen();
    expect(screen.getByText("1 · 3")).toBeOnTheScreen();
    expect(screen.getByTestId("route-marker-2")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("route-marker-1-3"));

    expect(screen.getByLabelText("1 · 3번 일정 상세")).toBeOnTheScreen();
    expect(screen.getAllByText("부산 호텔")).toHaveLength(2);
  });
});

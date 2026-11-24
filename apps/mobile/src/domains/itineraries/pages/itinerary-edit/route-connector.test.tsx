import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ItineraryItem, TransitRoute } from "../../api/itineraries.api";
import { getTransitLeg } from "../../api/itineraries.api";
import { RouteConnector } from "./route-connector";
import { departureInstant, transitLegRequest } from "./use-transit-leg";

jest.mock("../../api/itineraries.api", () => ({ getTransitLeg: jest.fn() }));
const lookup = getTransitLeg as jest.Mock;
const item = (id: string, extra: Partial<ItineraryItem> = {}): ItineraryItem => ({
  id, savedPlaceId: id, placeName: id, date: "2026-12-01", position: 0,
  ...extra,
} as ItineraryItem);
const available = (durationMinutes: number): TransitRoute => ({
  status: "available", durationMinutes, distanceMeters: null, reason: null,
  travelMode: "public_transit", isFallback: false,
});
function deferred() {
  let resolve!: (value: TransitRoute) => void;
  const promise = new Promise<TransitRoute>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => jest.clearAllMocks());

it("replaces the old duration with a small spinner immediately after a new leg is selected", async () => {
  const first = deferred(); const next = deferred();
  lookup.mockReturnValueOnce(first.promise).mockReturnValueOnce(next.promise);
  await render(<RouteConnector tripId="spinner-trip" origin={item("A")} destination={item("B")} />);
  expect(screen.getByLabelText("이동 시간 계산 중")).toBeTruthy();
  await act(async () => first.resolve(available(18)));
  await waitFor(() => expect(screen.getByText("18분")).toBeTruthy());
  await screen.rerender(<RouteConnector tripId="spinner-trip" origin={item("A")} destination={item("C")} />);
  expect(screen.queryByText("18분")).toBeNull();
  expect(screen.getByLabelText("이동 시간 계산 중")).toBeTruthy();
  await act(async () => next.resolve(available(35)));
  await waitFor(() => expect(screen.getByText("35분")).toBeTruthy());
  expect(screen.queryByLabelText("이동 시간 계산 중")).toBeNull();
});

it("ignores a late response for a previous ordering", async () => {
  const old = deferred(); const current = deferred();
  lookup.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  await render(<RouteConnector tripId="race-trip" origin={item("A")} destination={item("B")} />);
  await screen.rerender(<RouteConnector tripId="race-trip" origin={item("C")} destination={item("B")} />);
  await act(async () => current.resolve(available(12)));
  await act(async () => old.resolve(available(90)));
  await waitFor(() => expect(screen.getByText("12분")).toBeTruthy());
  expect(screen.queryByText("90분")).toBeNull();
});

it("reuses unchanged and recently visited legs while keeping direction in the cache key", async () => {
  lookup.mockResolvedValue(available(8));
  await render(<RouteConnector tripId="cache-trip" origin={item("A")} destination={item("B")} />);
  await waitFor(() => expect(screen.getByText("8분")).toBeTruthy());
  await screen.rerender(<RouteConnector tripId="cache-trip" origin={item("B")} destination={item("A")} />);
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  await screen.rerender(<RouteConnector tripId="cache-trip" origin={item("A")} destination={item("B")} />);
  await waitFor(() => expect(screen.getByText("8분")).toBeTruthy());
  expect(lookup).toHaveBeenCalledTimes(2);
});

it("shows unavailable on failure without falling back to stored AI minutes", async () => {
  lookup.mockRejectedValue(new Error("route unavailable"));
  await render(<RouteConnector tripId="failure-trip" origin={item("A")} destination={item("B", { travelDurationMinutes: 77 })} />);
  await waitFor(() => expect(screen.getByText("확인 불가 · 다시 조회")).toBeTruthy());
  expect(screen.queryByText("77분")).toBeNull();
});

it("labels an honest walking fallback when transit coverage returns no route", async () => {
  lookup.mockResolvedValue({
    status: "available", durationMinutes: 27, distanceMeters: 2100, reason: null,
    travelMode: "walking", isFallback: true,
  } satisfies TransitRoute);
  await render(<RouteConnector tripId="walking-fallback-trip" origin={item("A")} destination={item("B")} />);
  await waitFor(() => expect(screen.getByText("도보 27분")).toBeTruthy());
});

it("retries only the failed leg when the user asks", async () => {
  lookup.mockRejectedValueOnce(new Error("temporary failure")).mockResolvedValueOnce(available(21));
  await render(<RouteConnector tripId="retry-trip" origin={item("A")} destination={item("B")} />);
  const retry = await screen.findByLabelText("이동 시간 다시 조회");
  await fireEvent.press(retry);
  await waitFor(() => expect(screen.getByText("21분")).toBeTruthy());
  expect(lookup).toHaveBeenCalledTimes(2);
});

it("uses owned boundary references and the trip timezone rather than the phone timezone", () => {
  const airport = item("boundary", { boundaryType: "start_point", scheduledTime: "12:00", durationMinutes: null });
  expect(transitLegRequest(airport, item("hotel"), "Europe/Paris")).toEqual({ originBoundaryType: "start_point", destinationSavedPlaceId: "hotel", departureTime: "2026-12-01T11:00:00.000Z" });
  expect(departureInstant(item("late", { scheduledTime: "23:30", durationMinutes: 90 }), "Asia/Tokyo")).toBe("2026-12-01T16:00:00.000Z");
  expect(departureInstant(item("unknown"), "Europe/Paris")).toBeUndefined();
});

it("coalesces simultaneous requests for the same leg", async () => {
  const pending = deferred();
  lookup.mockReturnValue(pending.promise);
  const connector = <RouteConnector tripId="shared-trip" origin={item("A")} destination={item("B")} />;
  await render(<>{connector}{connector}</>);
  expect(lookup).toHaveBeenCalledTimes(1);
  expect(screen.getAllByLabelText("이동 시간 계산 중")).toHaveLength(2);
  await act(async () => pending.resolve(available(24)));
  await waitFor(() => expect(screen.getAllByText("24분")).toHaveLength(2));
});

it("invalidates a leg when its departure or the trip boundary location changes", async () => {
  lookup.mockResolvedValue(available(14));
  const origin = item("airport", { boundaryType: "start_point", placeName: "Airport A", scheduledTime: "12:00" });
  await render(<RouteConnector tripId="departure-trip" origin={origin} destination={item("B")} timezone="Europe/Paris" />);
  await waitFor(() => expect(screen.getByText("14분")).toBeTruthy());
  await screen.rerender(<RouteConnector tripId="departure-trip" origin={{ ...origin, scheduledTime: "13:00" }} destination={item("B")} timezone="Europe/Paris" />);
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(2));
  await screen.rerender(<RouteConnector tripId="departure-trip" origin={{ ...origin, scheduledTime: "13:00", placeName: "Airport C" }} destination={item("B")} timezone="Europe/Paris" />);
  await waitFor(() => expect(lookup).toHaveBeenCalledTimes(3));
  expect(lookup.mock.calls[0][1].departureTime).toBe("2026-12-01T11:00:00.000Z");
  expect(lookup.mock.calls[1][1].departureTime).toBe("2026-12-01T12:00:00.000Z");
});

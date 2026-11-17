import { act, renderHook } from "@testing-library/react-native";
import { useTripBoundaryPoints } from "./use-trip-boundary-points";

const airport = { googlePlaceId: "airport", name: "공항", address: "서울", latitude: 37, longitude: 127, time: "10:30" };
const station = { ...airport, googlePlaceId: "station", name: "역", time: "18:00" };

it.each(["start", "end"] as const)("mirrors the first %s place when both points are empty, without copying its time", async (kind) => {
  const { result } = await renderHook(() => useTripBoundaryPoints());
  await act(() => kind === "start" ? result.current.setStartPoint(airport) : result.current.setEndPoint(airport));
  expect(kind === "start" ? result.current.startPoint : result.current.endPoint).toEqual(airport);
  expect(kind === "start" ? result.current.endPoint : result.current.startPoint).toEqual({ ...airport, time: null });
  await act(() => result.current.setEndPoint(station));
  expect(result.current.startPoint?.googlePlaceId).toBe("airport");
  expect(result.current.endPoint).toEqual(station);
});
it.each(["start", "end"] as const)("does not fill an empty opposite place when the %s point already exists", async (kind) => {
  const { result } = await renderHook(() => useTripBoundaryPoints());
  await act(() => result.current.setPoints(kind === "start" ? { startPoint: airport } : { endPoint: airport }));
  expect(kind === "start" ? result.current.endPoint : result.current.startPoint).toBeUndefined();
  await act(() => kind === "start" ? result.current.setStartPoint(station) : result.current.setEndPoint(station));
  expect(kind === "start" ? result.current.endPoint : result.current.startPoint).toBeUndefined();
});
it("preserves an existing point when filling the missing one and supports reset", async () => {
  const { result } = await renderHook(() => useTripBoundaryPoints());
  await act(() => result.current.setPoints({ endPoint: airport }));
  await act(() => result.current.setStartPoint(station));
  expect(result.current.endPoint).toEqual(airport);
  await act(() => result.current.setPoints({}));
  await act(() => result.current.setEndPoint(station));
  expect(result.current.startPoint).toEqual({ ...station, time: null });
});

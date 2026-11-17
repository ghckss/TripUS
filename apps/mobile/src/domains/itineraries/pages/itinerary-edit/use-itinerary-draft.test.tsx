import { act, renderHook, waitFor } from "@testing-library/react-native";
import { setResource } from "@/shared/query/query-client";
import { type Itinerary } from "../../api/itineraries.api";
import { useItineraryEdit } from "./use-itinerary-edit";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));
jest.mock("@/domains/trips", () => ({ getTrip: jest.fn() }));
jest.mock("@/domains/places/api/places.api", () => ({ listPlaces: jest.fn() }));
jest.mock("../../api/itineraries.api", () => ({
  getItinerary: jest.fn(), generateAiPlanDay: jest.fn(), replaceItinerary: jest.fn(),
  isItineraryBoundary: (item: { boundaryType?: string }) => Boolean(item.boundaryType),
}));
const item = (id: string, position: number) => ({ id, savedPlaceId: id, placeName: id, date: "2026-12-01", position, locked: false, source: "manual", visitStatus: null, rating: null, review: null });
function seed() {
  setResource("trips:trip", { startDate: "2026-12-01", endDate: "2026-12-01", timezone: "Asia/Seoul" });
  setResource("trips:trip:places", []);
  setResource("trips:trip:itinerary", { items: [item("A", 0), item("B", 1)], unplaced: [] });
}
it("retains a local reorder when a background server snapshot arrives", async () => {
  seed();
  const { result } = await renderHook(() => useItineraryEdit("trip"));
  await waitFor(() => expect(result.current.itinerary?.items).toHaveLength(2));
  await act(() => result.current.reorderWithinDay("A", 1));
  expect(result.current.hasChanges).toBe(true);
  await act(() => { setResource<Itinerary>("trips:trip:itinerary", { items: [item("C", 0)], unplaced: [] } as Itinerary); });
  await waitFor(() => expect(result.current.hasChanges).toBe(true));
  expect(result.current.itinerary?.items.map((item) => item.savedPlaceId).sort()).toEqual(["A", "B"]);
  expect(result.current.itinerary?.items.find((item) => item.id === "A")?.position).toBe(1);
});
it("accepts updated server data while the editor has no local changes", async () => {
  seed();
  const { result } = await renderHook(() => useItineraryEdit("trip"));
  await waitFor(() => expect(result.current.itinerary?.items).toHaveLength(2));
  await act(() => { setResource<Itinerary>("trips:trip:itinerary", { items: [item("C", 0)], unplaced: [] } as Itinerary); });
  await waitFor(() => expect(result.current.itinerary?.items[0].savedPlaceId).toBe("C"));
  expect(result.current.hasChanges).toBe(false);
});

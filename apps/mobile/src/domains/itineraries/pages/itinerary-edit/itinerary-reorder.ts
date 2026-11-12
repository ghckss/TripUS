import { isItineraryBoundary, type Itinerary } from "../../api/itineraries.api";

export function reorderItineraryWithinDay(current: Itinerary, itemId: string, targetIndex: number): Itinerary {
  const item = current.items.find((candidate) => candidate.id === itemId);
  if (!item || isItineraryBoundary(item)) return current;
  const sameDay = current.items
    .filter((candidate) => candidate.date === item.date)
    .sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
  const index = sameDay.findIndex((candidate) => candidate.id === itemId);
  const boundedTargetIndex = Math.max(0, Math.min(targetIndex, sameDay.length - 1));
  if (index < 0 || index === boundedTargetIndex) return current;

  const reordered = [...sameDay];
  const [moved] = reordered.splice(index, 1);
  reordered.splice(boundedTargetIndex, 0, moved);
  const nextPositions = new Map(reordered.map((candidate, position) => [candidate.id, position]));

  return {
    ...current,
    items: current.items.map((candidate) => nextPositions.has(candidate.id)
      ? { ...candidate, position: nextPositions.get(candidate.id)! }
      : candidate),
  };
}

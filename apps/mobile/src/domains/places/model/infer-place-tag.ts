export function inferPlaceTag(primaryType: string | null): "attraction" | "food" | "cafe" | "shopping" | "lodging" | "transport" | "activity" | "other" {
  if (!primaryType) return "other";
  if (primaryType.includes("restaurant") || primaryType.includes("food")) return "food";
  if (primaryType.includes("cafe")) return "cafe";
  if (primaryType.includes("store") || primaryType.includes("shopping")) return "shopping";
  if (primaryType.includes("lodging") || primaryType.includes("hotel")) return "lodging";
  if (primaryType.includes("station") || primaryType.includes("airport")) return "transport";
  if (primaryType.includes("attraction") || primaryType.includes("museum")) return "attraction";
  if (primaryType.includes("park") || primaryType.includes("activity")) return "activity";
  return "other";
}

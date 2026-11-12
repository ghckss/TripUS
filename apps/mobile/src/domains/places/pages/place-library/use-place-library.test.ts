import { allPlaceIds, togglePlaceSelection } from "./use-place-library";

jest.mock("expo-router", () => ({ useFocusEffect: jest.fn() }));

describe("place library selection", () => {
  it("selects and deselects an individual place without mutating the current set", () => {
    const current = new Set(["place-1"]);
    const selected = togglePlaceSelection(current, "place-2");
    const deselected = togglePlaceSelection(selected, "place-1");

    expect(current).toEqual(new Set(["place-1"]));
    expect(selected).toEqual(new Set(["place-1", "place-2"]));
    expect(deselected).toEqual(new Set(["place-2"]));
  });

  it("creates a selection containing every displayed place", () => {
    expect(allPlaceIds([{ id: "place-1" }, { id: "place-2" }])).toEqual(new Set(["place-1", "place-2"]));
  });
});

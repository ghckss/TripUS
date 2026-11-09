import { fireEvent, render } from "@testing-library/react-native";

import { DraggableItineraryItem } from "./draggable-itinerary-item";

describe("DraggableItineraryItem", () => {
  it("offers accessible reorder actions without arrow buttons", async () => {
    const reorder = jest.fn();
    const screen = await render(
      <DraggableItineraryItem
        canMoveToNextDay
        canMoveToPreviousDay={false}
        index={1}
        itemCount={3}
        onMoveToDay={jest.fn()}
        onRemove={jest.fn()}
        onReorder={reorder}
        placeName="감천문화마을"
      />,
    );

    fireEvent(screen.getByLabelText("감천문화마을 순서 이동"), "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });

    expect(reorder).toHaveBeenCalledWith(0);
    expect(screen.queryByText("↑")).not.toBeOnTheScreen();
    expect(screen.queryByText("↓")).not.toBeOnTheScreen();
  });
});

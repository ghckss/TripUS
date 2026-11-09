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
        onPress={jest.fn()}
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

  it("opens the place on the map when its summary is pressed", async () => {
    const openOnMap = jest.fn();
    const screen = await render(
      <DraggableItineraryItem
        canMoveToNextDay={false}
        canMoveToPreviousDay={false}
        index={0}
        itemCount={1}
        onMoveToDay={jest.fn()}
        onPress={openOnMap}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName="감천문화마을"
      />,
    );

    await fireEvent.press(screen.getByLabelText("감천문화마을 지도에서 보기"));

    expect(openOnMap).toHaveBeenCalledTimes(1);
  });

  it("keeps a lodging endpoint fixed without showing endpoint labels", async () => {
    const screen = await render(
      <DraggableItineraryItem
        canMoveToNextDay={false}
        canMoveToPreviousDay={false}
        fixed
        index={0}
        itemCount={1}
        onMoveToDay={jest.fn()}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName="부산 호텔"
      />,
    );

    expect(screen.queryByText("하루 시작 숙소")).not.toBeOnTheScreen();
    expect(screen.queryByText("하루 종료 숙소")).not.toBeOnTheScreen();
    expect(screen.queryByLabelText("부산 호텔 순서 이동")).not.toBeOnTheScreen();
    expect(screen.queryByLabelText("부산 호텔 일정에서 제외")).not.toBeOnTheScreen();
    expect(screen.getByLabelText("부산 호텔 지도에서 보기")).toBeOnTheScreen();
  });
});

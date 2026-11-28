import { fireEvent, render } from "@testing-library/react-native";

import { DraggableItineraryItem } from "./draggable-itinerary-item";

describe("DraggableItineraryItem", () => {
  it("offers accessible reorder actions without arrow buttons", async () => {
    const reorder = jest.fn();
    const screen = await render(
      <DraggableItineraryItem
        index={1}
        itemCount={3}
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
        index={0}
        itemCount={1}
        onPress={openOnMap}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName="감천문화마을"
      />,
    );

    fireEvent.press(screen.getByLabelText("감천문화마을 지도에서 보기"));

    expect(openOnMap).toHaveBeenCalledTimes(1);
  });

  it("keeps a lodging endpoint fixed and explains why it cannot be dragged", async () => {
    const screen = await render(
      <DraggableItineraryItem
        fixed
        index={0}
        itemCount={1}
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
    expect(screen.queryByText("숙소")).not.toBeOnTheScreen();
    expect(screen.getByLabelText("부산 호텔 지도에서 보기")).toBeOnTheScreen();
  });

  it("offers an edit action for a lodging endpoint", async () => {
    const edit = jest.fn();
    const screen = await render(
      <DraggableItineraryItem
        fixed
        fixedLabel="시작 숙소"
        index={0}
        itemCount={2}
        onEdit={edit}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName="부산 호텔"
      />,
    );

    fireEvent.press(screen.getByLabelText("부산 호텔 시작 숙소 수정"));
    expect(edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("시작 숙소")).not.toBeOnTheScreen();
  });

  it("exposes a dedicated drag handle", async () => {
    const screen = await render(
      <DraggableItineraryItem
        index={0}
        itemCount={2}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName="감천문화마을"
      />,
    );
    expect(screen.getByTestId("itinerary-drag-area-감천문화마을")).toBeOnTheScreen();
  });

  it("announces its ordinal position instead of a percentage", async () => {
    const screen = await render(
      <DraggableItineraryItem
        index={2}
        itemCount={5}
        minIndex={1}
        maxIndex={3}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName="감천문화마을"
      />,
    );

    expect(screen.getByLabelText("감천문화마을 순서 이동").props.accessibilityValue).toEqual({
      text: "2번째, 총 3곳",
    });
  });

  it("limits a long place name to two lines", async () => {
    const longName = "아주 길어서 여러 줄이 될 수 있는 여행 장소 이름";
    const screen = await render(
      <DraggableItineraryItem
        index={0}
        itemCount={1}
        onPress={jest.fn()}
        onRemove={jest.fn()}
        onReorder={jest.fn()}
        placeName={longName}
      />,
    );

    expect(screen.getByText(longName).props.numberOfLines).toBe(2);
  });
});

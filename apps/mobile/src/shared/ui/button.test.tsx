import { fireEvent, render } from "@testing-library/react-native";

import { Button } from "./button";

describe("Button", () => {
  it("invokes its action and exposes a stable test identifier", async () => {
    const onPress = jest.fn();
    const screen = await render(<Button label="계속하기" onPress={onPress} testID="continue" />);

    await fireEvent.press(screen.getByTestId("continue"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not invoke its action while disabled", async () => {
    const onPress = jest.fn();
    const screen = await render(<Button label="저장 중" disabled onPress={onPress} />);
    const button = screen.getByRole("button", { name: "저장 중" });

    await fireEvent.press(button);

    expect(button).toBeDisabled();
    expect(onPress).not.toHaveBeenCalled();
  });
});

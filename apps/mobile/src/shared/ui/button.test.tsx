import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";

import { colors } from "@/shared/design/tokens";
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
    expect(StyleSheet.flatten(button.props.style).backgroundColor).toBe(colors.disabledSurface);
    expect(StyleSheet.flatten(screen.getByText("저장 중").props.style).color).toBe(colors.disabledText);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("uses semantic colors for successful and destructive actions", async () => {
    const screen = await render(<>
      <Button label="저장" onPress={jest.fn()} testID="success" variant="success" />
      <Button label="삭제" onPress={jest.fn()} testID="danger" variant="danger" />
    </>);

    expect(StyleSheet.flatten(screen.getByTestId("success").props.style).backgroundColor).toBe(colors.success);
    expect(StyleSheet.flatten(screen.getByTestId("danger").props.style).backgroundColor).toBe(colors.danger);
  });
});

import { fireEvent, render } from "@testing-library/react-native";
import { Pressable } from "react-native";

import { AppText } from "./app-text";
import { AppDialogProvider, useAppDialog } from "./app-dialog";

function DialogTrigger({ destructive = false, onConfirm = jest.fn() }: { destructive?: boolean; onConfirm?: () => void }) {
  const { showDialog } = useAppDialog();
  return <Pressable onPress={() => showDialog({
    title: destructive ? "삭제할까요?" : "알림",
    message: "팝업 설명",
    actions: destructive ? [
      { label: "취소", variant: "ghost" },
      { label: "삭제", variant: "danger", onPress: onConfirm },
    ] : undefined,
  })}><AppText>열기</AppText></Pressable>;
}

describe("AppDialogProvider", () => {
  it("shows and closes a one-button app dialog", async () => {
    const screen = await render(<AppDialogProvider><DialogTrigger /></AppDialogProvider>);

    await fireEvent.press(screen.getByText("열기"));
    expect(screen.getByText("알림")).toBeOnTheScreen();
    expect(screen.getByText("팝업 설명")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("확인"));
    expect(screen.queryByTestId("app-dialog")).not.toBeOnTheScreen();
  });

  it("runs a destructive action after closing", async () => {
    const onConfirm = jest.fn();
    const screen = await render(<AppDialogProvider><DialogTrigger destructive onConfirm={onConfirm} /></AppDialogProvider>);

    await fireEvent.press(screen.getByText("열기"));
    await fireEvent.press(screen.getByText("삭제"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("app-dialog")).not.toBeOnTheScreen();
  });
});

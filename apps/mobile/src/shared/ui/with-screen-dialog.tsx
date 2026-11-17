import type { ComponentType } from "react";
import { AppDialogProvider } from "./app-dialog";

/** Native fullscreen screens need a dialog host inside their own presented controller. */
export function withScreenDialog(Page: ComponentType) {
  return function ScreenWithDialog() {
    return <AppDialogProvider><Page /></AppDialogProvider>;
  };
}

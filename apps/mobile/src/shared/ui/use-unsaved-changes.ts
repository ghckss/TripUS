import { usePreventRemove } from "expo-router";
import { useState } from "react";
import { useAppDialog } from "./app-dialog";

export function useUnsavedChanges(dirty: boolean, busy = false) {
  const { showDialog } = useAppDialog();
  const [allowed, setAllowed] = useState(false);
  const disable = usePreventRemove(!allowed && (dirty || busy), ({ repeat }) => {
    if (busy) return;
    showDialog({ title: "저장하지 않은 변경사항이 있어요", message: "이동하면 작성 중인 내용이 사라져요.", actions: [
      { label: "계속 작성", variant: "success" },
      { label: "나가기", variant: "danger", onPress: () => { setAllowed(true); repeat(); } },
    ] });
  });
  return () => { setAllowed(true); disable(); };
}

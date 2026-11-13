import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";

type DialogButtonVariant = "primary" | "ghost" | "danger";

export type AppDialogAction = {
  label: string;
  onPress?: () => void | Promise<void>;
  variant?: DialogButtonVariant;
};

export type AppDialogOptions = {
  title: string;
  message?: string;
  actions?: AppDialogAction[];
};

type AppDialogContextValue = {
  showDialog: (options: AppDialogOptions) => void;
};

const AppDialogContext = createContext<AppDialogContextValue>({ showDialog: () => undefined });

export function AppDialogProvider({ children }: PropsWithChildren) {
  const [dialog, setDialog] = useState<AppDialogOptions>();
  const closeDialog = useCallback(() => setDialog(undefined), []);
  const showDialog = useCallback((options: AppDialogOptions) => setDialog(options), []);
  const value = useMemo(() => ({ showDialog }), [showDialog]);
  const actions = dialog?.actions?.length
    ? dialog.actions
    : [{ label: "확인", variant: "primary" as const }];

  return <AppDialogContext.Provider value={value}>
    {children}
    <Modal
      animationType="fade"
      onRequestClose={closeDialog}
      statusBarTranslucent
      transparent
      visible={Boolean(dialog)}
    >
      <View style={styles.overlay}>
        <Pressable accessibilityLabel="팝업 닫기" onPress={closeDialog} style={StyleSheet.absoluteFill} />
        {dialog && <View accessibilityViewIsModal style={styles.dialog} testID="app-dialog">
          <View style={styles.header}>
            <AppText variant="heading" style={styles.title}>{dialog.title}</AppText>
            <Pressable accessibilityLabel="팝업 닫기" accessibilityRole="button" hitSlop={8} onPress={closeDialog} style={styles.closeButton}>
              <AppText variant="heading" color={colors.muted}>×</AppText>
            </Pressable>
          </View>
          {dialog.message && <AppText color={colors.muted} style={styles.message}>{dialog.message}</AppText>}
          <View style={[styles.actions, actions.length === 1 && styles.singleAction]}>
            {actions.map((action) => <Button
              key={action.label}
              label={action.label}
              onPress={() => {
                closeDialog();
                void action.onPress?.();
              }}
              style={styles.action}
              variant={action.variant ?? "primary"}
            />)}
          </View>
        </View>}
      </View>
    </Modal>
  </AppDialogContext.Provider>;
}

export function useAppDialog(): AppDialogContextValue {
  return useContext(AppDialogContext);
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(39, 37, 33, 0.56)",
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: { flex: 1, paddingTop: spacing.xs },
  closeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", marginRight: -spacing.sm, marginTop: -spacing.sm },
  message: { lineHeight: 23 },
  actions: { flexDirection: "row", gap: spacing.sm, paddingTop: spacing.sm },
  singleAction: { justifyContent: "flex-end" },
  action: { flex: 1 },
});

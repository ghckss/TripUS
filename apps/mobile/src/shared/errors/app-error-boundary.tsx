import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "@/shared/design/tokens";
import { captureError } from "@/shared/telemetry/telemetry";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";

type State = { error?: Error };

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureError(error, `react.render:${info.componentStack?.slice(0, 180) ?? "unknown"}`);
  }

  private reset = (): void => {
    this.setState({ error: undefined });
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return <View accessibilityLiveRegion="assertive" style={styles.container}>
      <AppText variant="title">화면을 표시하지 못했어요</AppText>
      <AppText color={colors.muted}>입력한 내용은 가능한 한 그대로 두었어요. 다시 시도해 주세요.</AppText>
      <Button label="다시 시도" onPress={this.reset} />
    </View>;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: spacing.md, padding: spacing.lg, backgroundColor: colors.canvas },
});

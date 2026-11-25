import { StyleSheet, View } from "react-native";
import { colors } from "@/shared/design/tokens";

export function RouteConnector() {
  return <View style={styles.connector} testID="route-connector">
    <View style={styles.line} />
  </View>;
}
const styles = StyleSheet.create({
  connector: { height: 44, paddingLeft: 67 },
  line: { width: 2, height: 44, backgroundColor: colors.line },
});

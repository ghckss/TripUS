import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { colors, spacing } from "@/design/tokens";
import { mockTrip } from "@/mocks/trip";

export default function TripSummaryScreen() {
  return <Screen><AppText variant="caption" color={colors.primary}>TRIP COMPLETE</AppText><AppText variant="display">{mockTrip.title}</AppText><AppText color={colors.muted}>{mockTrip.dates}</AppText><View style={styles.stats}><Card style={styles.stat}><AppText variant="title">2</AppText><AppText color={colors.muted}>방문</AppText></Card><Card style={styles.stat}><AppText variant="title">1</AppText><AppText color={colors.muted}>미평가</AppText></Card><Card style={styles.stat}><AppText variant="title">0</AppText><AppText color={colors.muted}>미방문</AppText></Card></View><Card><AppText variant="heading">사진과 메모</AppText><AppText color={colors.muted}>원본 사진은 사용자 저장 용량 제한 없이 보관하는 정책으로 설계합니다. 업로드 진행 독립 화면은 제공하지 않아요.</AppText></Card><Button label="내 여행으로 돌아가기" onPress={() => router.replace("/(tabs)/trips")} /></Screen>;
}
const styles = StyleSheet.create({ stats: { flexDirection: "row", gap: spacing.sm }, stat: { flex: 1, alignItems: "center", paddingHorizontal: spacing.sm } });

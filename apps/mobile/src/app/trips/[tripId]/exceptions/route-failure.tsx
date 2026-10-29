import { router } from "expo-router";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/design/tokens";

export default function RouteFailureScreen() {
  return <Screen><AppText variant="title">대중교통 경로를 찾지 못했어요</AppText><AppText color={colors.muted}>일시적인 지도 응답 문제이거나 해당 시간대에 이용 가능한 경로가 없을 수 있어요.</AppText><Card><AppText variant="heading">서촌 골목 → 광장시장</AppText><AppText color={colors.muted}>직접 이동 수단을 선택하거나 잠시 후 다시 시도해 주세요.</AppText></Card><Button label="다시 시도" onPress={() => router.back()} /><Button label="직접 이동 시간 입력" variant="ghost" onPress={() => router.back()} /></Screen>;
}

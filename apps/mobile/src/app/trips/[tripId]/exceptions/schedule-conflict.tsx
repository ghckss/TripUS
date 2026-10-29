import { router } from "expo-router";
import { AppText } from "@/components/ui/app-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/design/tokens";

export default function ScheduleConflictScreen() {
  return <Screen><AppText variant="title">시간이 겹치는 장소가 있어요</AppText><AppText color={colors.muted}>국립현대미술관 관람 시간과 저녁 예약 시간이 겹칩니다. 장소를 빼거나 시간을 조정해 주세요.</AppText><Card><AppText variant="heading">15:00 – 17:30 국립현대미술관</AppText><AppText variant="heading">17:00 – 18:30 저녁 예약</AppText></Card><Button label="일정으로 돌아가 조정" onPress={() => router.back()} /></Screen>;
}

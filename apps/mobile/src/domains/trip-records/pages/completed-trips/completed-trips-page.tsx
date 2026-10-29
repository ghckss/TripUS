import { AppText } from "@/shared/ui/app-text";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { colors } from "@/shared/design/tokens";

export default function CompletedScreen() {
  return <Screen contentStyle={{ paddingTop: 64 }}><AppText variant="title">지난 여행</AppText><Card><AppText variant="heading">제주, 다시 만나</AppText><AppText color={colors.muted}>2026년 5월 · 방문 12곳 · 사진 48장</AppText></Card></Screen>;
}

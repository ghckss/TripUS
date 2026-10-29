import { AppText } from "@/components/ui/app-text";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { colors } from "@/design/tokens";

export default function ProfileScreen() {
  return <Screen contentStyle={{ paddingTop: 64 }}><AppText variant="title">프로필</AppText><Card><AppText variant="heading">여행자</AppText><AppText color={colors.muted}>알림, 계정, 데이터 설정은 이후 단계에서 연결합니다.</AppText></Card></Screen>;
}

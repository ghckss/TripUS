import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions, type ImageStyle, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { safeErrorMessage, tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { useAppDialog } from "@/shared/ui/app-dialog";
import { buildRecapSlides, type RecapPhoto, type RecapSlide } from "./recap-model";
import { useTripRecap } from "./use-trip-recap";

const accents = [colors.primary, colors.secondary, colors.warning, colors.muted];

function photoSource(photo: RecapPhoto, accessToken?: string) {
  return photo.uri.startsWith(tripUsApiBaseUrl) && accessToken
    ? { uri: photo.uri, headers: { Authorization: `Bearer ${accessToken}` } }
    : { uri: photo.uri };
}

function Photo({ photo, accessToken, style }: { photo: RecapPhoto; accessToken?: string; style: StyleProp<ImageStyle> }) {
  return <Image source={photoSource(photo, accessToken)} style={style} contentFit="cover" transition={150} />;
}

function CoverSlide({ slide, accessToken }: { slide: Extract<RecapSlide, { kind: "cover" }>; accessToken?: string }) {
  return <View style={styles.slideBody}>
    {slide.photos[0]
      ? <Photo photo={slide.photos[0]} accessToken={accessToken} style={styles.coverPhoto} />
      : <View style={styles.memoryHero}>
        <View style={styles.memoryBadge}><AppText variant="caption" color={colors.secondary}>TRIPUS MEMORY</AppText></View>
        <View style={styles.memorySymbols}><View style={[styles.memorySymbol, styles.memorySymbolPrimary]}><AppText style={styles.memoryEmoji}>✦</AppText></View><View style={[styles.memorySymbol, styles.memorySymbolSecondary]}><AppText style={styles.memoryEmoji}>⌖</AppText></View><View style={[styles.memorySymbol, styles.memorySymbolWarm]}><AppText style={styles.memoryEmoji}>♡</AppText></View></View>
        <AppText variant="title" color={colors.secondary}>사진 대신 여행의 기억을{`\n`}한 장에 담았어요</AppText>
        <View style={styles.coverStats}><AppText variant="label">{slide.dayCount}일의 기록</AppText><AppText variant="label">{slide.placeCount}곳의 순간</AppText></View>
      </View>}
    <View style={styles.coverPaper}>
      <AppText variant="caption" color={colors.primary}>TripUS TRAVEL DIARY</AppText>
      <AppText variant="display" numberOfLines={2}>{slide.title}</AppText>
      <AppText color={colors.muted}>{slide.subtitle}</AppText>
    </View>
    {slide.photos.slice(1, 3).map((photo, index) => <Photo key={photo.id} photo={photo} accessToken={accessToken} style={[styles.coverThumb, index === 0 ? styles.thumbOne : styles.thumbTwo]} />)}
  </View>;
}

function koreanDate(date: string): { dateLabel: string; weekday: string } {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][parsed.getUTCDay()] ?? "";
  const [, month, day] = date.split("-");
  return { dateLabel: `${Number(month)}월 ${Number(day)}일`, weekday };
}

function DayScheduleSlide({ slide }: { slide: Extract<RecapSlide, { kind: "day-schedule" }> }) {
  const accent = accents[(slide.day.dayNumber - 1) % accents.length];
  const { dateLabel, weekday } = koreanDate(slide.day.date);
  const dense = slide.day.items.length > 6;
  return <View style={[styles.slideBody, styles.paperSlide]}>
    <View style={styles.scheduleHeader}>
      <AppText variant="caption" color={accent}>DAY {slide.day.dayNumber}</AppText>
      <AppText variant="display" numberOfLines={1}>{weekday}</AppText>
      <AppText variant="label" color={colors.muted}>{dateLabel}</AppText>
    </View>
    <View style={styles.scheduleDivider} />
    <AppText variant="heading">오늘의 일정</AppText>
    {slide.day.items.length > 0 ? <View style={[styles.scheduleList, dense && styles.scheduleListDense]}>
      {slide.day.items.map((item, index) => <View key={item.id} style={[styles.scheduleRow, dense && styles.scheduleRowDense]}>
        <View style={[styles.scheduleMarker, { backgroundColor: accent }]}><AppText variant="caption" color={colors.white}>{index + 1}</AppText></View>
        <AppText variant="caption" color={accent} style={styles.scheduleTime}>{item.scheduledTime ?? "--:--"}</AppText>
        <AppText variant={dense ? "caption" : "label"} style={styles.schedulePlace} numberOfLines={2}>{item.placeName}</AppText>
      </View>)}
    </View> : <View style={styles.emptySchedule}><AppText variant="title" color={accent}>느긋하게 보낸 하루</AppText><AppText color={colors.muted}>기록된 방문 장소가 없어요.</AppText></View>}
    <View style={[styles.scheduleFooter, { backgroundColor: `${accent}14` }]}><AppText variant="caption" color={accent}>{slide.day.items.length}곳의 여행 기록</AppText></View>
  </View>;
}

function DayHighlightSlide({ slide, accessToken }: { slide: Extract<RecapSlide, { kind: "day-highlight" }>; accessToken?: string }) {
  const accent = accents[(slide.day.dayNumber - 1) % accents.length];
  const { dateLabel, weekday } = koreanDate(slide.day.date);
  return <View style={[styles.slideBody, styles.highlightSlide]}>
    <Photo photo={slide.photo} accessToken={accessToken} style={styles.highlightPhoto} />
    <View style={styles.highlightScrim} />
    <View style={styles.highlightTop}>
      <AppText variant="caption" color={colors.white}>DAY {slide.day.dayNumber} · {dateLabel} {weekday}</AppText>
    </View>
    <View style={styles.highlightCopy}>
      <AppText variant="caption" color={colors.white}>오늘 가장 기억에 남은 곳</AppText>
      <AppText variant="display" color={colors.white} numberOfLines={2}>{slide.place.placeName}</AppText>
      {typeof slide.place.rating === "number" && <View style={[styles.ratingBadge, { backgroundColor: accent }]}><AppText variant="label" color={colors.white}>★ {slide.place.rating}</AppText></View>}
      {slide.place.review?.trim() && <AppText color={colors.white} numberOfLines={2}>“{slide.place.review.trim()}”</AppText>}
    </View>
  </View>;
}

function Slide({ slide, accessToken }: { slide: RecapSlide; accessToken?: string }) {
  if (slide.kind === "cover") return <CoverSlide slide={slide} accessToken={accessToken} />;
  if (slide.kind === "day-schedule") return <DayScheduleSlide slide={slide} />;
  return <DayHighlightSlide slide={slide} accessToken={accessToken} />;
}

export default function TripRecapPage() {
  const { showDialog } = useAppDialog();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const { accessToken, error, itinerary, loading, photos, reload, trip } = useTripRecap(tripId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const slideRefs = useRef<(ViewShotRef | null)[]>([]);
  const readyPhotos = useMemo(() => photos.filter((photo) => photo.status === "ready" && (photo.optimizedUrl || photo.originalUrl || photo.thumbnailUrl)), [photos]);
  const slideWidth = Math.min(windowWidth - spacing.xl, 420);
  const slideHeight = slideWidth * 1.25;

  const slides = useMemo(() => trip && itinerary
    ? buildRecapSlides({ trip, itinerary, photos: readyPhotos })
    : [], [itinerary, readyPhotos, trip]);

  const updateActiveSlide = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / (slideWidth + spacing.md));
    setActiveIndex(Math.max(0, Math.min(slides.length - 1, index)));
  };

  const captureSlide = async (index: number) => {
    const target = slideRefs.current[index];
    if (!target) throw new Error("이미지를 준비하지 못했어요.");
    return target.capture();
  };

  const shareCurrent = async () => {
    if (Platform.OS === "web") return showDialog({ title: "모바일에서 사용할 수 있어요", message: "캐러셀 공유는 iOS 또는 Android 앱에서 이용해 주세요." });
    setExporting(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error("이 기기에서는 공유 기능을 사용할 수 없어요.");
      const uri = await captureSlide(activeIndex);
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: `${activeIndex + 1}번째 여행 이미지 공유` });
    } catch (caught) {
      showDialog({ title: "공유하지 못했어요", message: safeErrorMessage(caught, "잠시 후 다시 시도해 주세요.") });
    } finally { setExporting(false); }
  };

  const saveAll = async () => {
    if (Platform.OS === "web") return showDialog({ title: "모바일에서 사용할 수 있어요", message: "전체 저장은 iOS 또는 Android 앱에서 이용해 주세요." });
    setExporting(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) throw new Error("사진 앱 저장 권한이 필요해요.");
      for (let index = 0; index < slides.length; index += 1) {
        await MediaLibrary.Asset.create(await captureSlide(index));
      }
      showDialog({ title: "캐러셀을 저장했어요", message: `${slides.length}장을 순서대로 사진 앱에 저장했어요. 인스타그램에서 여러 장을 선택해 게시해 보세요.` });
    } catch (caught) {
      showDialog({ title: "저장하지 못했어요", message: safeErrorMessage(caught, "잠시 후 다시 시도해 주세요.") });
    } finally { setExporting(false); }
  };

  if (loading) return <Screen><Card><AppText color={colors.muted}>여행 캐러셀을 준비하는 중이에요…</AppText></Card></Screen>;
  if (error && (!trip || !itinerary)) return <Screen><Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card></Screen>;

  return <Screen contentStyle={styles.page}>
    <View style={styles.previewHeader}><AppText variant="title">캐러셀 미리보기</AppText><AppText color={colors.muted}>사진과 여행 기록으로 {slides.length}장을 자동 구성했어요.</AppText></View>
    {error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}
    <ScrollView testID="trip-recap-carousel" horizontal pagingEnabled snapToInterval={slideWidth + spacing.md} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} onScroll={updateActiveSlide} scrollEventThrottle={16} onMomentumScrollEnd={updateActiveSlide}>
      {slides.map((slide, index) => <ViewShot key={slide.id} style={[styles.slideFrame, { width: slideWidth, height: slideHeight }]} options={{ format: "png", quality: 1, result: "tmpfile" }} ref={(view) => { slideRefs.current[index] = view; }}><Slide slide={slide} accessToken={accessToken} /><View style={styles.pageNumber}><AppText variant="caption" color={colors.white}>{index + 1}/{slides.length}</AppText></View></ViewShot>)}
    </ScrollView>
    <View style={styles.dots} accessible accessibilityLabel={`전체 ${slides.length}장 중 ${activeIndex + 1}번째 이미지`}>{slides.map((slide, index) => <View key={slide.id} style={[styles.dot, activeIndex === index && styles.activeDot]} />)}</View>
    <Button label={exporting ? "이미지 준비 중…" : `전체 ${slides.length}장 사진 앱에 저장`} disabled={exporting} onPress={() => void saveAll()} />
    <Button label="현재 장 공유" variant="secondary" disabled={exporting} onPress={() => void shareCurrent()} />
    <AppText variant="caption" color={colors.muted}>날짜마다 일정표 한 장을 만들고, 사진이 있는 날에는 가장 높은 평가의 장소를 한 장 더 보여줘요.</AppText>
  </Screen>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.md },
  previewHeader: { gap: spacing.xs },
  carousel: { gap: spacing.md, paddingRight: spacing.md },
  slideFrame: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.surface },
  slideBody: { flex: 1, overflow: "hidden", backgroundColor: colors.surface },
  paperSlide: { paddingTop: spacing.xl, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  pageNumber: { position: "absolute", zIndex: 10, top: spacing.md, right: spacing.md, borderRadius: radius.pill, backgroundColor: `${colors.ink}AA`, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  coverPhoto: { width: "100%", height: "68%" },
  coverPaper: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, gap: spacing.xs, borderRadius: radius.md, backgroundColor: `${colors.surface}F2`, padding: spacing.lg },
  coverThumb: { position: "absolute", width: "27%", aspectRatio: 0.88, borderWidth: 5, borderColor: colors.white, borderRadius: radius.sm },
  thumbOne: { right: spacing.lg, top: "48%", transform: [{ rotate: "5deg" }] },
  thumbTwo: { right: "29%", top: "51%", transform: [{ rotate: "-4deg" }] },
  memoryHero: { height: "68%", justifyContent: "center", padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.secondarySoft },
  memoryBadge: { alignSelf: "flex-start", borderRadius: radius.pill, backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  memorySymbols: { flexDirection: "row", alignItems: "center", gap: -spacing.sm },
  memorySymbol: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", borderWidth: 5, borderColor: colors.secondarySoft },
  memorySymbolPrimary: { backgroundColor: colors.primarySoft, transform: [{ rotate: "-7deg" }] },
  memorySymbolSecondary: { backgroundColor: colors.white, transform: [{ rotate: "4deg" }] },
  memorySymbolWarm: { backgroundColor: colors.primarySoft, transform: [{ rotate: "-2deg" }] },
  memoryEmoji: { fontSize: 32, color: colors.secondary },
  coverStats: { flexDirection: "row", gap: spacing.sm },
  scheduleHeader: { flexShrink: 0, gap: spacing.xs, paddingRight: 64 },
  scheduleDivider: { height: 1, flexShrink: 0, backgroundColor: colors.line },
  scheduleList: { flex: 1, justifyContent: "center", gap: spacing.xs, minHeight: 0 },
  scheduleListDense: { gap: 2 },
  scheduleRow: { flex: 1, maxHeight: 52, minHeight: 32, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  scheduleRowDense: { height: 36, minHeight: 36, maxHeight: 36, flexGrow: 0, flexShrink: 0, flexBasis: 36 },
  scheduleMarker: { width: 24, height: 24, flexShrink: 0, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  scheduleTime: { width: 42, flexShrink: 0 },
  schedulePlace: { flex: 1, minWidth: 0 },
  scheduleFooter: { flexShrink: 0, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  emptySchedule: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  highlightSlide: { backgroundColor: colors.ink },
  highlightPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  highlightScrim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(15, 19, 18, 0.28)" },
  highlightTop: { position: "absolute", top: spacing.xl, left: spacing.lg, right: 72 },
  highlightCopy: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, gap: spacing.sm, padding: spacing.lg, borderRadius: radius.md, backgroundColor: "rgba(15, 19, 18, 0.72)" },
  ratingBadge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  dots: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  activeDot: { width: 20, backgroundColor: colors.primary },
});

import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type ImageStyle, type StyleProp } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { tripUsApiBaseUrl } from "@/shared/api/trip-us-api";
import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Screen } from "@/shared/ui/screen";
import { buildRecapSlides, recapModeLabel, recommendedRecapMode, type RecapMode, type RecapPhoto, type RecapSlide } from "./recap-model";
import { useTripRecap } from "./use-trip-recap";

const accents = [colors.primary, colors.secondary, "#D99A18", "#247A58"];

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
      : <View style={styles.routeHero}><AppText style={styles.routeEmoji}>✦</AppText><View style={styles.routeLine} /><AppText variant="title" color={colors.secondary}>여행의 장면을{`\n`}기록했어요</AppText></View>}
    <View style={styles.coverPaper}>
      <AppText variant="caption" color={colors.primary}>TripUS TRAVEL DIARY</AppText>
      <AppText variant="display">{slide.title}</AppText>
      <AppText color={colors.muted}>{slide.subtitle}</AppText>
    </View>
    {slide.photos.slice(1, 3).map((photo, index) => <Photo key={photo.id} photo={photo} accessToken={accessToken} style={[styles.coverThumb, index === 0 ? styles.thumbOne : styles.thumbTwo]} />)}
  </View>;
}

function RouteSlide({ slide }: { slide: Extract<RecapSlide, { kind: "route" }> }) {
  return <View style={[styles.slideBody, styles.paperSlide]}>
    <AppText variant="caption" color={colors.primary}>OUR ROUTE</AppText>
    <AppText variant="title">{slide.title}</AppText>
    <View style={styles.routePath}>
      {slide.days.map((day, index) => <View key={day.date} style={styles.routeDay}>
        <View style={[styles.dayDot, { backgroundColor: accents[index % accents.length] }]}><AppText variant="label" color={colors.white}>{day.dayNumber}</AppText></View>
        <View style={styles.routeCopy}><AppText variant="label">DAY {day.dayNumber} · {day.date.slice(5).replace("-", ".")}</AppText><AppText color={colors.muted} numberOfLines={2}>{day.items.map((item) => item.placeName).join(" → ") || "기록된 장소 없음"}</AppText></View>
      </View>)}
    </View>
    <View style={styles.postcard}><AppText variant="heading">{slide.days.reduce((sum, day) => sum + day.items.length, 0)}곳을 천천히 걸었어요</AppText><AppText color={colors.muted}>날짜별 동선과 기억을 한 장씩 넘겨보세요.</AppText></View>
  </View>;
}

function DaySlide({ slide, accessToken }: { slide: Extract<RecapSlide, { kind: "day" }>; accessToken?: string }) {
  const accent = accents[(slide.day.dayNumber - 1) % accents.length];
  return <View style={[styles.slideBody, styles.paperSlide]}>
    <View style={styles.dayTitle}><AppText variant="caption" color={accent}>DAY {slide.day.dayNumber} · {slide.day.date}</AppText><AppText variant="title" numberOfLines={2}>{slide.day.items.map((item) => item.placeName).slice(0, 3).join("에서 ") || "여행의 하루"}</AppText></View>
    {slide.photos.length > 0
      ? <View style={styles.dayPhotos}><Photo photo={slide.photos[0]} accessToken={accessToken} style={styles.dayMainPhoto} />{slide.photos[1] && <Photo photo={slide.photos[1]} accessToken={accessToken} style={styles.daySmallPhoto} />}</View>
      : <View style={[styles.noPhotoStory, { borderColor: accent }]}><AppText variant="title" color={accent}>DAY {slide.day.dayNumber}</AppText><View style={[styles.doodleLine, { backgroundColor: accent }]} /><AppText color={colors.muted}>사진 대신 그날의 동선과 메모를 담았어요.</AppText></View>}
    <View style={styles.timeline}>{slide.day.items.slice(0, 4).map((item, index) => <View key={item.id} style={styles.timelineRow}><View style={[styles.timelineIndex, { backgroundColor: accent }]}><AppText variant="caption" color={colors.white}>{index + 1}</AppText></View><View style={styles.routeCopy}><AppText variant="label">{item.placeName}</AppText>{item.review && <AppText variant="caption" color={colors.muted} numberOfLines={1}>{item.review}</AppText>}</View>{item.rating && <AppText variant="label" color={accent}>★ {item.rating}</AppText>}</View>)}</View>
    <View style={[styles.memory, { backgroundColor: `${accent}18` }]}><AppText variant="heading">“{slide.day.memory ?? "오래 기억하고 싶은 하루"}”</AppText>{slide.day.rating && <AppText variant="label" color={accent}>평균 ★ {slide.day.rating.toFixed(1)}</AppText>}</View>
  </View>;
}

function FavoritesSlide({ slide, accessToken }: { slide: Extract<RecapSlide, { kind: "favorites" }>; accessToken?: string }) {
  return <View style={[styles.slideBody, styles.paperSlide]}>
    <AppText variant="caption" color={colors.primary}>BEST MOMENTS</AppText><AppText variant="title">{slide.title}</AppText>
    <View style={styles.favoritePhotos}>{slide.photos.map((photo, index) => <Photo key={photo.id} photo={photo} accessToken={accessToken} style={[styles.favoritePhoto, { transform: [{ rotate: `${index % 2 ? 3 : -3}deg` }] }]} />)}{slide.photos.length === 0 && <View style={styles.favoriteEmpty}><AppText variant="title">♡</AppText><AppText color={colors.muted}>사진 없이도 기억은 남아요</AppText></View>}</View>
    <View style={styles.bestList}>{slide.places.map((place, index) => <View key={place.id} style={styles.bestRow}><AppText variant="caption" color={colors.primary}>BEST {index + 1}</AppText><AppText variant="heading" style={styles.bestName}>{place.placeName}</AppText><AppText variant="label">{place.rating ? `★ ${place.rating}` : "♥"}</AppText></View>)}</View>
    <View style={styles.closing}><AppText variant="heading">{slide.places.length}개의 베스트 · 사진 {slide.photoCount}장</AppText><AppText color={colors.muted}>다음 여행에서도 좋은 장면을 만나길.</AppText><AppText variant="caption" color={colors.primary}>made with TripUS</AppText></View>
  </View>;
}

function Slide({ slide, accessToken }: { slide: RecapSlide; accessToken?: string }) {
  if (slide.kind === "cover") return <CoverSlide slide={slide} accessToken={accessToken} />;
  if (slide.kind === "route") return <RouteSlide slide={slide} />;
  if (slide.kind === "day") return <DaySlide slide={slide} accessToken={accessToken} />;
  return <FavoritesSlide slide={slide} accessToken={accessToken} />;
}

export default function TripRecapPage() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { width: windowWidth } = useWindowDimensions();
  const { accessToken, addPhotos, error, itinerary, loading, photos, reload, trip, uploading } = useTripRecap(tripId);
  const [mode, setMode] = useState<RecapMode>();
  const [choosing, setChoosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const slideRefs = useRef<(ViewShotRef | null)[]>([]);
  const readyPhotos = useMemo(() => photos.filter((photo) => photo.status === "ready" && (photo.optimizedUrl || photo.originalUrl || photo.thumbnailUrl)), [photos]);
  const suggestedMode = recommendedRecapMode(readyPhotos.length);
  const effectiveMode = mode ?? (!choosing && readyPhotos.length >= 6 ? "photo-diary" : undefined);
  const slideWidth = Math.min(windowWidth - spacing.xl, 420);
  const slideHeight = slideWidth * 1.25;

  const slides = useMemo(() => trip && itinerary && effectiveMode
    ? buildRecapSlides({ trip, itinerary, photos: readyPhotos, mode: effectiveMode })
    : [], [effectiveMode, itinerary, readyPhotos, trip]);

  const captureSlide = async (index: number) => {
    const target = slideRefs.current[index];
    if (!target) throw new Error("이미지를 준비하지 못했어요.");
    return target.capture();
  };

  const shareCurrent = async () => {
    if (Platform.OS === "web") return Alert.alert("모바일에서 사용할 수 있어요", "캐러셀 공유는 iOS 또는 Android 앱에서 이용해 주세요.");
    setExporting(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error("이 기기에서는 공유 기능을 사용할 수 없어요.");
      const uri = await captureSlide(activeIndex);
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: `${activeIndex + 1}번째 여행 이미지 공유` });
    } catch (caught) {
      Alert.alert("공유하지 못했어요", caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요.");
    } finally { setExporting(false); }
  };

  const saveAll = async () => {
    if (Platform.OS === "web") return Alert.alert("모바일에서 사용할 수 있어요", "전체 저장은 iOS 또는 Android 앱에서 이용해 주세요.");
    setExporting(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) throw new Error("사진 앱 저장 권한이 필요해요.");
      for (let index = 0; index < slides.length; index += 1) {
        await MediaLibrary.Asset.create(await captureSlide(index));
      }
      Alert.alert("캐러셀을 저장했어요", `${slides.length}장을 순서대로 사진 앱에 저장했어요. 인스타그램에서 여러 장을 선택해 게시해 보세요.`);
    } catch (caught) {
      Alert.alert("저장하지 못했어요", caught instanceof Error ? caught.message : "잠시 후 다시 시도해 주세요.");
    } finally { setExporting(false); }
  };

  if (loading) return <Screen><Card><AppText color={colors.muted}>여행 캐러셀을 준비하는 중이에요…</AppText></Card></Screen>;
  if (error && (!trip || !itinerary)) return <Screen><Card><AppText color={colors.danger}>{error}</AppText><Button label="다시 시도" variant="ghost" onPress={() => void reload()} /></Card></Screen>;

  if (!effectiveMode) return <Screen>
    <AppText variant="title">어떤 여행 일기로 만들까요?</AppText>
    <AppText color={colors.muted}>등록된 사진은 {readyPhotos.length}장이에요. 사진 수에 맞는 구성을 골라드렸어요.</AppText>
    {error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}
    <Card style={styles.choiceCard}><AppText variant="caption" color={colors.primary}>추천</AppText><AppText variant="heading">{recapModeLabel(suggestedMode)}</AppText><AppText color={colors.muted}>{suggestedMode === "mixed" ? "있는 사진은 크게 쓰고 빈 장면은 동선과 후기로 채워요." : suggestedMode === "photo-diary" ? "등록한 사진을 날짜별 여행 일기로 풍성하게 배치해요." : "사진 없이 날짜별 동선과 장소 평가를 중심으로 만들어요."}</AppText><Button label={`${readyPhotos.length ? `${readyPhotos.length}장으로` : "사진 없이"} 만들기`} onPress={() => { setMode(suggestedMode); setChoosing(false); }} /></Card>
    <Button label={uploading ? "사진 추가 중…" : "사진 더 추가하기"} disabled={uploading} variant="secondary" onPress={() => void addPhotos()} />
    {readyPhotos.length > 0 && <Button label="동선 중심으로 만들기" variant="ghost" onPress={() => { setMode("route"); setChoosing(false); }} />}
  </Screen>;

  return <Screen contentStyle={styles.page}>
    <View style={styles.previewHeader}><View><AppText variant="title">캐러셀 미리보기</AppText><AppText color={colors.muted}>{recapModeLabel(effectiveMode)} · {slides.length}장</AppText></View><Button label="구성 변경" variant="ghost" style={styles.changeButton} onPress={() => { setMode(undefined); setChoosing(true); }} /></View>
    {error && <Card><AppText color={colors.danger}>{error}</AppText></Card>}
    <ScrollView horizontal pagingEnabled snapToInterval={slideWidth + spacing.md} decelerationRate="fast" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carousel} onMomentumScrollEnd={(event) => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / (slideWidth + spacing.md)))}>
      {slides.map((slide, index) => <ViewShot key={slide.id} style={[styles.slideFrame, { width: slideWidth, height: slideHeight }]} options={{ format: "png", quality: 1, result: "tmpfile" }} ref={(view) => { slideRefs.current[index] = view; }}><Slide slide={slide} accessToken={accessToken} /><View style={styles.pageNumber}><AppText variant="caption" color={colors.white}>{index + 1}/{slides.length}</AppText></View></ViewShot>)}
    </ScrollView>
    <View style={styles.dots}>{slides.map((slide, index) => <View key={slide.id} style={[styles.dot, activeIndex === index && styles.activeDot]} />)}</View>
    <Button label={exporting ? "이미지 준비 중…" : `전체 ${slides.length}장 사진 앱에 저장`} disabled={exporting} onPress={() => void saveAll()} />
    <Button label="현재 장 공유" variant="secondary" disabled={exporting} onPress={() => void shareCurrent()} />
    <AppText variant="caption" color={colors.muted}>인터넷 장소 사진은 사용하지 않아요. 등록한 여행 사진만 배치하며, 부족한 장면은 동선과 기록으로 구성합니다.</AppText>
  </Screen>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: spacing.md }, previewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }, changeButton: { minHeight: 44, paddingHorizontal: spacing.md }, choiceCard: { backgroundColor: colors.primarySoft }, carousel: { gap: spacing.md, paddingRight: spacing.md }, slideFrame: { overflow: "hidden", borderRadius: radius.lg, backgroundColor: "#FFF9EE" }, slideBody: { flex: 1, overflow: "hidden", backgroundColor: "#FFF9EE" }, paperSlide: { padding: spacing.lg, gap: spacing.md }, pageNumber: { position: "absolute", top: spacing.md, right: spacing.md, borderRadius: radius.pill, backgroundColor: "#272521AA", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }, coverPhoto: { width: "100%", height: "68%" }, coverPaper: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.xl, gap: spacing.xs, borderRadius: radius.md, backgroundColor: "#FFF9EEF2", padding: spacing.lg }, coverThumb: { position: "absolute", width: "27%", aspectRatio: 0.88, borderWidth: 5, borderColor: colors.white, borderRadius: radius.sm }, thumbOne: { right: spacing.lg, top: "48%", transform: [{ rotate: "5deg" }] }, thumbTwo: { right: "29%", top: "51%", transform: [{ rotate: "-4deg" }] }, routeHero: { height: "68%", justifyContent: "center", padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.secondarySoft }, routeEmoji: { fontSize: 72, color: colors.primary }, routeLine: { width: "72%", height: 5, borderRadius: radius.pill, backgroundColor: colors.primary, transform: [{ rotate: "-7deg" }] }, routePath: { flex: 1, justifyContent: "center", gap: spacing.md }, routeDay: { flexDirection: "row", alignItems: "center", gap: spacing.md }, dayDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" }, routeCopy: { flex: 1 }, postcard: { borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: spacing.md, gap: spacing.xs, transform: [{ rotate: "-1deg" }] }, dayTitle: { paddingRight: spacing.xl, gap: spacing.xs }, dayPhotos: { height: "39%" }, dayMainPhoto: { width: "74%", height: "100%", borderRadius: radius.md }, daySmallPhoto: { position: "absolute", right: 0, bottom: -spacing.sm, width: "38%", height: "68%", borderRadius: radius.md, borderWidth: 5, borderColor: "#FFF9EE", transform: [{ rotate: "4deg" }] }, noPhotoStory: { height: "27%", borderWidth: 2, borderStyle: "dashed", borderRadius: radius.md, padding: spacing.lg, justifyContent: "center", gap: spacing.sm }, doodleLine: { width: "70%", height: 4, borderRadius: radius.pill, transform: [{ rotate: "-4deg" }] }, timeline: { gap: spacing.sm }, timelineRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, timelineIndex: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" }, memory: { marginTop: "auto", borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }, favoritePhotos: { minHeight: "38%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: -spacing.md }, favoritePhoto: { width: "34%", aspectRatio: 0.82, borderWidth: 5, borderColor: colors.white, borderRadius: radius.sm }, favoriteEmpty: { width: "100%", minHeight: 160, borderRadius: radius.md, backgroundColor: colors.secondarySoft, alignItems: "center", justifyContent: "center", gap: spacing.sm }, bestList: { gap: spacing.sm }, bestRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: spacing.sm }, bestName: { flex: 1 }, closing: { marginTop: "auto", gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.primarySoft, padding: spacing.md }, dots: { flexDirection: "row", justifyContent: "center", gap: spacing.xs }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line }, activeDot: { width: 20, backgroundColor: colors.primary },
});

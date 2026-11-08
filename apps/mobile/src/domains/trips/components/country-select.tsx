import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing } from "@/shared/design/tokens";
import { AppText } from "@/shared/ui/app-text";
import { Button } from "@/shared/ui/button";
import { searchTravelCountries, type TravelCountry } from "./country-options";

type CountrySelectProps = {
  value: TravelCountry;
  onChange: (country: TravelCountry) => void;
  testID?: string;
};

export function CountrySelect({ value, onChange, testID }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = useMemo(() => searchTravelCountries(query), [query]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`여행 국가 선택, 현재 ${value.name}`}
      onPress={() => setOpen(true)}
      style={styles.select}
      testID={testID}
    >
      <AppText style={styles.flag}>{value.flag}</AppText>
      <View style={styles.valueText}>
        <AppText variant="label">{value.name}</AppText>
        <AppText variant="caption" color={colors.muted}>{value.englishName}</AppText>
      </View>
      <AppText color={colors.muted}>⌄</AppText>
    </Pressable>
    <Modal animationType="slide" presentationStyle="pageSheet" visible={open} onRequestClose={close}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.header}>
          <AppText variant="title">여행 국가 선택</AppText>
          <Button label="닫기" variant="ghost" onPress={close} />
        </View>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onChangeText={setQuery}
          placeholder="국가명 검색 (예: 일본, Japan)"
          style={styles.searchInput}
          testID="country-search-input"
          value={query}
        />
        <AppText variant="caption" color={colors.muted}>검색 결과 {options.length}개</AppText>
        <FlatList
          data={options}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.code}
          ListEmptyComponent={<AppText color={colors.muted}>일치하는 국가가 없어요.</AppText>}
          renderItem={({ item }) => <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: item.code === value.code }}
            onPress={() => { onChange(item); close(); }}
            style={[styles.option, item.code === value.code && styles.selectedOption]}
            testID={`country-option-${item.code}`}
          >
            <AppText style={styles.flag}>{item.flag}</AppText>
            <View style={styles.valueText}>
              <AppText variant="label">{item.name}</AppText>
              <AppText variant="caption" color={colors.muted}>{item.englishName} · {item.timezone}</AppText>
            </View>
          </Pressable>}
        />
      </SafeAreaView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  select: { minHeight: 58, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.canvas, paddingHorizontal: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flag: { fontSize: 24 },
  valueText: { flex: 1 },
  modal: { flex: 1, backgroundColor: colors.canvas, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  searchInput: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: spacing.md, fontSize: 16, color: colors.ink },
  option: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  selectedOption: { backgroundColor: colors.primarySoft, borderRadius: radius.sm },
});

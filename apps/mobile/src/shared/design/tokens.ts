/** Figma: 여행의 여백 · Field Notes / FOUNDATIONS. */
export const colors = {
  canvas: "#F7F4ED", surface: "#FFFCF6", ink: "#282C29", muted: "#6B706A",
  line: "#DCDDD2", primary: "#AD412D", primaryPressed: "#913624",
  primarySoft: "#EEDDD2", secondary: "#4B6556", secondarySoft: "#E5E9DF",
  success: "#4B6556", warning: "#98621E", danger: "#AD412D", white: "#FFFFFF",
} as const;
export const spacing = { xs: 4, sm: 8, compact: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 14, pill: 999 } as const;
export const fonts = { serif: "NotoSerifKR", sans: "NotoSansKR" } as const;
export const typography = {
  display: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 44, fontWeight: "400" as const },
  title: { fontFamily: fonts.serif, fontSize: 20, lineHeight: 30, fontWeight: "700" as const },
  heading: { fontFamily: fonts.sans, fontSize: 17, lineHeight: 26, fontWeight: "700" as const },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 24, fontWeight: "400" as const },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 20, fontWeight: "400" as const },
  label: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 22, fontWeight: "500" as const },
  micro: { fontFamily: fonts.sans, fontSize: 11, lineHeight: 18, fontWeight: "400" as const },
} as const;
export const touch = { minimum: 44, mainAction: 50, icon: 20 } as const;

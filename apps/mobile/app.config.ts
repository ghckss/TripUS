import type { ConfigContext, ExpoConfig } from "expo/config";

import baseConfig from "./app.json";

type TripUsAppVariant = "development" | "preview" | "production";

const appVariants = {
  development: {
    androidPackage: "com.tripus.app.dev",
    name: "TripUS Dev",
    scheme: "tripus-dev",
  },
  preview: {
    androidPackage: "com.tripus.app.preview",
    name: "TripUS Preview",
    scheme: "tripus-preview",
  },
  production: {
    androidPackage: "com.tripus.app",
    name: "TripUS",
    scheme: "tripus",
  },
} satisfies Record<TripUsAppVariant, { androidPackage: string; name: string; scheme: string }>;

function resolveAppVariant(value = process.env.TRIPUS_APP_VARIANT) {
  if (value === undefined || value.length === 0) return { ...appVariants.development, variant: "development" as const };
  if (value === "development" || value === "preview" || value === "production") {
    return { ...appVariants[value], variant: value };
  }
  throw new Error(`TRIPUS_APP_VARIANT must be one of development, preview, production; received ${value}`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const enableAppleSignIn = process.env.EAS_BUILD === "true" || process.env.TRIPUS_ENABLE_APPLE_SIGN_IN === "true";
  const expo = baseConfig.expo as ExpoConfig;
  const appVariant = resolveAppVariant();
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const iosGoogleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const iosGoogleUrlScheme = iosGoogleClientId
    ?.replace(/\.apps\.googleusercontent\.com$/, "")
    .replace(/^(.*)$/, "com.googleusercontent.apps.$1");
  const plugins = enableAppleSignIn
    ? [...(expo.plugins ?? [])]
    : ["./plugins/without-local-apple-sign-in", ...(expo.plugins ?? [])];

  plugins.push([
    "react-native-maps",
    {
      ...(iosGoogleMapsApiKey ? { iosGoogleMapsApiKey } : {}),
      ...(androidGoogleMapsApiKey ? { androidGoogleMapsApiKey } : {}),
    },
  ]);
  plugins.push("expo-sharing");
  if (iosGoogleUrlScheme) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: iosGoogleUrlScheme },
    ]);
  }
  plugins.push([
    "expo-media-library",
    {
      photosPermission: "TripUS가 여행 사진을 캐러셀에 배치할 수 있도록 사진 접근을 허용해 주세요.",
      savePhotosPermission: "TripUS가 완성한 여행 캐러셀을 사진 앱에 저장하도록 허용해 주세요.",
      isAccessMediaLocationEnabled: false,
    },
  ]);

  return {
    ...config,
    ...expo,
    name: appVariant.name,
    scheme: appVariant.scheme,
    android: {
      ...expo.android,
      package: appVariant.androidPackage,
    },
    ios: {
      ...expo.ios,
      usesAppleSignIn: enableAppleSignIn,
      infoPlist: {
        ...expo.ios?.infoPlist,
        NSLocationWhenInUseUsageDescription: "TripUS에서 여행 장소와 현재 위치를 지도에 표시하도록 위치 접근을 허용해 주세요.",
      },
    },
    extra: {
      ...expo.extra,
      appVariant: appVariant.variant,
      enableAppleSignIn,
    },
    plugins,
  };
};

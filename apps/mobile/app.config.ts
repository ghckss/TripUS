import type { ConfigContext, ExpoConfig } from "expo/config";

import baseConfig from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const enableAppleSignIn = process.env.EAS_BUILD === "true" || process.env.TRIPUS_ENABLE_APPLE_SIGN_IN === "true";
  const expo = baseConfig.expo as ExpoConfig;
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
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
      enableAppleSignIn,
    },
    plugins,
  };
};

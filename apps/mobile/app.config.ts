import type { ConfigContext, ExpoConfig } from "expo/config";

import baseConfig from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const enableAppleSignIn = process.env.EAS_BUILD === "true" || process.env.TRIPUS_ENABLE_APPLE_SIGN_IN === "true";
  const expo = baseConfig.expo as ExpoConfig;

  return {
    ...config,
    ...expo,
    ios: {
      ...expo.ios,
      usesAppleSignIn: enableAppleSignIn,
    },
    extra: {
      ...expo.extra,
      enableAppleSignIn,
    },
    plugins: enableAppleSignIn
      ? expo.plugins
      : ["./plugins/without-local-apple-sign-in", ...(expo.plugins ?? [])],
  };
};

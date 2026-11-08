const {
  AndroidConfig,
  withAndroidManifest,
  withInfoPlist,
} = require('expo/config-plugins');

const DEV_MENU_FAB_KEY = 'EXDevMenuShowFloatingActionButton';

const withHiddenAndroidDevMenuFab = (config) =>
  withAndroidManifest(config, (androidConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      androidConfig.modResults,
    );

    application['meta-data'] = application['meta-data'] ?? [];

    const existingEntry = application['meta-data'].find(
      (entry) => entry.$?.['android:name'] === DEV_MENU_FAB_KEY,
    );

    if (existingEntry) {
      existingEntry.$['android:value'] = 'false';
    } else {
      application['meta-data'].push({
        $: {
          'android:name': DEV_MENU_FAB_KEY,
          'android:value': 'false',
        },
      });
    }

    return androidConfig;
  });

const withHiddenIosDevMenuFab = (config) =>
  withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults[DEV_MENU_FAB_KEY] = false;
    return iosConfig;
  });

module.exports = (config) =>
  withHiddenIosDevMenuFab(withHiddenAndroidDevMenuFab(config));

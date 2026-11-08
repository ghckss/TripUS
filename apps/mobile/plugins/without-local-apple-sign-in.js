const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = (config) =>
  withEntitlementsPlist(config, (iosConfig) => {
    delete iosConfig.modResults['com.apple.developer.applesignin'];
    return iosConfig;
  });

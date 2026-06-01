const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const mainApplication = nextConfig.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$ = {
        ...mainApplication.$,
        'android:usesCleartextTraffic': 'true',
      };
    }

    return nextConfig;
  });
};

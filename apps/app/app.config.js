const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

module.exports = () => {
  const config = JSON.parse(JSON.stringify(appJson.expo));
  config.android = {
    ...config.android,
    usesCleartextTraffic: true,
  };
  config.plugins = [
    ...(config.plugins ?? []),
    './plugins/withAndroidCleartextTraffic.js',
  ];

  const iosBundleIdentifier = process.env.EXPO_IOS_BUNDLE_IDENTIFIER;
  const androidPackage = process.env.EXPO_ANDROID_PACKAGE;
  const googleServicesFile =
    process.env.EXPO_GOOGLE_SERVICES_FILE || './google-services.json';
  const googleServicesPath = path.resolve(__dirname, googleServicesFile);

  if (iosBundleIdentifier) {
    config.ios = {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
    };
  }

  if (androidPackage) {
    config.android = {
      ...config.android,
      package: androidPackage,
    };
  }

  if (fs.existsSync(googleServicesPath)) {
    config.android = {
      ...config.android,
      googleServicesFile,
    };
  }

  return { expo: config };
};

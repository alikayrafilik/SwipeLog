const baseConfig = require('./app.json');

module.exports = () => ({
  ...baseConfig.expo,
  android: {
    ...baseConfig.expo.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  ios: {
    ...baseConfig.expo.ios,
    ...(process.env.GOOGLE_SERVICE_INFO_PLIST
      ? { googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST }
      : {}),
  },
});

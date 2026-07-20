module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  ios: {
    ...config.ios,
    ...(process.env.GOOGLE_SERVICE_INFO_PLIST
      ? { googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST }
      : {}),
  },
});

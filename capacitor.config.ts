// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CapacitorConfig = any;

const config: CapacitorConfig = {
  appId: 'com.mgr.fieldapp',
  appName: 'MGR Campo',
  webDir: 'dist',
  // Live Update: carrega do Firebase Hosting em vez do bundle local.
  // Cada deploy firebase → app atualiza automaticamente sem novo APK.
  server: {
    url: 'https://mgr-connect-app.web.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // true só em dev
  },
  plugins: {
    Geolocation: {
      // Android: requer ACCESS_FINE_LOCATION + ACCESS_BACKGROUND_LOCATION
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      saveToGallery: false,
    },
  },
};

export default config;

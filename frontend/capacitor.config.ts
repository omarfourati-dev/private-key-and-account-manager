import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.keyvault.app',
  appName: 'KeyVault',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For development, point to local backend:
    // url: 'http://10.0.2.2:4000',
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#080812',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#080812',
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uniplug.app',
  appName: 'uniplug',
  webDir: 'dist',
  server: {
    url: 'https://83f62de6-ce52-416e-942a-7a56f8c633e2.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maniasstudio.jarvis',
  appName: 'Jarvis',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'jarvisapp',
  },
};

export default config;

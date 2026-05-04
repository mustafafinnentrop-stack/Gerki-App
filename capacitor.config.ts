import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'de.gerki.app',
  appName: 'Gerki',
  webDir: 'out/renderer',
  server: {
    androidScheme: 'https',
    // Verwende die Vercel-URL als Live-Quelle
    url: 'https://www.gerki.app/app/index.html',
    cleartext: false,
    allowNavigation: ['*']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;

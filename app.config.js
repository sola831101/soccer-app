module.exports = {
  expo: {
    name: 'サカログ',
    slug: 'soccer-app',
    version: '1.1.2',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'soccer-app',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#2E7D32',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.soccerapp.manager',
      buildNumber: '33',
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSUserTrackingUsageDescription:
          'より関連性の高い広告を表示するために使用します。許可しなくても引き続きアプリをご利用いただけます。',
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#2E7D32',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      package: 'com.soccerapp.manager',
      versionCode: 9,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-router',
      '@sentry/react-native/expo',
      '@react-native-community/datetimepicker',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-0602124451776857~3749576966',
          iosAppId: 'ca-app-pub-0602124451776857~6056176108',
        },
      ],
    ],
    extra: {
      router: {},
      eas: {
        projectId: '16c31cd1-bc17-428b-8715-49f89023a680',
      },
      rcApiKeyIos: process.env.RC_API_KEY_IOS ?? '',
      sentryDsn: process.env.SENTRY_DSN ?? '',
    },
    owner: 'sola1101',
  },
};

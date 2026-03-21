import React, { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { spacing } from '../constants/theme';

const BANNER_ID = Platform.select({
  ios: 'ca-app-pub-0602124451776857/5549743790',
  android: 'ca-app-pub-0602124451776857/1075312165',
}) ?? '';

let BannerAdComponent: React.ComponentType<any> | null = null;
let BannerAdSize: any = null;

try {
  const ads = require('react-native-google-mobile-ads');
  BannerAdComponent = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
} catch {
  // Expo Go: module not available
}

export function AdBanner() {
  const [failed, setFailed] = useState(false);

  if (!BannerAdComponent || !BannerAdSize || failed) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAdComponent
        unitId={BANNER_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
});

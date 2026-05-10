import React, { useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { spacing } from '../constants/theme';

const BANNER_ID = Platform.select({
  ios: 'ca-app-pub-0602124451776857/5549743790',
  android: 'ca-app-pub-0602124451776857/1075312165',
}) ?? '';

// サッカー・スポーツ関連のキーワードターゲティング
const SPORTS_KEYWORDS = [
  'soccer', 'football', 'sports', 'サッカー', 'フットボール',
  'クラブチーム', 'スポーツ', 'ジュニアサッカー', 'スポーツ少年団',
  '少年サッカー', 'スポーツ用品', 'サッカースクール',
];

const REQUEST_OPTIONS = {
  keywords: SPORTS_KEYWORDS,
};

let BannerAdComponent: React.ComponentType<any> | null = null;
let BannerAdSize: any = null;

try {
  const ads = require('react-native-google-mobile-ads');
  BannerAdComponent = ads.BannerAd;
  BannerAdSize = ads.BannerAdSize;
} catch {
  // Expo Go: module not available
}

interface AdBannerProps {
  /** MEDIUM_RECTANGLE (300×250) を使う場合は true。動画エリアの代替などに */
  rectangle?: boolean;
}

export function AdBanner({ rectangle = false }: AdBannerProps) {
  const [failed, setFailed] = useState(false);

  if (!BannerAdComponent || !BannerAdSize || failed) {
    return null;
  }

  const size = rectangle ? BannerAdSize.MEDIUM_RECTANGLE : BannerAdSize.ANCHORED_ADAPTIVE_BANNER;

  return (
    <View style={[styles.container, rectangle && styles.containerRect]}>
      <BannerAdComponent
        unitId={BANNER_ID}
        size={size}
        requestOptions={REQUEST_OPTIONS}
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
  containerRect: {
    marginVertical: spacing.md,
    borderRadius: 8,
    overflow: 'hidden',
  },
});

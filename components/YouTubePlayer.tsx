import React from 'react';
import { View, StyleSheet } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { borderRadius } from '../constants/theme';

interface Props {
  url: string;
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s]+)/,
    /(?:youtu\.be\/)([^?\s]+)/,
    /(?:youtube\.com\/embed\/)([^?\s]+)/,
    /(?:youtube\.com\/shorts\/)([^?\s]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function YouTubePlayer({ url }: Props) {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={200}
        videoId={videoId}
        webViewProps={{ allowsInlineMediaPlayback: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
});

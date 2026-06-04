import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PhotoViewerProps {
  visible: boolean;
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  onDelete?: (url: string) => void;
}

// 全画面の写真ビューア。複数枚は横フリックで切り替え。
export function PhotoViewer({ visible, photos, initialIndex, onClose, onDelete }: PhotoViewerProps) {
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const [index, setIndex] = useState(initialIndex);

  // 開いたとき・初期indexが変わったときに同期
  useEffect(() => {
    if (visible) setIndex(initialIndex);
  }, [visible, initialIndex]);

  // 削除等でphotosが縮んだらindexをクランプ
  useEffect(() => {
    if (photos.length === 0) return;
    if (index > photos.length - 1) setIndex(photos.length - 1);
  }, [photos.length, index]);

  const current = photos[index];

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          data={photos}
          keyExtractor={(url, i) => `${i}-${url}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          onScrollToIndexFailed={({ index: i }) => {
            setTimeout(() => listRef.current?.scrollToIndex({ index: i, animated: false }), 50);
          }}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            if (i !== index) setIndex(i);
          }}
          renderItem={({ item }) => (
            <View style={{ width, height, justifyContent: 'center', alignItems: 'center' }}>
              <Image source={{ uri: item }} style={{ width, height: height * 0.85 }} resizeMode="contain" />
            </View>
          )}
        />

        {/* 上部オーバーレイ：閉じる / ページ表示 / 削除 */}
        <View style={styles.topBar} pointerEvents="box-none">
          <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          {photos.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>{index + 1} / {photos.length}</Text>
            </View>
          )}

          {onDelete && current ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => onDelete(current)} hitSlop={10}>
              <Ionicons name="trash-outline" size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>

        {/* 複数枚のヒント（ドットインジケータ） */}
        {photos.length > 1 && (
          <View style={styles.dots} pointerEvents="none">
            {photos.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  counterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dots: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

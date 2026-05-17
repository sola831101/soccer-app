import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
// React Native 環境では @firebase/auth から直接 import する必要がある。
// firebase/auth の package.json には `react-native` 条件付き export が無いため、
// Web向けバンドルが読まれてしまい getReactNativePersistence が undefined になる。
// @firebase/auth には `react-native` 条件があり、Metro が dist/rn を選んで読み込む。
// 型定義からは getReactNativePersistence が削除されているがランタイムでは存在するため @ts-expect-error で抑制。
// @ts-expect-error: getReactNativePersistence is available at runtime in RN entry (dist/rn)
import { initializeAuth, getReactNativePersistence } from '@firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAw1nsoqUB7w6J-YJLQQGVu8KF0BR6dmRM",
  authDomain: "soccer-app-93aa4.firebaseapp.com",
  projectId: "soccer-app-93aa4",
  storageBucket: "soccer-app-93aa4.firebasestorage.app",
  messagingSenderId: "216191974959",
  appId: "1:216191974959:web:04723c2ad4efee2cd510da"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
// React Native ではセッションをAsyncStorageに永続化する（アプリキル後もログイン維持）
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const storage = getStorage(app);

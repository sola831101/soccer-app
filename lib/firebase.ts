import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
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

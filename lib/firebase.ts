import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAw1nsoqUB7w6J-YJLQQGVu8KF0BR6dmRM",
  authDomain: "soccer-app-93aa4.firebaseapp.com",
  projectId: "soccer-app-93aa4",
  storageBucket: "soccer-app-93aa4.firebasestorage.app",
  messagingSenderId: "216191974959",
  appId: "1:216191974959:web:04723c2ad4efee2cd510da"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

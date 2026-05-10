import { Platform } from 'react-native';
import {
  OAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  User,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';

const fns = getFunctions();

// ============================
// Email OTP 認証
// ============================

const FUNCTIONS_BASE = 'https://us-central1-soccer-app-93aa4.cloudfunctions.net';

export async function sendOTP(email: string): Promise<void> {
  const res = await fetch(`${FUNCTIONS_BASE}/sendOTP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'メール送信に失敗しました');
  }
}

export async function verifyOTPAndSignIn(email: string, code: string): Promise<string> {
  const res = await fetch(`${FUNCTIONS_BASE}/verifyOTP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error(`サーバーエラー: ${text.slice(0, 100)}`); }
  if (!res.ok) throw new Error(data.error ?? 'コードの確認に失敗しました');
  await signInWithEmailAndPassword(auth, email, data.tempPassword);
  return data.uid;
}

export async function linkEmailToCurrentUser(email: string, code: string, teamId?: string): Promise<void> {
  const fn = httpsCallable<any, { uid: string; tempPassword: string }>(fns, 'linkEmailToUser');
  const result = await fn({ email, code, teamId: teamId ?? '' });
  // 匿名セッションから非匿名セッションへ移行（再起動後もモーダルが出ないようにする）
  await signInWithEmailAndPassword(auth, email, result.data.tempPassword);
}

// ============================
// Apple Sign-In (iOS only)
// ============================

export async function linkWithApple(currentUser: User): Promise<User> {
  const nonce = Math.random().toString(36).substring(2, 10);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const provider = new OAuthProvider('apple.com');
  const oAuthCredential = provider.credential({
    idToken: appleCredential.identityToken!,
    rawNonce: nonce,
  });

  const result = await linkWithCredential(currentUser, oAuthCredential);
  return result.user;
}

export async function signInWithApple(): Promise<User> {
  const nonce = Math.random().toString(36).substring(2, 10);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    nonce
  );

  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  const provider = new OAuthProvider('apple.com');
  const oAuthCredential = provider.credential({
    idToken: appleCredential.identityToken!,
    rawNonce: nonce,
  });

  const result = await signInWithCredential(auth, oAuthCredential);
  return result.user;
}

// ============================
// Google Sign-In
// ============================

// Note: Google Sign-In requires setting up OAuth client IDs in
// Firebase Console > Authentication > Sign-in method > Google
// and in Google Cloud Console for the Expo proxy redirect URI.
// The GOOGLE_CLIENT_ID below should be replaced with the actual Web client ID.
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

export async function linkWithGoogle(currentUser: User): Promise<User> {
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'success' && result.params.id_token) {
    const credential = GoogleAuthProvider.credential(result.params.id_token);
    const linkResult = await linkWithCredential(currentUser, credential);
    return linkResult.user;
  }

  throw new Error('Google Sign-In was cancelled');
}

export async function signInWithGoogle(): Promise<User> {
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'success' && result.params.id_token) {
    const credential = GoogleAuthProvider.credential(result.params.id_token);
    const signInResult = await signInWithCredential(auth, credential);
    return signInResult.user;
  }

  throw new Error('Google Sign-In was cancelled');
}

// ============================
// Utility
// ============================

export function isAnonymous(user: User | null): boolean {
  return user?.isAnonymous ?? true;
}

export function getLinkedProviders(user: User | null): string[] {
  if (!user) return [];
  return user.providerData.map((p) => p.providerId);
}

export function isAppleAvailable(): boolean {
  return Platform.OS === 'ios';
}

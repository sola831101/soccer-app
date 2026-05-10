import { Platform } from 'react-native';
import Constants from 'expo-constants';

// APIキーはEAS Secrets経由で app.config.js の extra に注入される
const RC_API_KEY_IOS: string = Constants.expoConfig?.extra?.rcApiKeyIos ?? '';

const isExpoGo = Constants.appOwnership === 'expo';

let Purchases: any = null;
let LOG_LEVEL: any = null;

if (!isExpoGo) {
  try {
    const mod = require('react-native-purchases');
    Purchases = mod.default;
    LOG_LEVEL = mod.LOG_LEVEL;
  } catch {}
}

export type PurchasesOffering = any;
export type PurchasesPackage = any;
export type CustomerInfo = any;

const RC_API_KEY_ANDROID = '';

// App Store Connect の製品ID（後で設定）
// Entitlement identifier（RevenueCat ダッシュボードで設定）
export const PREMIUM_ENTITLEMENT_ID = 'premium';

let configured = false;

export function isConfigured(): boolean {
  if (isExpoGo || !Purchases) return false;
  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  return apiKey.length > 0;
}

export async function configurePurchases(userId: string): Promise<void> {
  if (!isConfigured()) return; // APIキー未設定時はスキップ

  if (configured) {
    await Purchases.logIn(userId);
    return;
  }

  if (__DEV__) {
    await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
  await Purchases.configure({ apiKey, appUserID: userId });
  configured = true;

  await Purchases.logIn(userId);
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isConfigured()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.error('[Purchases] getOfferings error:', e);
    return null;
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isConfigured()) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    console.error('[Purchases] getCustomerInfo error:', e);
    return null;
  }
}

export function isPremiumCustomer(customerInfo: CustomerInfo): boolean {
  return customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] != null;
}

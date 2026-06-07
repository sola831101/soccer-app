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

// ---- パッケージ表示用ヘルパー（RevenueCat の型は any 扱いのため集約）----

export type PackagePeriod = 'year' | 'month' | 'other';

export function getPackagePeriod(pkg: PurchasesPackage): PackagePeriod {
  const t = pkg?.packageType;
  if (t === 'ANNUAL') return 'year';
  if (t === 'MONTHLY') return 'month';
  return 'other';
}

export function getPackagePriceString(pkg: PurchasesPackage): string {
  return pkg?.product?.priceString ?? '';
}

export function getPackagePrice(pkg: PurchasesPackage): number {
  const p = pkg?.product?.price;
  return typeof p === 'number' ? p : 0;
}

// 無料トライアルの日数を返す（無料トライアルが無い/有料イントロの場合は null）
export function getFreeTrialDays(pkg: PurchasesPackage): number | null {
  const ip = pkg?.product?.introPrice;
  if (!ip) return null;
  // 価格0のイントロ＝無料トライアルのみ対象
  if (Number(ip.price) !== 0) return null;
  const unit = ip.periodUnit; // 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
  const n = ip.periodNumberOfUnits ?? 0;
  const mult = unit === 'DAY' ? 1 : unit === 'WEEK' ? 7 : unit === 'MONTH' ? 30 : unit === 'YEAR' ? 365 : 0;
  const days = n * mult;
  return days > 0 ? days : null;
}

// 同期処理用のrestorePurchases。失敗時はnullを返す（getCustomerInfo と同じインターフェース）。
// getCustomerInfo() と違い、Apple Receipt を再検証して RevenueCat 側の appUserID と
// 紐づけ直すため、UID不一致で entitlement が見えていないケースを救える。
// iOS では Apple ID 認証プロンプトが出る可能性がある（ユーザーが意図的に押す場合のみ呼ぶ）。
export async function restorePurchasesSafe(): Promise<CustomerInfo | null> {
  if (!isConfigured()) return null;
  try {
    return await Purchases.restorePurchases();
  } catch (e) {
    console.error('[Purchases] restorePurchasesSafe error:', e);
    return null;
  }
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

// 3値で課金状態を返す。Firestoreのplan反映判定で誤動作を避けるため厳格に。
// - active : 現在entitlementが有効（支払い継続中 or 解約後の期間内、grace period含む）
// - expired: 過去にentitlementを保有したが現在無効（解約後の期限切れ or 支払い失敗）
// - never  : 一度も購入していない
//
// 前提: RevenueCat SDK の customerInfo.entitlements.active には「期限内かつ有効」な
// entitlement のみが含まれる（grace period も active 扱い）。expires_date を直接見ずに
// active / all の存在のみで判定する。
export type PremiumStatus = 'active' | 'expired' | 'never';

export function getPremiumStatus(customerInfo: CustomerInfo): PremiumStatus {
  const ents = customerInfo?.entitlements;
  if (!ents) return 'never';
  if (ents.active?.[PREMIUM_ENTITLEMENT_ID]) return 'active';
  // RevenueCatの `all` には期限切れentitlementも残る（過去に1度でも有効化されたものすべて）
  if (ents.all?.[PREMIUM_ENTITLEMENT_ID]) return 'expired';
  return 'never';
}

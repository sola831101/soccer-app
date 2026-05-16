# サカログ - プロジェクトドキュメント

少年サッカーの試合記録・成績管理アプリ。保護者・コーチが試合結果を記録し、チームで共有できる。

- プラットフォーム: iOS（メイン）/ Android
- Bundle ID: `com.soccerapp.manager`
- App Store ID: `6760473038`
- GitHub Pages: https://sola831101.github.io/soccer-app/

---

## 技術スタック

| カテゴリ | 採用技術 | バージョン |
|---|---|---|
| Frontend | React Native (Expo) | expo ~54.0.0 |
| ルーティング | expo-router | ~6.0.23 |
| Database | Firebase Firestore | firebase ^12.10.0 |
| Auth | Firebase Auth + Apple Sign-In + OTPメール | — |
| Backend | Firebase Functions (Node.js / TypeScript) | — |
| IAP（課金） | RevenueCat | react-native-purchases ^10.0.1 |
| エラー監視 | Sentry | @sentry/react-native ~7.2.0 |
| 広告 | Google AdMob | react-native-google-mobile-ads ^16.2.1 |
| ビルド | EAS Build | appVersionSource: local |
| Webページ | GitHub Pages | main/docs/ を自動デプロイ |

---

## 外部サービス一覧

| サービス | 用途 | 識別情報 |
|---|---|---|
| Firebase | DB / Auth / Functions | Project: `soccer-app-93aa4` |
| EAS | ビルド・配信 | projectId: `16c31cd1-bc17-428b-8715-49f89023a680` |
| App Store Connect | iOS配信 | Apple ID: aamedayona@gmail.com / App ID: `6760473038` |
| RevenueCat | サブスク・IAP管理 | — |
| Sentry | エラー監視 | — |
| Google AdMob | 広告収益 | iOS: `ca-app-pub-0602124451776857~6056176108` |
| Gmail (SMTP) | OTPメール送信 | Nodemailer経由、500通/日上限あり |
| GitHub Pages | サポートWebページ | `sola831101/soccer-app` main/docs/ |

---

## 環境変数・シークレット

| 変数名 | 場所 | 用途 |
|---|---|---|
| `GMAIL_USER` | `functions/.env` | OTPメール送信用Gmailアドレス |
| `GMAIL_PASS` | `functions/.env` | Gmailアプリパスワード |
| `RC_API_KEY_IOS` | EAS secrets / `.env.local` | RevenueCat iOS APIキー |
| `SENTRY_DSN` | EAS secrets / `.env.local` | Sentry DSN |

### gitignore に含まれる重要ファイル

| ファイル | 理由 |
|---|---|
| `GoogleService-Info.plist` | APIキーを含む。ビルドには**未使用**（Firebase JS SDK使用のため）|
| `functions/backup-firestore.js` | バックアップツール、リリース対象外 |
| `functions/firestore-backup-*.json` | バックアップデータ、リポジトリ管理対象外 |
| `ios/sentry.properties` | Sentryの認証情報 |
| `backups/` | ローカルバックアップ |

---

## 開発ルール

### EASビルド
- **クレジット節約が最優先。EASビルドは本当に必要な時だけ使う**
- UI変更の確認は Expo Go またはXcodeローカルビルド（`npx expo run:ios`）で行う
- ネイティブモジュール変更時のみEAS Buildが必須

### expo prebuild
- `app.config.js` を変更したら必ず `npx expo prebuild --platform ios` を実行してから Xcode で Archive
- prebuild しないと ios/Info.plist のバージョン等が古いまま

### Firebase Rules デプロイ
- **`firestore.rules` を変更しても git push だけでは本番に反映されない**
- 変更後は必ず以下を実行:
  ```bash
  npx firebase deploy --only firestore:rules
  ```

### Git / リリース
- `~/Projects/production/sakalog` は本番公開中。デプロイ・削除・上書きは事前確認
- git commit / push、外部APIへのリクエストは必ず確認してから実行

---

## リリース手順（iOS）

1. 機能開発・UI変更をXcodeローカルビルドまたはExpo Goで確認
2. `app.config.js` の `version` と `buildNumber` を更新
3. 変更をコミット＆ `git push origin main`
4. `npx expo prebuild --platform ios` を実行
5. Xcode → 「Any iOS Device」に切り替え → Product → Archive
6. Organizer → Distribute App → App Store Connect → Upload
7. TestFlight で動作確認（新機能が多い場合は特に念入りに）
8. App Store Connect → 新バージョン作成 → 審査提出
9. **審査通過・公開後**に必要なFirestore設定を更新（下記参照）

### バージョン管理

| 項目 | ファイル | フィールド |
|---|---|---|
| アプリバージョン | `app.config.js` | `version` |
| iOSビルド番号 | `app.config.js` | `ios.buildNumber` |
| AndroidバージョンCode | `app.config.js` | `android.versionCode` |

---

## Firestore 重要ドキュメント

### `config/app_version`（強制アップデート機構）

| フィールド | 型 | 説明 |
|---|---|---|
| `minimumIosVersion` | string | このバージョン未満に強制アップデートを要求 |
| `minimumAndroidVersion` | string | Android版（現在未使用）|
| `message` | string | モーダルに表示するメッセージ（省略可）|

**⚠️ 重要: `minimumIosVersion` の更新は審査通過・App Store公開後に行う。**
公開前に設定すると既存ユーザーが更新できずアプリが使えなくなる。

#### テスト手順
1. Firestore で `minimumIosVersion` を現バージョン+1（例: `1.0.11`）に設定
2. TestFlightアプリを再起動して強制アップデートモーダルが出ることを確認
3. 確認後、`minimumIosVersion` を `1.0.0` 等に戻す

---

## GitHub Pages（Webページ）

- **ソース**: `main` ブランチの `/docs` フォルダ
- `git push origin main` すると自動デプロイされる（数十秒〜数分）

| URL | ファイル | 内容 |
|---|---|---|
| `/` | `index.html` | トップ（よくある質問へのリンクあり）|
| `/faq.html` | `faq.html` | よくある質問（アプリ内 FAQ_URL から参照）|
| `/privacy-policy.html` | `privacy-policy.html` | プライバシーポリシー |

---

## 申し送り事項・注意点

### メール送信上限
- OTPメール送信に **Nodemailer + Gmail** を使用（Firebase Functions経由）
- **Gmail の送信上限は 1日 500通**
- ユーザーが増えてきたら SendGrid / Resend 等の専用サービスへ移行を検討

### 強制アップデート
- 仕組みは `lib/version.ts` + `components/ForceUpdateModal.tsx` + `app/_layout.tsx`
- `__DEV__` が `true` の時（Expo Go / ローカル開発）は発動しない
- TestFlight・本番ビルドでのみ動作する

### Auth構成
- OTPメール認証（独自実装）+ Apple Sign-In の2系統
- OTPはFirestore の `otps` コレクションに一時保存（有効期限・試行回数制限あり）
- Firebase FunctionsのHTTPエンドポイント (`sendOTP`) 経由でメール送信

### Android
- 現状はiOSメインで運用
- `versionCode` は `app.config.js` の `android.versionCode` で管理

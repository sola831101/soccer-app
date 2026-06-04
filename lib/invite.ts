import { Share } from 'react-native';

// App Store のダウンロードURL（App ID: 6760473038）
export const APP_STORE_URL = 'https://apps.apple.com/jp/app/id6760473038';

// 招待時に共有されるメッセージ本文を生成する。
// LINE・メッセージ・メール等の共有シートにそのまま流し込む。
export function buildInviteMessage(teamName: string, shareCode: string): string {
  return (
    `サカログでサッカーの記録を一緒につけよう！\n\n` +
    `「${teamName}」に参加するには、アプリをインストールして招待コード「${shareCode}」を入力してください。\n\n` +
    `▼ ダウンロード\n${APP_STORE_URL}`
  );
}

// OS標準の共有シートを開いて招待を送る。
// ユーザーがキャンセルしても例外を投げない（呼び出し側で握りつぶす必要なし）。
export async function shareInvite(teamName: string, shareCode: string): Promise<void> {
  try {
    await Share.share({ message: buildInviteMessage(teamName, shareCode) });
  } catch {
    // 共有シートのキャンセル等は無視
  }
}

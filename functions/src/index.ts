import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();
const db = admin.firestore();

const GMAIL_USER = process.env.GMAIL_USER ?? '';
const GMAIL_PASS = process.env.GMAIL_PASS ?? '';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: GMAIL_USER, pass: GMAIL_PASS },
});

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10分
const MAX_ATTEMPTS = 5;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function setCors(res: functions.Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

// OTPを送信する（HTTP関数 - 未認証でも呼び出し可能）
export const sendOTP = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const email = normalizeEmail(req.body.email ?? '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'メールアドレスが無効です' });
    return;
  }

  const code = generateOTP();
  const expiresAt = Date.now() + OTP_EXPIRY_MS;

  await db.collection('otps').doc(email).set({ code, expiresAt, attempts: 0 });

  await transporter.sendMail({
    from: `サカログ <${GMAIL_USER}>`,
    to: email,
    subject: '【サカログ】認証コード',
    text: `認証コード: ${code}\n\nこのコードは10分間有効です。`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:auto;padding:24px;">
        <h2 style="color:#4CAF50;">サカログ</h2>
        <p>以下の認証コードを入力してください。</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center;padding:16px;background:#f5f5f5;border-radius:8px;">
          ${code}
        </div>
        <p style="color:#888;font-size:12px;margin-top:16px;">このコードは10分間有効です。心当たりがない場合は無視してください。</p>
      </div>
    `,
  });

  res.status(200).json({ success: true });
});

// OTPを検証してカスタムトークンを返す（HTTP関数 - 未認証でも呼び出し可能）
export const verifyOTP = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const email = normalizeEmail(req.body.email ?? '');
  const code = (req.body.code ?? '').trim();

  if (!email || !code) {
    res.status(400).json({ error: 'メールアドレスとコードが必要です' });
    return;
  }

  const otpDoc = await db.collection('otps').doc(email).get();
  if (!otpDoc.exists) {
    res.status(404).json({ error: 'コードが見つかりません。再送してください' });
    return;
  }

  const otp = otpDoc.data()!;

  if (otp.attempts >= MAX_ATTEMPTS) {
    res.status(429).json({ error: '試行回数が上限に達しました。再送してください' });
    return;
  }

  if (Date.now() > otp.expiresAt) {
    await db.collection('otps').doc(email).delete();
    res.status(410).json({ error: 'コードの有効期限が切れました。再送してください' });
    return;
  }

  if (otp.code !== code) {
    await db.collection('otps').doc(email).update({ attempts: otp.attempts + 1 });
    res.status(401).json({ error: 'コードが正しくありません' });
    return;
  }

  await db.collection('otps').doc(email).delete();

  const emailUserRef = db.collection('emailUsers').doc(email);
  const emailUserDoc = await emailUserRef.get();

  let uid: string;
  if (emailUserDoc.exists) {
    uid = emailUserDoc.data()!.uid;
    // Firebase AuthにEmailが未設定（匿名ユーザー等）の場合は付与する
    try {
      const authUser = await admin.auth().getUser(uid);
      if (!authUser.email) {
        await admin.auth().updateUser(uid, { email, emailVerified: true });
      }
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found') {
        // UIDがFirebase Authに存在しない場合は同じUIDで再作成（データ引き継ぎのため）
        await admin.auth().createUser({ uid, email, emailVerified: true });
      } else {
        // その他のエラー（ユーザーは存在するがgetUserに失敗）→ updateUserを試みる
        console.error('[verifyOTP] getUser failed:', e?.code, e?.message);
        try {
          await admin.auth().updateUser(uid, { email, emailVerified: true });
        } catch (updateErr: any) {
          console.error('[verifyOTP] updateUser also failed:', updateErr?.code, updateErr?.message);
        }
      }
    }
  } else {
    // emailUsersが存在しない場合：Auth Userを先に確定させてからFirestoreに書く
    try {
      const existing = await admin.auth().getUserByEmail(email);
      uid = existing.uid;
    } catch {
      uid = (await admin.auth().createUser({ email, emailVerified: true })).uid;
    }
    // Auth確定後にFirestoreへ書き込む（失敗しても次回verifyOTPで再作成される）
    try {
      await emailUserRef.set({
        uid,
        email,
        isTest: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('[verifyOTP] emailUsers write failed, will retry on next login:', e);
    }
  }

  // createCustomToken は signBlob 権限が必要なため、
  // 一時パスワードを発行してクライアント側で signInWithEmailAndPassword させる
  const { randomBytes } = await import('crypto');
  const tempPassword = randomBytes(32).toString('hex');
  await admin.auth().updateUser(uid, { password: tempPassword });
  res.status(200).json({ tempPassword, uid });
});

// 既存ユーザーのメール登録（Callable - 認証済みユーザーのみ）
export const linkEmailToUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', '認証が必要です');
  }

  const email = normalizeEmail(data.email ?? '');
  const code = (data.code ?? '').trim();
  const currentUid = context.auth.uid;

  if (!email || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'メールアドレスとコードが必要です');
  }

  const otpDoc = await db.collection('otps').doc(email).get();
  if (!otpDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'コードが見つかりません。再送してください');
  }

  const otp = otpDoc.data()!;

  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new functions.https.HttpsError('resource-exhausted', '試行回数が上限に達しました。再送してください');
  }

  if (Date.now() > otp.expiresAt) {
    await db.collection('otps').doc(email).delete();
    throw new functions.https.HttpsError('deadline-exceeded', 'コードの有効期限が切れました。再送してください');
  }

  if (otp.code !== code) {
    await db.collection('otps').doc(email).update({ attempts: otp.attempts + 1 });
    throw new functions.https.HttpsError('unauthenticated', 'コードが正しくありません');
  }

  const emailUserRef = db.collection('emailUsers').doc(email);
  const emailUserDoc = await emailUserRef.get();

  if (emailUserDoc.exists) {
    const existingUid = emailUserDoc.data()!.uid;
    // 既存アカウントが存在する場合：OTPを残したまま競合を通知
    // クライアント側でverifyOTPによるサインインにフォールバックさせる
    if (existingUid !== currentUid) {
      throw new functions.https.HttpsError(
        'already-exists',
        'このメールアドレスは既に別のアカウントに登録されています'
      );
    }
    // 同じUID：OTPを削除し、tempPasswordを発行して非匿名セッションへ移行させる
    await db.collection('otps').doc(email).delete();
    const { randomBytes: rb1 } = await import('crypto');
    const tempPassword1 = rb1(32).toString('hex');
    await admin.auth().updateUser(existingUid, { password: tempPassword1 });
    return { uid: existingUid, tempPassword: tempPassword1 };
  }

  await db.collection('otps').doc(email).delete();

  const teamsSnapshot = await db.collection('teams')
    .where('memberIds', 'array-contains', currentUid)
    .get();

  const teamRoles = teamsSnapshot.docs.map((doc) => {
    const d = doc.data();
    return { teamId: doc.id, role: d.createdBy === currentUid ? 'admin' : 'member' };
  });

  await emailUserRef.set({
    uid: currentUid,
    email,
    isTest: false,
    teams: teamRoles,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Firebase AuthにEmailを紐付け（匿名ユーザーの場合に必要）
  try {
    const authUser = await admin.auth().getUser(currentUid);
    if (!authUser.email) {
      await admin.auth().updateUser(currentUid, { email, emailVerified: true });
    }
  } catch (e: any) {
    if (e?.code === 'auth/user-not-found') {
      await admin.auth().createUser({ uid: currentUid, email, emailVerified: true });
    } else {
      console.error('[linkEmailToUser] getUser failed:', e?.code, e?.message);
      try {
        await admin.auth().updateUser(currentUid, { email, emailVerified: true });
      } catch (updateErr: any) {
        console.error('[linkEmailToUser] updateUser also failed:', updateErr?.code, updateErr?.message);
      }
    }
  }

  // tempPasswordを発行してクライアントが非匿名セッションへ移行できるようにする
  const { randomBytes: rb2 } = await import('crypto');
  const tempPassword2 = rb2(32).toString('hex');
  await admin.auth().updateUser(currentUid, { password: tempPassword2 });
  return { uid: currentUid, tempPassword: tempPassword2 };
});

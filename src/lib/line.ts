import { messagingApi, validateSignature } from "@line/bot-sdk";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const channelSecret = process.env.LINE_CHANNEL_SECRET;
const loginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;

let client: messagingApi.MessagingApiClient | null = null;

// トークンが未設定の間（ローカルでの画面確認中など）でもimport時に落ちないよう遅延生成する
function getClient(): messagingApi.MessagingApiClient {
  if (!channelAccessToken) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN が設定されていません");
  }
  if (!client) {
    client = new messagingApi.MessagingApiClient({ channelAccessToken });
  }
  return client;
}

export async function replyMessage(
  replyToken: string,
  messages: messagingApi.Message[]
) {
  await getClient().replyMessage({ replyToken, messages });
}

export async function pushMessage(
  to: string,
  messages: messagingApi.Message[]
) {
  await getClient().pushMessage({ to, messages });
}

// 友だち追加時のあいさつ等で表示名を差し込むために使う（取得失敗時は「お客様」を返す）
export async function getDisplayName(lineUserId: string): Promise<string> {
  try {
    const profile = await getClient().getProfile(lineUserId);
    return profile.displayName || "お客様";
  } catch {
    return "お客様";
  }
}

// Webhookの署名検証（なりすましリクエスト対策）
export function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!channelSecret || !signature) return false;
  return validateSignature(body, channelSecret, signature);
}

type LiffVerifyResponse = {
  sub: string; // LINEのuserId
  name?: string; // 表示名
  aud: string; // client_id（検証時に渡したLINEログインチャネルID）
  exp: number;
};

// LIFFの liff.getIDToken() で取得したIDトークンをLINE側に照会して検証する
export async function verifyLiffIdToken(
  idToken: string
): Promise<{ lineUserId: string; displayName: string }> {
  if (!loginChannelId) {
    throw new Error("LINE_LOGIN_CHANNEL_ID が設定されていません");
  }

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: loginChannelId }),
  });

  if (!res.ok) {
    throw new Error(`LIFF IDトークンの検証に失敗しました: ${res.status}`);
  }

  const data = (await res.json()) as LiffVerifyResponse;
  return { lineUserId: data.sub, displayName: data.name ?? "お客様" };
}

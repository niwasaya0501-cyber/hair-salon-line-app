const difyApiKey = process.env.DIFY_API_KEY;
const difyApiBaseUrl = process.env.DIFY_API_BASE_URL ?? "https://api.dify.ai/v1";

type DifyChatResponse = {
  answer: string;
  conversation_id: string;
};

// Dify の Chat API に問い合わせる。conversationId を渡すと同じ会話として文脈を継続する
export async function askDify(
  query: string,
  userId: string,
  conversationId?: string
): Promise<{ answer: string; conversationId: string }> {
  if (!difyApiKey) {
    throw new Error("DIFY_API_KEY が設定されていません");
  }

  const res = await fetch(`${difyApiBaseUrl}/chat-messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${difyApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: "blocking",
      conversation_id: conversationId ?? "",
      user: userId,
    }),
  });

  if (!res.ok) {
    throw new Error(`Dify API呼び出しに失敗しました: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as DifyChatResponse;
  return { answer: data.answer, conversationId: data.conversation_id };
}

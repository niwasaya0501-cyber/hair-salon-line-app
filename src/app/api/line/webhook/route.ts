import { NextRequest, NextResponse } from "next/server";
import { messagingApi, webhook } from "@line/bot-sdk";
import { replyMessage, verifyWebhookSignature } from "@/lib/line";

// LIFFの「エンドポイントURL」はこのプロジェクトの /liff/reserve に設定する想定
// （LINE Developersコンソールで発行されるLIFF IDに紐づく設定値）
function reserveLiffUrl(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : "";
}

async function handleEvent(event: webhook.Event) {
  if (event.type === "follow" && event.replyToken) {
    const liffUrl = reserveLiffUrl();
    const messages: messagingApi.Message[] = [
      {
        type: "text",
        text: "友だち追加ありがとうございます！\nご予約はこちらから承っております。",
      },
    ];
    if (liffUrl) {
      messages.push({
        type: "template",
        altText: "今すぐ予約する",
        template: {
          type: "buttons",
          text: "さっそくご予約されますか？",
          actions: [{ type: "uri", label: "今すぐ予約する", uri: liffUrl }],
        },
      });
    }
    await replyMessage(event.replyToken, messages);
  }
  // よくある質問など、他のイベントへの応答は次フェーズで拡張する
}

export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyWebhookSignature(bodyText, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(bodyText) as { events: webhook.Event[] };
  await Promise.all((body.events ?? []).map(handleEvent));

  return NextResponse.json({ ok: true });
}

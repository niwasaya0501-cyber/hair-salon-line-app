import { NextRequest, NextResponse } from "next/server";
import { messagingApi, webhook } from "@line/bot-sdk";
import { replyMessage, verifyWebhookSignature } from "@/lib/line";
import { askDify } from "@/lib/dify";
import { prisma } from "@/lib/db";

// LIFFの「エンドポイントURL」はこのプロジェクトの /liff/reserve に設定する想定
// （LINE Developersコンソールで発行されるLIFF IDに紐づく設定値）
function reserveLiffUrl(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : "";
}

// リッチメニューから送られる固定テキスト。まだ実装していない機能はここで
// Difyに問い合わせず「準備中」を返し、実装でき次第このリストから外す
const RICH_MENU_PLACEHOLDER_REPLIES: Record<string, string> = {
  メンバーズカード: "メンバーズカード機能は只今準備中です。近日公開予定ですので、今しばらくお待ちください🙏",
  ヘアグッズ購入: "ヘアグッズ購入は只今準備中です。近日公開予定ですので、今しばらくお待ちください🙏",
};

// リッチメニューの「よくある質問」から送られた場合は、Difyに丸投げせず案内文を返す
const FAQ_MENU_TRIGGER = "よくある質問";
const FAQ_MENU_INTRO =
  "どんなことでもお気軽にご質問ください😊\n（例）営業時間は？ 料金は？ 予約の変更はできる？\nそのままメッセージを送っていただければ、すぐにお答えします！";

// リッチメニューの「サロン紹介」から送られた場合は、サロン紹介ページのリンクを返す
const SALON_INTRO_TRIGGER = "サロン紹介";
const SALON_INTRO_URL = "https://hair-salon-line-app.vercel.app/about";

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
    return;
  }

  if (event.type === "message" && event.message.type === "text" && event.replyToken) {
    const text = event.message.text.trim();

    const placeholderReply = RICH_MENU_PLACEHOLDER_REPLIES[text];
    if (placeholderReply) {
      await replyMessage(event.replyToken, [{ type: "text", text: placeholderReply }]);
      return;
    }

    if (text === FAQ_MENU_TRIGGER) {
      await replyMessage(event.replyToken, [{ type: "text", text: FAQ_MENU_INTRO }]);
      return;
    }

    if (text === SALON_INTRO_TRIGGER) {
      await replyMessage(event.replyToken, [
        {
          type: "template",
          altText: "サロン紹介",
          template: {
            type: "buttons",
            text: "当サロンのご紹介はこちらからご覧いただけます",
            actions: [{ type: "uri", label: "サロン紹介を見る", uri: SALON_INTRO_URL }],
          },
        },
      ]);
      return;
    }

    const lineUserId = event.source?.userId;
    if (!lineUserId) return;

    const existing = await prisma.difyConversation.findUnique({ where: { lineUserId } });

    try {
      const { answer, conversationId } = await askDify(
        event.message.text,
        lineUserId,
        existing?.conversationId
      );

      await prisma.difyConversation.upsert({
        where: { lineUserId },
        update: { conversationId },
        create: { lineUserId, conversationId },
      });

      await replyMessage(event.replyToken, [{ type: "text", text: answer }]);
    } catch (error) {
      console.error("Dify呼び出しに失敗しました", error);
      await replyMessage(event.replyToken, [
        {
          type: "text",
          text: "只今混み合っております。少し時間をおいて再度お試しください。",
        },
      ]);
    }
  }
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

import { NextRequest, NextResponse } from "next/server";
import { messagingApi, webhook } from "@line/bot-sdk";
import { replyMessage, verifyWebhookSignature, getDisplayName } from "@/lib/line";
import { askDify, getDifyOpeningStatement } from "@/lib/dify";
import { prisma } from "@/lib/db";

// LIFFの「エンドポイントURL」はこのプロジェクトの /liff/reserve に設定する想定
// （LINE Developersコンソールで発行されるLIFF IDに紐づく設定値）
function reserveLiffUrl(): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  return liffId ? `https://liff.line.me/${liffId}` : "";
}

// リッチメニューから送られる固定テキスト。まだ実装していない機能はここで
// Difyに問い合わせず「準備中」を返し、実装でき次第このリストから外す
const RICH_MENU_PLACEHOLDER_REPLIES: Record<string, string> = {};

// リッチメニューの「ヘアグッズ購入」から送られた場合は、商品一覧ページのリンクを返す
// （購入・決済機能は未実装。現時点では一覧の案内のみ）
const SHOP_TRIGGER = "ヘアグッズ購入";
const SHOP_URL = "https://hair-salon-line-app.vercel.app/shop";

// リッチメニューの「よくある質問」から送られた場合は、Difyに丸投げせず案内文を返す
const FAQ_MENU_TRIGGER = "よくある質問";
const FAQ_MENU_INTRO =
  "どんなことでもお気軽にご質問ください😊\n（例）営業時間は？ 料金は？ 予約の変更はできる？\nそのままメッセージを送っていただければ、すぐにお答えします！";

// リッチメニューの「サロン紹介」から送られた場合は、サロン紹介ページのリンクを返す
const SALON_INTRO_TRIGGER = "サロン紹介";
const SALON_INTRO_URL = "https://hair-salon-line-app.vercel.app/about";

// 「場所」と送られた場合は地図（位置情報メッセージ）を返す
// ※架空サロンのためダミー座標（東京駅）を設定。実店舗の住所が決まったら緯度経度を差し替える
const LOCATION_TRIGGER = "場所";
const SALON_LOCATION = {
  title: "HAIR SALON NIWA（ダミー座標: 東京駅）",
  address: "東京都千代田区丸の内1丁目9",
  latitude: 35.681236,
  longitude: 139.767125,
};

// リッチメニューの「メンバーズカード」から送られた場合は、来店スタンプの状況を返す
// スタンプはご来店実績（開始日時が過去のキャンセルされていない予約）1件につき1個とする
const MEMBERSHIP_CARD_TRIGGER = "メンバーズカード";
const STAMPS_PER_REWARD = 10;

// スタンプ1個分の四角（塗りつぶし=獲得済み／薄色=未獲得）
function stampBox(filled: boolean): messagingApi.FlexBox {
  return {
    type: "box",
    layout: "vertical",
    width: "22px",
    height: "22px",
    cornerRadius: "6px",
    backgroundColor: filled ? "#8B5E3C" : "#E8D9C8",
    contents: [],
  };
}

// スタンプを5個ずつ並べた行を作る
function stampRow(filledInRow: number, totalInRow: number): messagingApi.FlexBox {
  const boxes: messagingApi.FlexBox[] = [];
  for (let i = 0; i < totalInRow; i++) {
    boxes.push(stampBox(i < filledInRow));
  }
  return { type: "box", layout: "horizontal", spacing: "sm", contents: boxes };
}

function stampGrid(current: number, total: number): messagingApi.FlexBox {
  const perRow = 5;
  const rows: messagingApi.FlexBox[] = [];
  for (let start = 0; start < total; start += perRow) {
    const rowTotal = Math.min(perRow, total - start);
    const rowFilled = Math.max(0, Math.min(rowTotal, current - start));
    rows.push(stampRow(rowFilled, rowTotal));
  }
  return { type: "box", layout: "vertical", spacing: "sm", contents: rows };
}

async function buildMembershipCardMessage(lineUserId: string): Promise<messagingApi.Message> {
  const customer = await prisma.customer.findUnique({ where: { lineUserId } });
  if (!customer) {
    return {
      type: "text",
      text: "ご来店履歴がまだありません。ご予約いただくと、ご来店ごとにスタンプが貯まります😊",
    };
  }

  const visitCount = await prisma.reservation.count({
    where: {
      customerId: customer.id,
      status: { not: "CANCELED" },
      startAt: { lt: new Date() },
    },
  });

  const rewardsEarned = Math.floor(visitCount / STAMPS_PER_REWARD);
  const currentStamps = visitCount % STAMPS_PER_REWARD;
  const footerMessage =
    rewardsEarned > 0
      ? `これまでに${rewardsEarned}枚の特典を獲得済みです🎉 ご来店時にスタッフへお申し付けください。`
      : `あと${STAMPS_PER_REWARD - currentStamps}回のご来店で特典獲得です！`;

  return {
    type: "flex",
    altText: `メンバーズカード（スタンプ ${currentStamps}/${STAMPS_PER_REWARD}）`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#8B5E3C",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "HAIR SALON", size: "xs", color: "#F5E9DB" },
          { type: "text", text: "NIWA メンバーズカード", size: "md", weight: "bold", color: "#FFFFFF" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FAF3EA",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          { type: "text", text: `${customer.displayName} 様`, weight: "bold", size: "sm", color: "#4A3826" },
          { type: "text", text: `ご来店スタンプ ${currentStamps}/${STAMPS_PER_REWARD}`, size: "xs", color: "#9C8570" },
          stampGrid(currentStamps, STAMPS_PER_REWARD),
          { type: "separator", margin: "sm", color: "#E8D9C8" },
          { type: "text", text: footerMessage, size: "xs", color: "#4A3826", wrap: true, margin: "sm" },
        ],
      },
    },
  };
}

// リッチメニュー等から「予約確認」と送られた場合は、直近のご予約状況を返す
const RESERVATION_CHECK_TRIGGER = "予約確認";
const MAX_UPCOMING_RESERVATIONS = 3;

function reservationRow(
  label: string,
  serviceName: string,
  staffName: string
): messagingApi.FlexBox {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    contents: [
      { type: "text", text: label, size: "sm", weight: "bold", color: "#8B5E3C" },
      { type: "text", text: `${serviceName} / 担当: ${staffName}`, size: "xs", color: "#4A3826", wrap: true },
    ],
  };
}

async function buildReservationCheckMessage(lineUserId: string): Promise<messagingApi.Message> {
  const liffUrl = reserveLiffUrl();
  const customer = await prisma.customer.findUnique({ where: { lineUserId } });

  const noUpcomingActions: messagingApi.Action[] = liffUrl
    ? [{ type: "uri", label: "今すぐ予約する", uri: liffUrl }]
    : [];

  if (!customer) {
    return {
      type: "template",
      altText: "現在ご予約はありません",
      template: {
        type: "buttons",
        text: "現在ご予約はありません。ご予約はこちらからどうぞ",
        actions: noUpcomingActions,
      },
    };
  }

  const upcoming = await prisma.reservation.findMany({
    where: { customerId: customer.id, status: "CONFIRMED", startAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take: MAX_UPCOMING_RESERVATIONS,
    include: { service: true, staff: true },
  });

  if (upcoming.length === 0) {
    return {
      type: "template",
      altText: "現在ご予約はありません",
      template: {
        type: "buttons",
        text: "現在ご予約はありません。ご予約はこちらからどうぞ",
        actions: noUpcomingActions,
      },
    };
  }

  const rows: (messagingApi.FlexBox | messagingApi.FlexSeparator)[] = [];
  upcoming.forEach((r, i) => {
    const dateLabel = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(r.startAt);
    if (i > 0) rows.push({ type: "separator", margin: "md", color: "#E8D9C8" });
    rows.push(reservationRow(dateLabel, r.service.name, r.staff.name));
  });

  return {
    type: "flex",
    altText: `ご予約確認（${upcoming.length}件）`,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#8B5E3C",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "HAIR SALON", size: "xs", color: "#F5E9DB" },
          { type: "text", text: "NIWA ご予約確認", size: "md", weight: "bold", color: "#FFFFFF" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#FAF3EA",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          { type: "text", text: `${customer.displayName} 様`, weight: "bold", size: "sm", color: "#4A3826" },
          { type: "box", layout: "vertical", spacing: "md", contents: rows },
          { type: "separator", margin: "sm", color: "#E8D9C8" },
          {
            type: "text",
            text: "ご予約の変更・キャンセルは、お電話にてサロンまでご連絡ください。",
            size: "xs",
            color: "#9C8570",
            wrap: true,
            margin: "sm",
          },
        ],
      },
    },
  };
}

async function handleEvent(event: webhook.Event) {
  if (event.type === "follow" && event.replyToken) {
    const liffUrl = reserveLiffUrl();
    const lineUserId = event.source?.userId;
    const openingStatement = lineUserId ? await getDifyOpeningStatement(lineUserId).catch(() => "") : "";
    const greetingText = openingStatement || "友だち追加ありがとうございます！\nご予約はこちらから承っております。";
    const displayName = lineUserId ? await getDisplayName(lineUserId) : "お客様";
    const messages: messagingApi.Message[] = [
      {
        type: "text",
        text: greetingText.replaceAll("{{name}}", displayName),
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
    const lineUserId = event.source?.userId;
    if (!lineUserId) return;

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

    if (text === LOCATION_TRIGGER) {
      await replyMessage(event.replyToken, [
        {
          type: "location",
          title: SALON_LOCATION.title,
          address: SALON_LOCATION.address,
          latitude: SALON_LOCATION.latitude,
          longitude: SALON_LOCATION.longitude,
        },
      ]);
      return;
    }

    if (text === SHOP_TRIGGER) {
      await replyMessage(event.replyToken, [
        {
          type: "template",
          altText: "ヘアグッズ",
          template: {
            type: "buttons",
            text: "取り扱いアイテムはこちらからご覧いただけます（購入は近日対応予定です）",
            actions: [{ type: "uri", label: "ヘアグッズを見る", uri: SHOP_URL }],
          },
        },
      ]);
      return;
    }

    if (text === MEMBERSHIP_CARD_TRIGGER) {
      const cardMessage = await buildMembershipCardMessage(lineUserId);
      await replyMessage(event.replyToken, [cardMessage]);
      return;
    }

    if (text === RESERVATION_CHECK_TRIGGER) {
      const checkMessage = await buildReservationCheckMessage(lineUserId);
      await replyMessage(event.replyToken, [checkMessage]);
      return;
    }

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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyLiffIdToken, pushMessage } from "@/lib/line";

type ReservationRequestBody = {
  idToken?: string;
  staffId?: string;
  serviceId?: string;
  startAt?: string; // ISO文字列
  requestNote?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ReservationRequestBody;
  const { idToken, staffId, serviceId, startAt, requestNote } = body;

  if (!idToken || !staffId || !serviceId || !startAt) {
    return NextResponse.json(
      { error: "idToken, staffId, serviceId, startAt は必須です" },
      { status: 400 }
    );
  }

  let lineUserId: string;
  let displayName: string;
  try {
    ({ lineUserId, displayName } = await verifyLiffIdToken(idToken));
  } catch {
    return NextResponse.json({ error: "LINEログインの検証に失敗しました" }, { status: 401 });
  }

  const [staff, service] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId } }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);
  if (!staff || !service) {
    return NextResponse.json({ error: "スタッフまたはメニューが見つかりません" }, { status: 404 });
  }

  const start = new Date(startAt);
  if (Number.isNaN(start.getTime()) || start <= new Date()) {
    return NextResponse.json({ error: "予約日時が不正です" }, { status: 400 });
  }
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000);

  const customer = await prisma.customer.upsert({
    where: { lineUserId },
    update: { displayName },
    create: { lineUserId, displayName },
  });

  // 直前の再チェック（他のお客様との二重予約防止）
  const conflict = await prisma.reservation.findFirst({
    where: {
      staffId,
      status: "CONFIRMED",
      startAt: { lt: end },
      endAt: { gt: start },
    },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "この時間はすでに予約が入っています。別の時間を選んでください" },
      { status: 409 }
    );
  }

  const reservation = await prisma.reservation.create({
    data: {
      customerId: customer.id,
      staffId,
      serviceId,
      startAt: start,
      endAt: end,
      requestNote,
    },
  });

  const dateLabel = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(start);

  try {
    await pushMessage(lineUserId, [
      {
        type: "text",
        text: `ご予約ありがとうございます！\n\n担当: ${staff.name}\nメニュー: ${service.name}\n日時: ${dateLabel}〜\n\n前日にリマインドをお送りします。ご来店をお待ちしております。\n\n（予約内容を確認したいときは「予約確認」と送ってください）`,
      },
    ]);
  } catch {
    // 通知の送信失敗は予約自体の成功を無効にしない
  }

  return NextResponse.json({ reservation }, { status: 201 });
}

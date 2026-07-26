import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pushMessage } from "@/lib/line";
import { JST_OFFSET_MINUTES } from "@/lib/business-hours";

// Vercel Cronから毎日呼ばれ、「翌日」に予約が入っているお客様へリマインドを送る
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // JSTの「明日 00:00〜23:59:59」をUTC基準の範囲に変換する
  const nowJstMs = Date.now() + JST_OFFSET_MINUTES * 60 * 1000;
  const nowJst = new Date(nowJstMs);
  const tomorrowJst = new Date(
    Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate() + 1)
  );
  const rangeStart = new Date(tomorrowJst.getTime() - JST_OFFSET_MINUTES * 60 * 1000);
  const rangeEnd = new Date(rangeStart.getTime() + 24 * 60 * 60 * 1000);

  const reservations = await prisma.reservation.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startAt: { gte: rangeStart, lt: rangeEnd },
    },
    include: { customer: true, staff: true, service: true },
  });

  let sent = 0;
  for (const r of reservations) {
    const dateLabel = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(r.startAt);

    try {
      await pushMessage(r.customer.lineUserId, [
        {
          type: "text",
          text: `【ご予約リマインド】\n\n明日のご来店をお待ちしております！\n\n担当: ${r.staff.name}\nメニュー: ${r.service.name}\n日時: ${dateLabel}〜\n\nお気をつけてお越しください。`,
        },
      ]);
      await prisma.reservation.update({
        where: { id: r.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (error) {
      console.error(`リマインド送信に失敗しました (reservationId: ${r.id})`, error);
    }
  }

  return NextResponse.json({ ok: true, target: reservations.length, sent });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BUSINESS_HOURS, jstDate, jstDayOfWeek } from "@/lib/business-hours";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const staffId = searchParams.get("staffId");
  const serviceId = searchParams.get("serviceId");
  const date = searchParams.get("date");

  if (!staffId || !serviceId || !date || !DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "staffId, serviceId, date(YYYY-MM-DD) は必須です" },
      { status: 400 }
    );
  }

  const [staff, service] = await Promise.all([
    prisma.staff.findUnique({ where: { id: staffId } }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!staff || !service) {
    return NextResponse.json({ error: "スタッフまたはメニューが見つかりません" }, { status: 404 });
  }

  const dayStart = jstDate(date, 0, 0);

  // 定休日はスロットなし
  if (staff.weeklyOffDay !== null && jstDayOfWeek(dayStart) === staff.weeklyOffDay) {
    return NextResponse.json({ slots: [] });
  }

  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const existingReservations = await prisma.reservation.findMany({
    where: {
      staffId,
      status: "CONFIRMED",
      startAt: { gte: dayStart, lt: dayEnd },
    },
    select: { startAt: true, endAt: true },
  });

  const { openHour, closeHour, slotIntervalMinutes } = BUSINESS_HOURS;
  const closeAt = jstDate(date, closeHour, 0);

  const slots: string[] = [];
  for (let minutes = openHour * 60; minutes < closeHour * 60; minutes += slotIntervalMinutes) {
    const slotStart = jstDate(date, Math.floor(minutes / 60), minutes % 60);
    const slotEnd = new Date(slotStart.getTime() + service.durationMinutes * 60 * 1000);

    // 施術時間が営業時間内に収まらない場合は候補にしない
    if (slotEnd > closeAt) continue;

    // 過去の日時は候補にしない
    if (slotStart <= new Date()) continue;

    const overlaps = existingReservations.some(
      (r) => slotStart < r.endAt && slotEnd > r.startAt
    );
    if (overlaps) continue;

    slots.push(slotStart.toISOString());
  }

  return NextResponse.json({ slots });
}

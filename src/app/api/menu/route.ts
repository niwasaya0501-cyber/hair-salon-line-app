import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// LIFF予約画面のセレクトボックス用に、有効なスタッフ・施術メニューの一覧を返す
export async function GET() {
  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, durationMinutes: true, price: true },
    }),
  ]);

  return NextResponse.json({ staff, services });
}

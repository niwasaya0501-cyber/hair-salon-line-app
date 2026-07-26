import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  await prisma.staff.createMany({
    data: [
      { name: "丹羽 紗也", sortOrder: 1, weeklyOffDay: 1 }, // 月曜定休
      { name: "佐藤 太郎", sortOrder: 2, weeklyOffDay: 2 }, // 火曜定休
    ],
  });

  await prisma.service.createMany({
    data: [
      { name: "カット", durationMinutes: 60, price: 5500, sortOrder: 1 },
      { name: "カット＋カラー", durationMinutes: 120, price: 12000, sortOrder: 2 },
      { name: "カット＋パーマ", durationMinutes: 150, price: 14000, sortOrder: 3 },
      { name: "トリートメント", durationMinutes: 40, price: 4000, sortOrder: 4 },
    ],
  });

  console.log("シードデータを投入しました");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

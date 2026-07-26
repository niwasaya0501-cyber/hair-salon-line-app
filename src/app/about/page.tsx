import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

// 参考にした他サロンサイトの写真・文章はそのまま使わず、構成の雰囲気（大きなビジュアル→
// コンセプト→スタイリスト→メニュー、の流れ／大文字の見出しラベル）だけを取り入れ、
// 文章・配色・素材（写真が無い場合はイニシャルアバターで代替）はすべてこのプロジェクト用に新規作成している。
// リッチメニュー(茶色×クリーム)と同じ配色に揃えて、ブランドの雰囲気を統一している。

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// public/images/about/ に以下のファイルを置くと、写真として反映される（未設置ならプレースホルダー表示のまま）
// - hero.jpg              … トップの雰囲気画像（推奨: 横長 1600×900 程度）
// - stylist-1.jpg, stylist-2.jpg, ... … スタイリスト写真（表示順=sortOrder順。推奨: 正方形 600×600）
// - style-1.jpg 〜 style-6.jpg … カット後のスタイル写真ギャラリー（推奨: 正方形 600×600、あるものだけ表示）
function publicImageExists(relPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", relPath));
}

const MAX_STYLE_PHOTOS = 6;

function findStylePhotos(): string[] {
  const paths: string[] = [];
  for (let i = 1; i <= MAX_STYLE_PHOTOS; i++) {
    const relPath = `images/about/style-${i}.jpg`;
    if (publicImageExists(relPath)) paths.push(`/${relPath}`);
  }
  return paths;
}

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const [staffList, services] = await Promise.all([
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, weeklyOffDay: true },
    }),
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, durationMinutes: true, price: true },
    }),
  ]);

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const reserveUrl = liffId ? `https://liff.line.me/${liffId}` : "/liff/reserve";
  const hasHeroImage = publicImageExists("images/about/hero.jpg");
  const stylePhotos = findStylePhotos();

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FAF3EA] pb-28 text-[#4A3826] md:max-w-2xl lg:max-w-4xl">
      {/* Hero */}
      <div className="relative flex aspect-[4/3] flex-col items-center justify-center overflow-hidden px-6 text-center text-white sm:aspect-[16/9] md:aspect-[21/9]">
        {hasHeroImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- 任意設置の写真をそのまま表示するため next/image の固定寸法制約を避けている
          <img
            src="/images/about/hero.jpg"
            alt="サロンの雰囲気"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#B98A63] via-[#A9764E] to-[#7A5233]" />
        )}
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative">
          <p className="text-xs tracking-[0.3em] text-[#F5E9DB] md:text-sm">HAIR SALON</p>
          <h1 className="mt-2 text-3xl font-bold tracking-wide md:text-5xl">NIWA</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#F5E9DB] md:text-base">
            髪と、暮らしのリズムを整える。
          </p>
        </div>
      </div>

      <div className="px-5 md:px-10 lg:px-16">
        {/* CONCEPT */}
        <section className="mt-8 md:mt-12">
          <SectionLabel>CONCEPT</SectionLabel>
          <p className="mt-3 text-sm leading-relaxed text-[#4A3826] md:max-w-2xl md:text-base">
            「今日も似合っている」と思える髪を、日常のペースで。
            <br />
            NIWAは、トレンドだけでなく、お客様一人ひとりの髪質・ライフスタイルに寄り添うことを大切にしています。
            忙しい毎日でも扱いやすいスタイルを、一緒にゆっくり見つけていきましょう。
          </p>
        </section>

        {/* STYLE（カット後のスタイルギャラリー。写真が1枚もなければセクション自体を出さない） */}
        {stylePhotos.length > 0 && (
          <section className="mt-10 md:mt-14">
            <SectionLabel>STYLE</SectionLabel>
            <div className="mt-3 grid grid-cols-3 gap-2 md:gap-4">
              {stylePhotos.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- 任意設置の写真をそのまま表示するため
                <img
                  key={src}
                  src={src}
                  alt="施術後のスタイル例"
                  className="aspect-square w-full rounded-lg object-cover shadow-sm"
                />
              ))}
            </div>
          </section>
        )}

        {/* STYLIST */}
        <section className="mt-10 md:mt-14">
          <SectionLabel>STYLIST</SectionLabel>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
            {staffList.map((s, i) => {
              const photoPath = `images/about/stylist-${i + 1}.jpg`;
              const hasPhoto = publicImageExists(photoPath);
              return (
                <div
                  key={s.id}
                  className="flex w-28 shrink-0 flex-col items-center rounded-2xl border-2 border-[#E8D9C8] bg-white p-3 text-center shadow-sm md:w-auto"
                >
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 任意設置の写真をそのまま表示するため
                    <img
                      src={`/${photoPath}`}
                      alt={s.name}
                      className="h-14 w-14 rounded-full object-cover md:h-20 md:w-20"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EFE0CE] text-lg font-bold text-[#8B5E3C] md:h-20 md:w-20 md:text-2xl">
                      {s.name.charAt(0)}
                    </div>
                  )}
                  <p className="mt-2 text-sm font-semibold md:text-base">{s.name}</p>
                  <p className="mt-1 text-xs text-[#9C8570]">
                    {s.weeklyOffDay !== null
                      ? `定休日: ${WEEKDAY_LABELS[s.weeklyOffDay]}曜`
                      : "定休日なし"}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* MENU */}
        <section className="mt-10 md:mt-14">
          <SectionLabel>MENU</SectionLabel>
          <div className="mt-3 space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {services.map((service) => (
              <div
                key={service.id}
                className="flex items-center justify-between rounded-2xl border-2 border-[#E8D9C8] bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="text-sm font-semibold md:text-base">{service.name}</p>
                  <p className="mt-1 text-xs text-[#9C8570]">約{service.durationMinutes}分</p>
                </div>
                <p className="text-base font-bold text-[#8B5E3C] md:text-lg">
                  ¥{service.price.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ACCESS */}
        <section className="mt-10 md:mt-14">
          <SectionLabel>ACCESS</SectionLabel>
          <div className="mt-3 space-y-2 rounded-2xl border-2 border-[#E8D9C8] bg-white p-4 text-sm md:max-w-md md:text-base">
            <Row label="住所" value="東京都渋谷区代々木2-3-4 NIWAビル3F" />
            <Row label="電話番号" value="03-1234-5678" />
            <Row label="営業時間" value="10:00〜19:00" />
          </div>
        </section>
      </div>

      {/* 予約CTA（画面下部に固定） */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#E8D9C8] bg-[#FAF3EA] p-4">
        <div className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl">
          <a
            href={reserveUrl}
            className="block w-full rounded-full bg-[#8B5E3C] py-4 text-center text-lg font-bold text-white shadow-md active:bg-[#74492C] md:max-w-sm md:mx-auto"
          >
            ご予約はこちら
          </a>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="text-xs font-bold tracking-[0.25em] text-[#8B5E3C] md:text-sm">{children}</p>
      <div className="h-px flex-1 bg-[#E8D9C8]" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#F0E4D8] pb-2 last:border-0 last:pb-0">
      <dt className="text-[#9C8570]">{label}</dt>
      <dd className="font-medium text-[#4A3826]">{value}</dd>
    </div>
  );
}

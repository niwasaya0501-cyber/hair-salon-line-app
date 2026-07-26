import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";

// ヘアグッズ購入ページ。現時点では一覧表示のみで、購入・決済機能は未実装（フェーズ8で拡張予定）
// public/images/shop/product-1.jpg, product-2.jpg, ... (表示順=sortOrder順) を置くと写真が反映される
export const dynamic = "force-dynamic";

function publicImageExists(relPath: string): boolean {
  return fs.existsSync(path.join(process.cwd(), "public", relPath));
}

export default async function ShopPage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FAF3EA] px-5 py-6 text-[#4A3826] md:max-w-2xl lg:max-w-4xl md:px-10 lg:px-16">
      <p className="text-xs tracking-[0.3em] text-[#8B5E3C]">HAIR SALON NIWA</p>
      <h1 className="mt-2 text-2xl font-bold text-[#5C3D25] md:text-3xl">ヘアグッズ</h1>
      <p className="mt-2 text-sm text-[#9C8570]">
        サロンで使用しているアイテムを、ご自宅でもお使いいただけます。
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {products.map((product, i) => {
          const photoPath = `images/shop/product-${i + 1}.jpg`;
          const hasPhoto = publicImageExists(photoPath);
          return (
            <div
              key={product.id}
              className="overflow-hidden rounded-2xl border-2 border-[#E8D9C8] bg-white shadow-sm"
            >
              {hasPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element -- 任意設置の写真をそのまま表示するため
                <img
                  src={`/${photoPath}`}
                  alt={product.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-[#EFE0CE] to-[#E3D2C0]">
                  <span className="text-sm text-[#9C8570]">準備中</span>
                </div>
              )}
              <div className="p-4">
                <p className="text-sm font-semibold">{product.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-[#9C8570]">{product.description}</p>
                <p className="mt-2 text-base font-bold text-[#8B5E3C]">
                  ¥{product.price.toLocaleString()}
                </p>
                <div className="mt-3 w-full rounded-full border-2 border-[#E8D9C8] py-2 text-center text-sm font-semibold text-[#9C8570]">
                  近日発売予定
                </div>
              </div>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="text-sm text-[#9C8570]">現在取り扱い中の商品はありません。</p>
        )}
      </div>
    </div>
  );
}

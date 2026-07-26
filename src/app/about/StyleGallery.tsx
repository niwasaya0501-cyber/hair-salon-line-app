"use client";

import { useEffect, useRef, useState } from "react";

// STYLEギャラリーの画像を、スクロールで見えたタイミングでふわっと浮き上がらせて表示する
export function StyleGallery({ photos }: { photos: string[] }) {
  const [visible, setVisible] = useState<boolean[]>(() => photos.map(() => false));
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observers = refs.current.map((el, i) => {
      if (!el) return null;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          setVisible((prev) => {
            if (prev[i]) return prev;
            const next = [...prev];
            next[i] = true;
            return next;
          });
          observer.disconnect();
        },
        { threshold: 0.2 }
      );
      observer.observe(el);
      return observer;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, []);

  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4">
      {photos.map((src, i) => (
        <div
          key={src}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`aspect-square w-full overflow-hidden rounded-lg shadow-sm transition-all duration-700 ease-out ${
            visible[i] ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
          style={{ transitionDelay: `${i * 80}ms` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 任意設置の写真をそのまま表示するため */}
          <img src={src} alt="施術後のスタイル例" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  );
}

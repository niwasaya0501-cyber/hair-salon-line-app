"use client";

import { useEffect, useMemo, useState } from "react";

type Staff = { id: string; name: string };
type Service = { id: string; name: string; durationMinutes: number; price: number };

type Step = "service" | "staff" | "datetime" | "note" | "confirm" | "done";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

function todayJstStr(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export default function ReservePage() {
  const [liffReady, setLiffReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [serviceList, setServiceList] = useState<Service[]>([]);

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<Service | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [date, setDate] = useState(todayJstStr());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // LIFF初期化
  useEffect(() => {
    if (!LIFF_ID) return; // LIFF ID未設定時は画面レイアウト確認のみ行うモード（下の描画分岐を参照）
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        setIdToken(liff.getIDToken());
        setLiffReady(true);
      } catch {
        setInitError("LINEログインの初期化に失敗しました");
      }
    })();
  }, []);

  // メニュー・スタッフ一覧取得
  useEffect(() => {
    fetch("/api/menu")
      .then((res) => res.json())
      .then((data) => {
        setStaffList(data.staff ?? []);
        setServiceList(data.services ?? []);
      });
  }, []);

  // 空き枠取得
  useEffect(() => {
    if (step !== "datetime" || !staff || !service) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- データ取得開始時にローディング表示するための同期setStateで意図通り
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetch(`/api/availability?staffId=${staff.id}&serviceId=${service.id}&date=${date}`)
      .then((res) => res.json())
      .then((data) => setSlots(data.slots ?? []))
      .finally(() => setSlotsLoading(false));
  }, [step, staff, service, date]);

  const slotLabels = useMemo(
    () =>
      slots.map((iso) => ({
        iso,
        label: new Intl.DateTimeFormat("ja-JP", {
          timeZone: "Asia/Tokyo",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(iso)),
      })),
    [slots]
  );

  async function handleSubmit() {
    if (!service || !staff || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          staffId: staff.id,
          serviceId: service.id,
          startAt: selectedSlot,
          requestNote: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "予約に失敗しました");
      }
      setStep("done");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "予約に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  if (initError) {
    return <div className="p-6 text-sm text-red-600">{initError}</div>;
  }
  if (LIFF_ID && !liffReady) {
    return <div className="p-6 text-sm text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="mx-auto max-w-md min-h-screen bg-white px-4 py-6">
      <h1 className="mb-6 text-lg font-bold">ご予約</h1>

      {step === "service" && (
        <StepList
          title="メニューを選択してください"
          items={serviceList.map((s) => ({
            key: s.id,
            label: `${s.name}（${s.durationMinutes}分・¥${s.price.toLocaleString()}）`,
            onClick: () => {
              setService(s);
              setStep("staff");
            },
          }))}
        />
      )}

      {step === "staff" && (
        <StepList
          title="担当スタイリストを選択してください"
          items={staffList.map((s) => ({
            key: s.id,
            label: s.name,
            onClick: () => {
              setStaff(s);
              setStep("datetime");
            },
          }))}
          onBack={() => setStep("service")}
        />
      )}

      {step === "datetime" && (
        <div>
          <button className="mb-4 text-sm text-gray-500" onClick={() => setStep("staff")}>
            ← 戻る
          </button>
          <p className="mb-2 font-semibold">日時を選択してください</p>
          <input
            type="date"
            className="mb-4 w-full rounded border border-gray-300 p-2"
            value={date}
            min={todayJstStr()}
            onChange={(e) => setDate(e.target.value)}
          />
          {slotsLoading && <p className="text-sm text-gray-500">空き状況を確認中...</p>}
          {!slotsLoading && slotLabels.length === 0 && (
            <p className="text-sm text-gray-500">この日は空きがありません</p>
          )}
          <div className="grid grid-cols-3 gap-2">
            {slotLabels.map((s) => (
              <button
                key={s.iso}
                className={`rounded border p-2 text-sm ${
                  selectedSlot === s.iso
                    ? "border-black bg-black text-white"
                    : "border-gray-300"
                }`}
                onClick={() => setSelectedSlot(s.iso)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            disabled={!selectedSlot}
            className="mt-6 w-full rounded bg-black p-3 text-white disabled:opacity-30"
            onClick={() => setStep("note")}
          >
            次へ
          </button>
        </div>
      )}

      {step === "note" && (
        <div>
          <button className="mb-4 text-sm text-gray-500" onClick={() => setStep("datetime")}>
            ← 戻る
          </button>
          <p className="mb-2 font-semibold">ご要望があればご記入ください（任意）</p>
          <textarea
            className="mb-4 w-full rounded border border-gray-300 p-2"
            rows={4}
            placeholder="例：毛先を軽くしたい、前髪を作りたい など"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button className="w-full rounded bg-black p-3 text-white" onClick={() => setStep("confirm")}>
            確認画面へ
          </button>
        </div>
      )}

      {step === "confirm" && service && staff && selectedSlot && (
        <div>
          <button className="mb-4 text-sm text-gray-500" onClick={() => setStep("note")}>
            ← 戻る
          </button>
          <p className="mb-4 font-semibold">この内容で予約します</p>
          <dl className="mb-6 space-y-2 text-sm">
            <Row label="メニュー" value={`${service.name}（¥${service.price.toLocaleString()}）`} />
            <Row label="担当" value={staff.name} />
            <Row
              label="日時"
              value={new Intl.DateTimeFormat("ja-JP", {
                timeZone: "Asia/Tokyo",
                month: "long",
                day: "numeric",
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(selectedSlot))}
            />
            {note && <Row label="ご要望" value={note} />}
          </dl>
          {submitError && <p className="mb-4 text-sm text-red-600">{submitError}</p>}
          <button
            disabled={submitting}
            className="w-full rounded bg-black p-3 text-white disabled:opacity-50"
            onClick={handleSubmit}
          >
            {submitting ? "送信中..." : "予約を確定する"}
          </button>
        </div>
      )}

      {step === "done" && (
        <div className="text-center">
          <p className="mb-2 text-lg font-bold">予約が完了しました</p>
          <p className="mb-6 text-sm text-gray-600">
            LINEに確認メッセージをお送りしました。ご来店をお待ちしております。
          </p>
          <button
            className="w-full rounded bg-black p-3 text-white"
            onClick={async () => {
              const liff = (await import("@line/liff")).default;
              if (liff.isInClient()) liff.closeWindow();
            }}
          >
            閉じる
          </button>
        </div>
      )}
    </div>
  );
}

function StepList({
  title,
  items,
  onBack,
}: {
  title: string;
  items: { key: string; label: string; onClick: () => void }[];
  onBack?: () => void;
}) {
  return (
    <div>
      {onBack && (
        <button className="mb-4 text-sm text-gray-500" onClick={onBack}>
          ← 戻る
        </button>
      )}
      <p className="mb-2 font-semibold">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.key}
            className="w-full rounded border border-gray-300 p-3 text-left"
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-500">選択肢がありません</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-gray-100 pb-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

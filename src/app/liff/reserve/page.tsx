"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Staff = { id: string; name: string };
type Service = { id: string; name: string; durationMinutes: number; price: number };

type Step = "service" | "staff" | "datetime" | "note" | "confirm" | "done";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID;

// 事前ヒアリング用のよくある要望（任意で複数選択。自由記述欄と合わせてrequestNoteに含める）
const HEARING_OPTIONS = [
  "イメージチェンジしたい",
  "いつもと同じ感じで",
  "髪の悩みを相談したい",
  "傷んだ髪をケアしたい",
  "前髪を作りたい／変えたい",
  "白髪をカバーしたい",
];

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
  const [selectedHearingTags, setSelectedHearingTags] = useState<string[]>([]);
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

  // 選択したヒアリング項目＋自由記述をまとめて1つのご要望テキストにする
  const combinedNote = useMemo(() => {
    const parts = [];
    if (selectedHearingTags.length > 0) parts.push(selectedHearingTags.join("、"));
    if (note) parts.push(note);
    return parts.join("\n");
  }, [selectedHearingTags, note]);

  function toggleHearingTag(tag: string) {
    setSelectedHearingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

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
          requestNote: combinedNote || undefined,
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
    return <div className="p-6 text-sm text-[#9C8570]">読み込み中...</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#FAF3EA] px-4 py-6 text-[#4A3826]">
      <h1 className="mb-6 text-2xl font-bold text-[#5C3D25]">ご予約</h1>

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
          <BackButton onClick={() => setStep("staff")} />
          <p className="mb-3 text-base font-bold text-[#5C3D25]">日時を選択してください</p>
          <input
            type="date"
            className="mb-4 w-full rounded-2xl border-2 border-[#E8D9C8] bg-white p-3 text-base"
            value={date}
            min={todayJstStr()}
            onChange={(e) => setDate(e.target.value)}
          />
          {slotsLoading && <p className="text-sm text-[#9C8570]">空き状況を確認中...</p>}
          {!slotsLoading && slotLabels.length === 0 && (
            <p className="text-sm text-[#9C8570]">この日は空きがありません</p>
          )}
          <div className="grid grid-cols-3 gap-3">
            {slotLabels.map((s) => (
              <button
                key={s.iso}
                className={`rounded-xl border-2 p-3 text-base font-semibold transition-colors ${
                  selectedSlot === s.iso
                    ? "border-[#8B5E3C] bg-[#8B5E3C] text-white"
                    : "border-[#E8D9C8] bg-white text-[#4A3826] active:bg-[#F5EAE0]"
                }`}
                onClick={() => setSelectedSlot(s.iso)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <PrimaryButton disabled={!selectedSlot} onClick={() => setStep("note")}>
            次へ
          </PrimaryButton>
        </div>
      )}

      {step === "note" && (
        <div>
          <BackButton onClick={() => setStep("datetime")} />
          <p className="mb-1 text-base font-bold text-[#5C3D25]">事前ヒアリング（任意）</p>
          <p className="mb-3 text-xs text-[#9C8570]">
            当てはまるものがあれば選んでください。スタイリストが事前に把握し、当日の相談がスムーズになります。
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {HEARING_OPTIONS.map((tag) => {
              const selected = selectedHearingTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    selected
                      ? "border-[#8B5E3C] bg-[#8B5E3C] text-white"
                      : "border-[#E8D9C8] bg-white text-[#4A3826] active:bg-[#F5EAE0]"
                  }`}
                  onClick={() => toggleHearingTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <p className="mb-2 text-sm font-semibold text-[#5C3D25]">その他ご要望（任意）</p>
          <textarea
            className="mb-4 w-full rounded-2xl border-2 border-[#E8D9C8] bg-white p-3 text-base"
            rows={4}
            placeholder="例：毛先を軽くしたい、前髪を作りたい など"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <PrimaryButton onClick={() => setStep("confirm")}>確認画面へ</PrimaryButton>
        </div>
      )}

      {step === "confirm" && service && staff && selectedSlot && (
        <div>
          <BackButton onClick={() => setStep("note")} />
          <p className="mb-4 text-base font-bold text-[#5C3D25]">この内容で予約します</p>
          <dl className="mb-6 space-y-3 rounded-2xl border-2 border-[#E8D9C8] bg-white p-4 text-sm">
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
          </dl>
          {combinedNote && (
            <div className="mb-6 rounded-2xl border-2 border-[#E8D9C8] bg-white p-4 text-sm">
              <p className="mb-1 text-[#9C8570]">ご要望</p>
              <p className="whitespace-pre-wrap text-[#4A3826]">{combinedNote}</p>
            </div>
          )}
          {submitError && <p className="mb-4 text-sm text-red-600">{submitError}</p>}
          <PrimaryButton disabled={submitting} onClick={handleSubmit}>
            {submitting ? "送信中..." : "予約を確定する"}
          </PrimaryButton>
        </div>
      )}

      {step === "done" && (
        <div className="text-center">
          <p className="mb-2 text-lg font-bold text-[#5C3D25]">予約が完了しました</p>
          <p className="mb-6 text-sm text-[#7A6552]">
            LINEに確認メッセージをお送りしました。ご来店をお待ちしております。
          </p>
          <PrimaryButton
            onClick={async () => {
              const liff = (await import("@line/liff")).default;
              if (liff.isInClient()) liff.closeWindow();
            }}
          >
            閉じる
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      className="mt-6 w-full rounded-full bg-[#8B5E3C] py-4 text-lg font-bold text-white shadow-md transition-colors active:bg-[#74492C] disabled:bg-[#D9C7B8] disabled:text-[#F5EAE0] disabled:shadow-none"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="mb-4 text-sm font-semibold text-[#8B5E3C]" onClick={onClick}>
      ← 戻る
    </button>
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
      {onBack && <BackButton onClick={onBack} />}
      <p className="mb-3 text-base font-bold text-[#5C3D25]">{title}</p>
      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.key}
            className="w-full rounded-2xl border-2 border-[#E8D9C8] bg-white p-4 text-left text-base font-semibold text-[#4A3826] shadow-sm transition-colors active:bg-[#F5EAE0]"
            onClick={item.onClick}
          >
            {item.label}
          </button>
        ))}
        {items.length === 0 && <p className="text-sm text-[#9C8570]">選択肢がありません</p>}
      </div>
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

// 営業時間の設定（仮置き。サロンの実際の営業時間に合わせて自由に変更してよい）
export const BUSINESS_HOURS = {
  openHour: 10, // 10:00 開店
  closeHour: 19, // 19:00 閉店
  slotIntervalMinutes: 30, // 予約枠の刻み幅
};

// JST(Asia/Tokyo)は常にUTC+9で固定（夏時間なし）なので、オフセット固定で扱う
export const JST_OFFSET_MINUTES = 9 * 60;

// "YYYY-MM-DD" の日付文字列とJSTの時・分から、UTC基準のDateを作る
export function jstDate(dateStr: string, hour: number, minute: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - JST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
}

// DateからJSTの曜日（0=日曜〜6=土曜）を取得する
export function jstDayOfWeek(date: Date): number {
  const jstMs = date.getTime() + JST_OFFSET_MINUTES * 60 * 1000;
  return new Date(jstMs).getUTCDay();
}

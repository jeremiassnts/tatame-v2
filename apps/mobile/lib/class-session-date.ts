const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date YYYY-MM-DD for `today`. */
export function localTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Local calendar date for `selectedDay` (0–6) using the same offset as the
 * weekly agenda strip: occurrence in the current week relative to today.
 */
export function localDateStringForAgendaWeekday(selectedDay: number): string {
  const today = new Date();
  const diff = selectedDay - today.getDay();
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseSessionDateParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string" && ISO_DATE.test(value)) return value;
  if (Array.isArray(value) && typeof value[0] === "string" && ISO_DATE.test(value[0]))
    return value[0];
  return undefined;
}

/**
 * Session calendar date for check-in: query param from agenda, else today if the
 * class runs today, else the strip-aligned date for the class weekday.
 */
export function resolveClassSessionDate(
  param: string | undefined,
  classDayOfWeek: number,
): string {
  const todayStr = localTodayDateString();
  const todayDow = new Date().getDay();
  if (param && ISO_DATE.test(param)) return param;
  if (classDayOfWeek === todayDow) return todayStr;
  return localDateStringForAgendaWeekday(classDayOfWeek);
}

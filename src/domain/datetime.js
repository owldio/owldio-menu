const TIME_ZONE = "Asia/Taipei";
const UNKNOWN = "待公告";

const DATE_OPTIONS = { year: "numeric", month: "2-digit", day: "2-digit" };
const SHORT_DATE_OPTIONS = { month: "2-digit", day: "2-digit" };
const TIME_OPTIONS = { weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false };

export function formatDate(value, options) {
  if (!value) return UNKNOWN;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return UNKNOWN;
  return new Intl.DateTimeFormat("zh-TW", { timeZone: TIME_ZONE, ...options }).format(date);
}

export function programmeDateLabel(programme) {
  const start = formatDate(programme?.starts_at, DATE_OPTIONS);
  if (!programme?.ends_at) return start;
  return `${start}—${formatDate(programme.ends_at, SHORT_DATE_OPTIONS)}`;
}

export function programmeTimeLabel(programme) {
  return formatDate(programme?.starts_at, TIME_OPTIONS);
}

const PARTS_FORMAT = new Intl.DateTimeFormat("zh-TW", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "narrow",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The curtain time split the way a poster sets it: 2026 / 9.25（五）19:30. */
export function programmeDateParts(programme) {
  if (!programme?.starts_at) return null;
  const date = new Date(programme.starts_at);
  if (Number.isNaN(date.valueOf())) return null;

  const parts = Object.fromEntries(
    PARTS_FORMAT.formatToParts(date).map(({ type, value }) => [type, value]),
  );

  return {
    year: parts.year,
    monthDay: `${parts.month}.${parts.day}`,
    weekday: parts.weekday,
    time: `${parts.hour}:${parts.minute}`,
  };
}

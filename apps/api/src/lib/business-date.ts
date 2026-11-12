/** Today's calendar date in India (Asia/Kolkata) as ISO `YYYY-MM-DD`. */
export function getBusinessDate(now = new Date()) {
  const parts: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)) {
    parts[part.type] = part.value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

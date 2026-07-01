/** Computes the Hijri (Islamic Umm al-Qura) date via the ICU calendar,
 *  with an optional day offset for local moon-sighting adjustment. */

export type HijriDate = {
  day: number;
  monthIndex: number;   // 0..11
  monthName: string;
  year: number;
  formatted: string;    // e.g. "12 Muharram 1447 AH"
};

// Standard month names for Umm al-Qura / Islamic calendar.
const MONTHS = [
  "Muharram",
  "Safar",
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  "Jumada al-Awwal",
  "Jumada al-Thani",
  "Rajab",
  "Sha'ban",
  "Ramadan",
  "Shawwal",
  "Dhu al-Qi'dah",
  "Dhu al-Hijjah",
];

export function toHijri(date: Date = new Date(), offsetDays = 0): HijriDate {
  const adjusted = new Date(date.getTime() + offsetDays * 86400_000);
  // Intl outputs numeric parts for the Islamic Umm al-Qura calendar.
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const parts = fmt.formatToParts(adjusted);
  let day = 0, month = 0, year = 0;
  for (const p of parts) {
    if (p.type === "day") day = parseInt(p.value, 10);
    else if (p.type === "month") month = parseInt(p.value, 10);
    else if (p.type === "year") year = parseInt(p.value, 10);
  }
  const monthIndex = Math.max(0, Math.min(11, month - 1));
  const monthName = MONTHS[monthIndex];
  return {
    day,
    monthIndex,
    monthName,
    year,
    formatted: `${day} ${monthName} ${year} AH`,
  };
}

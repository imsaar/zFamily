/** Pure helpers for turning addresses / geocode hits into a short "City, ST"
 *  label, plus US state-name ↔ abbreviation lookups. No external deps (safe to
 *  import from db.ts, commute.ts, and geocode.ts). */

export const US_STATE_ABBR: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
  ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
};

const US_STATE_ABBRS = new Set(Object.values(US_STATE_ABBR));

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Normalize a state name or 2-letter code to its 2-letter uppercase code, or
 *  null if it's neither. */
export function stateAbbr(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Za-z]{2}$/.test(t) && US_STATE_ABBRS.has(t.toUpperCase())) return t.toUpperCase();
  return US_STATE_ABBR[t.toLowerCase()] ?? null;
}

/** Split a "Lynnwood WA" / "Lynnwood, Washington" query into a bare city name
 *  and (if present) a US state code, so a city-only geocoder can be queried. */
export function splitCityState(query: string): { city: string; state: string | null } {
  const q = query.trim();
  // "City, ST" or "City, State"
  const comma = q.split(",").map((s) => s.trim()).filter(Boolean);
  if (comma.length >= 2) {
    const st = stateAbbr(comma[comma.length - 1]);
    if (st) return { city: comma.slice(0, -1).join(", "), state: st };
  }
  // "City ST" (trailing 2-letter code)
  const tokens = q.split(/\s+/);
  if (tokens.length >= 2) {
    const st = stateAbbr(tokens[tokens.length - 1]);
    if (st) return { city: tokens.slice(0, -1).join(" "), state: st };
    // "City Full State" — try last two words as a state name
    if (tokens.length >= 3) {
      const st2 = stateAbbr(tokens.slice(-2).join(" "));
      if (st2) return { city: tokens.slice(0, -2).join(" "), state: st2 };
    }
  }
  return { city: q, state: null };
}

/** A short "City, ST" label from geocode fields (US → abbreviated state, no
 *  country; elsewhere → "City, Region" or "City, Country"). */
export function cityLabel(r: { name: string; admin1?: string | null; countryCode?: string | null }): string {
  const isUs = (r.countryCode ?? "").toUpperCase() === "US";
  if (isUs) {
    const st = stateAbbr(r.admin1);
    return st ? `${r.name}, ${st}` : r.name;
  }
  const region = r.admin1 || r.countryCode || "";
  return region ? `${r.name}, ${region}` : r.name;
}

/** Parse "…, Lynnwood, WA", "…, Lynnwood WA", or "Lynnwood, WA 98036" into a
 *  "City, ST" label. Returns null if a city + 2-letter state can't be found. */
export function cityStateFromText(addr: string): string | null {
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  while (parts.length && /^(usa|united states)$/i.test(parts[parts.length - 1])) parts.pop();
  if (parts.length === 0) return null;

  const last = parts[parts.length - 1];
  const tokens = last.split(/\s+/);
  const stIdx = tokens.findIndex((t) => stateAbbr(t));

  let state: string | undefined;
  let cityFromLast = "";
  if (stIdx >= 0) {
    state = stateAbbr(tokens[stIdx]) ?? undefined;
    cityFromLast = tokens.slice(0, stIdx).join(" ").trim();
  }

  let city: string | undefined;
  if (cityFromLast) city = cityFromLast;
  else if (parts.length >= 2) city = parts[parts.length - 2];

  if (city && state) return `${titleCase(city)}, ${state}`;
  return null;
}

/** Whether a label looks like a street address (starts with a house number). */
export function looksLikeStreet(label: string): boolean {
  return /^\s*\d/.test(label);
}

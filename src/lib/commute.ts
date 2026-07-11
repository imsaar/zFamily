import { getSetting } from "./settings";
import { cityStateFromText } from "./address";

/**
 * Commute estimates using free OpenStreetMap services: Nominatim to geocode an
 * address, OSRM to get a driving duration from the configured home location.
 * Both are best-effort — any failure returns null and the event just saves
 * without a commute estimate.
 */

const UA = "zFamily/1.0 (self-hosted family calendar)";

// Fetch JSON with a real abort timeout (returns null on any failure).
async function fetchJson(url: string, headers: Record<string, string> = {}, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type GeoResult = { lat: number; lon: number; display: string; city?: string; state?: string; countryCode?: string };

// Common country names/aliases → ISO code. Used two ways: to tag a Google
// result's country from its formatted address, and to tell whether a typed
// query intentionally names a country outside the home country (so we don't
// filter that place away).
const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "US", usa: "US", "u.s.a": "US", "u.s": "US", "u.s.a.": "US", america: "US",
  canada: "CA", mexico: "MX",
  "united kingdom": "GB", uk: "GB", "u.k": "GB", england: "GB", scotland: "GB", wales: "GB",
  britain: "GB", "great britain": "GB", ireland: "IE",
  france: "FR", germany: "DE", spain: "ES", italy: "IT", portugal: "PT", netherlands: "NL",
  belgium: "BE", switzerland: "CH", austria: "AT", sweden: "SE", norway: "NO", denmark: "DK",
  finland: "FI", poland: "PL", greece: "GR", turkey: "TR", russia: "RU", ukraine: "UA",
  india: "IN", pakistan: "PK", bangladesh: "BD", "sri lanka": "LK", nepal: "NP", china: "CN",
  japan: "JP", "south korea": "KR", korea: "KR", taiwan: "TW", "hong kong": "HK", singapore: "SG",
  malaysia: "MY", indonesia: "ID", thailand: "TH", vietnam: "VN", philippines: "PH",
  australia: "AU", "new zealand": "NZ",
  "saudi arabia": "SA", "united arab emirates": "AE", uae: "AE", qatar: "QA", kuwait: "KW",
  bahrain: "BH", oman: "OM", iran: "IR", iraq: "IQ", israel: "IL", jordan: "JO", lebanon: "LB",
  egypt: "EG", morocco: "MA",
  "south africa": "ZA", nigeria: "NG", kenya: "KE", ghana: "GH", ethiopia: "ET",
  brazil: "BR", argentina: "AR", chile: "CL", colombia: "CO", peru: "PE",
};

// The home country as an ISO code, derived from the saved home address text.
// Only US is detected with confidence (a trailing "USA" or a US state); any
// other/unknown home returns null, which disables the country filter.
function homeCountryCode(): string | null {
  const addr = getSetting("home_address")?.trim();
  if (!addr) return null;
  if (/\b(usa|u\.?s\.?a?\.?|united states)\b/i.test(addr)) return "US";
  if (cityStateFromText(addr)) return "US"; // resolves a US state → US
  return null;
}

// Whether a typed query names a country other than `homeCC` (so results in that
// country should not be filtered out).
function mentionsOtherCountry(query: string, homeCC: string): boolean {
  const q = ` ${query.toLowerCase()} `;
  for (const [alias, cc] of Object.entries(COUNTRY_ALIASES)) {
    if (cc === homeCC) continue;
    // Word-boundary match so "us" in "museum" or "in" in "Lynnwood" don't hit.
    const re = new RegExp(`(?:^|[^a-z])${alias.replace(/[.]/g, "\\.")}(?:[^a-z]|$)`, "i");
    if (re.test(q)) return true;
  }
  return false;
}

// Great-circle distance in km between two lat/lon points (for ranking search
// results by how close they are to home).
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const US_STATE_ABBR: Record<string, string> = {
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

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** A short "City, ST" label from a geocode result (falls back to the address). */
export function cityStateLabel(geo: GeoResult): string {
  const city = geo.city?.trim() ? titleCase(geo.city.trim()) : undefined;
  let state = geo.state?.trim();
  if (state && US_STATE_ABBR[state.toLowerCase()]) state = US_STATE_ABBR[state.toLowerCase()];
  if (city && state) return `${city}, ${state.toUpperCase().length === 2 ? state.toUpperCase() : state}`;
  if (city) return city;
  return geo.display.split(",").slice(0, 2).join(", ").trim() || geo.display;
}

// US Census geocoder — excellent for US residential street addresses (which
// OpenStreetMap/Nominatim often lacks). US-only.
async function censusSearch(query: string): Promise<GeoResult[]> {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=${encodeURIComponent(query)}`;
  const data = (await fetchJson(url)) as {
    result?: { addressMatches?: Array<{ matchedAddress?: string; coordinates?: { x?: number; y?: number }; addressComponents?: { city?: string; state?: string } }> };
  } | null;
  const matches = data?.result?.addressMatches;
  if (!Array.isArray(matches)) return [];
  return matches
    .map((m) => ({
      lat: Number(m.coordinates?.y),
      lon: Number(m.coordinates?.x),
      display: String(m.matchedAddress ?? ""),
      city: m.addressComponents?.city,
      state: m.addressComponents?.state,
      countryCode: "US", // Census is US-only
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.display);
}

// Nominatim (OpenStreetMap) — good for place/business names, POIs, and non-US.
// When `home` is set, a viewbox around it biases (but doesn't restrict) results
// toward the household's area so the closest matches rank first.
async function nominatimSearch(query: string, limit: number, home?: { lat: number; lon: number } | null): Promise<GeoResult[]> {
  let url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`;
  if (home) {
    // ~1.5° box (~165 km) around home; bounded=0 keeps it a preference, not a filter.
    const d = 1.5;
    const vb = `${home.lon - d},${home.lat + d},${home.lon + d},${home.lat - d}`;
    url += `&viewbox=${encodeURIComponent(vb)}&bounded=0`;
  }
  const data = (await fetchJson(url, { "User-Agent": UA, "Accept-Language": "en" })) as Array<{
    lat: string; lon: string; display_name: string;
    address?: { city?: string; town?: string; village?: string; hamlet?: string; municipality?: string; state?: string; country_code?: string };
  }> | null;
  if (!Array.isArray(data)) return [];
  return data
    .map((d) => ({
      lat: Number(d.lat),
      lon: Number(d.lon),
      display: d.display_name,
      city: d.address?.city ?? d.address?.town ?? d.address?.village ?? d.address?.hamlet ?? d.address?.municipality,
      state: d.address?.state,
      countryCode: d.address?.country_code ? d.address.country_code.toUpperCase() : undefined,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
}

// Photon (Komoot, OpenStreetMap-based) — keyless and much better than Nominatim
// at fuzzy business/POI/place-name search. `lat`/`lon` bias ranks matches near
// home first, so a common church/business name resolves locally instead of to a
// same-named place in another state or country.
async function photonSearch(query: string, limit: number, home?: { lat: number; lon: number } | null): Promise<GeoResult[]> {
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`;
  if (home) url += `&lat=${home.lat}&lon=${home.lon}`;
  const data = (await fetchJson(url, { "User-Agent": UA })) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: {
        name?: string; housenumber?: string; street?: string; city?: string;
        town?: string; village?: string; district?: string; state?: string;
        postcode?: string; country?: string; countrycode?: string;
      };
    }>;
  } | null;
  const features = data?.features;
  if (!Array.isArray(features)) return [];
  return features
    .map((f) => {
      const [lon, lat] = f.geometry?.coordinates ?? [NaN, NaN];
      const p = f.properties ?? {};
      const city = p.city ?? p.town ?? p.village ?? p.district;
      const line = [p.housenumber, p.street].filter(Boolean).join(" ");
      const display = [p.name, line, city, p.state, p.postcode]
        .filter((s) => s && String(s).trim())
        .join(", ");
      return {
        lat: Number(lat), lon: Number(lon), display, city, state: p.state,
        countryCode: p.countrycode ? p.countrycode.toUpperCase() : undefined,
      };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.display);
}

function googleKey(): string {
  return getSetting("google_places_key")?.trim() || "";
}

// Parse "…, City, ST 98037, USA" → { city, state } (best effort, US).
function parseUsCityState(addr: string): { city?: string; state?: string } {
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  const usIdx = parts.findIndex((p) => /^(usa|united states)$/i.test(p));
  const end = usIdx > 0 ? usIdx : parts.length;
  const stateZip = parts[end - 1] ?? "";
  const st = stateZip.split(/\s+/)[0];
  const city = parts[end - 2];
  return { city, state: /^[A-Z]{2}$/.test(st) ? st : undefined };
}

// Google Places Text Search — finds businesses/POIs by name (needs an API key).
// A `location`+`radius` around home biases (doesn't restrict) results toward the
// household's area so a same-named place near home outranks a distant one.
async function googlePlacesSearch(query: string, limit: number, home?: { lat: number; lon: number } | null): Promise<GeoResult[]> {
  const key = googleKey();
  if (!key) return [];
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
  if (home) url += `&location=${home.lat},${home.lon}&radius=50000`;
  const data = (await fetchJson(url)) as { results?: Array<{ name?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }> } | null;
  const results = data?.results;
  if (!Array.isArray(results)) return [];
  return results
    .slice(0, limit)
    .map((r) => {
      const loc = r.geometry?.location;
      const addr = r.formatted_address ?? "";
      const { city, state } = parseUsCityState(addr);
      const display = r.name && addr ? `${r.name}, ${addr}` : (addr || r.name || "");
      // Country from the last comma-part of the formatted address (e.g. "USA").
      const lastPart = addr.split(",").map((s) => s.trim()).filter(Boolean).pop() ?? "";
      const countryCode = COUNTRY_ALIASES[lastPart.toLowerCase().replace(/\.$/, "")] ?? undefined;
      return { lat: Number(loc?.lat), lon: Number(loc?.lng), display, city, state, countryCode };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.display);
}

/** Best-match coordinates for an address: Google Places (if a key is set) →
 *  US Census (precise US street addresses) → Nominatim (places/POIs, non-US). */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const q = address.trim();
  if (!q) return null;
  const home = homeCoords();
  const google = await googlePlacesSearch(q, 1, home);
  if (google[0]) return google[0];
  const census = await censusSearch(q);
  if (census[0]) return census[0];
  const photon = await photonSearch(q, 1, home);
  if (photon[0]) return photon[0];
  const nomin = await nominatimSearch(q, 1, home);
  return nomin[0] ?? null;
}

/** Candidate matches for a typed name/address (Google Places if keyed, plus
 *  Census + Nominatim), deduped. */
export async function searchAddresses(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const home = homeCoords();
  const [google, census, photon, nomin] = await Promise.all([
    googlePlacesSearch(q, 6, home),
    censusSearch(q),
    photonSearch(q, 6, home),
    nominatimSearch(q, 5, home),
  ]);
  const seen = new Set<string>();
  let out: GeoResult[] = [];
  for (const r of [...google, ...census, ...photon, ...nomin]) {
    const key = r.display.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  // If home is in a known country (US), hide suggestions from other countries
  // unless the query itself names one — a US household typing "Lynnwood" doesn't
  // want a same-named town abroad. Results with an unknown country are kept.
  const homeCC = homeCountryCode();
  if (homeCC && !mentionsOtherCountry(q, homeCC)) {
    const domestic = out.filter((r) => !r.countryCode || r.countryCode === homeCC);
    if (domestic.length) out = domestic;
  }
  // When home is known, rank the whole (deduped) pool by proximity so nearby
  // matches beat far-away ones with the same name — then cap.
  if (home) out.sort((a, b) => distanceKm(a, home) - distanceKm(b, home));
  return out.slice(0, 6);
}

/** The commute origin: the geocoded home address, else the weather location. */
export function homeCoords(): { lat: number; lon: number } | null {
  const hlat = Number(getSetting("home_lat"));
  const hlon = Number(getSetting("home_lon"));
  if (Number.isFinite(hlat) && Number.isFinite(hlon) && (hlat !== 0 || hlon !== 0)) return { lat: hlat, lon: hlon };
  const wlat = Number(getSetting("weather_lat"));
  const wlon = Number(getSetting("weather_lon"));
  if (Number.isFinite(wlat) && Number.isFinite(wlon)) return { lat: wlat, lon: wlon };
  return null;
}

export type CommuteMode = "car" | "bus";

/** Commute seconds from home to `address` for the given mode, or null. Car uses
 *  OSRM's driving duration; bus is estimated from the driving distance (no free
 *  transit routing), so it's a rough guess. Defaults to car. */
export async function computeCommute(address: string, mode: CommuteMode = "car"): Promise<number | null> {
  const home = homeCoords();
  if (!home || !address.trim()) return null;
  const dest = await geocodeAddress(address);
  if (!dest) return null;
  // OSRM uses lon,lat order. overview=false still returns duration + distance.
  const url = `https://router.project-osrm.org/route/v1/driving/${home.lon},${home.lat};${dest.lon},${dest.lat}?overview=false`;
  const data = (await fetchJson(url, { "User-Agent": UA })) as {
    code?: string;
    routes?: Array<{ duration: number; distance: number }>;
  } | null;
  const route = data?.code === "Ok" ? data.routes?.[0] : undefined;
  if (!route) return null;
  if (mode === "bus") {
    // Rough transit estimate: ~18 km/h effective + a 10 min wait/walk buffer.
    return Math.round(route.distance / 5 + 600);
  }
  return Math.round(route.duration);
}

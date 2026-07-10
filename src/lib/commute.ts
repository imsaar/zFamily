import { getSetting } from "./settings";

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

export type GeoResult = { lat: number; lon: number; display: string; city?: string; state?: string };

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
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.display);
}

// Nominatim (OpenStreetMap) — good for place/business names, POIs, and non-US.
async function nominatimSearch(query: string, limit: number): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}`;
  const data = (await fetchJson(url, { "User-Agent": UA, "Accept-Language": "en" })) as Array<{
    lat: string; lon: string; display_name: string;
    address?: { city?: string; town?: string; village?: string; hamlet?: string; municipality?: string; state?: string };
  }> | null;
  if (!Array.isArray(data)) return [];
  return data
    .map((d) => ({
      lat: Number(d.lat),
      lon: Number(d.lon),
      display: d.display_name,
      city: d.address?.city ?? d.address?.town ?? d.address?.village ?? d.address?.hamlet ?? d.address?.municipality,
      state: d.address?.state,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
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
async function googlePlacesSearch(query: string, limit: number): Promise<GeoResult[]> {
  const key = googleKey();
  if (!key) return [];
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`;
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
      return { lat: Number(loc?.lat), lon: Number(loc?.lng), display, city, state };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && r.display);
}

/** Best-match coordinates for an address: Google Places (if a key is set) →
 *  US Census (precise US street addresses) → Nominatim (places/POIs, non-US). */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const q = address.trim();
  if (!q) return null;
  const google = await googlePlacesSearch(q, 1);
  if (google[0]) return google[0];
  const census = await censusSearch(q);
  if (census[0]) return census[0];
  const nomin = await nominatimSearch(q, 1);
  return nomin[0] ?? null;
}

/** Candidate matches for a typed name/address (Google Places if keyed, plus
 *  Census + Nominatim), deduped. */
export async function searchAddresses(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const [google, census, nomin] = await Promise.all([
    googlePlacesSearch(q, 6),
    censusSearch(q),
    nominatimSearch(q, 5),
  ]);
  const seen = new Set<string>();
  const out: GeoResult[] = [];
  for (const r of [...google, ...census, ...nomin]) {
    const key = r.display.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
    if (out.length >= 6) break;
  }
  return out;
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

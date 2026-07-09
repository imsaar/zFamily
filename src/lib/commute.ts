import { getSetting } from "./settings";

/**
 * Commute estimates using free OpenStreetMap services: Nominatim to geocode an
 * address, OSRM to get a driving duration from the configured home location.
 * Both are best-effort — any failure returns null and the event just saves
 * without a commute estimate.
 */

const UA = "zFamily/1.0 (self-hosted family calendar)";

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await p;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type GeoResult = { lat: number; lon: number; display: string };

/** Geocode a free-text address to coordinates via Nominatim. */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const q = address.trim();
  if (!q) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  const res = await withTimeout(
    fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, cache: "no-store" }),
    8000
  );
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as Array<{ lat: string; lon: string; display_name: string }> | null;
  const first = data?.[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lon = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, display: first.display_name };
}

/** Search addresses/places by a typed name (up to 6 matches) via Nominatim. */
export async function searchAddresses(query: string): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=${encodeURIComponent(q)}`;
  const res = await withTimeout(
    fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, cache: "no-store" }),
    8000
  );
  if (!res || !res.ok) return [];
  const data = (await res.json().catch(() => null)) as Array<{ lat: string; lon: string; display_name: string }> | null;
  if (!data) return [];
  return data
    .map((d) => ({ lat: Number(d.lat), lon: Number(d.lon), display: d.display_name }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon));
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
  const res = await withTimeout(fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" }), 8000);
  if (!res || !res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
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

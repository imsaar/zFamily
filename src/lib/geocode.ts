/** City/state → lat/lon lookup via Open-Meteo geocoding API (no key). */

export type GeocodeResult = {
  name: string;
  admin1: string | null;    // state/region
  country: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  timezone: string;         // IANA, e.g. "America/Los_Angeles"
  population: number | null;
};

export async function searchCity(query: string, count = 8): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q);
  url.searchParams.set("count", String(count));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((r: {
      name: string;
      admin1?: string;
      country?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
      timezone: string;
      population?: number;
    }) => ({
      name: r.name,
      admin1: r.admin1 ?? null,
      country: r.country ?? null,
      countryCode: r.country_code ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
      population: r.population ?? null,
    }));
  } catch {
    return [];
  }
}

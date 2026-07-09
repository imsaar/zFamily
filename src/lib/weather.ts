import { getSetting } from "./settings";

export type WeatherSnapshot = {
  label: string;
  currentTempF: number;
  currentCondition: string;
  conditionIcon: string;
  highF: number;
  lowF: number;
  forecast: Array<{ date: string; highF: number; lowF: number; icon: string; condition: string }>;
  hourly: Array<{ time: string; tempF: number; icon: string; condition: string }>;
  fetchedAt: number;
};

let cache: { data: WeatherSnapshot; expiresAt: number; key: string } | null = null;

/** Explicitly drop the cache — call after weather settings change. */
export function resetWeatherCache() {
  cache = null;
}

// https://open-meteo.com/en/docs#weathervariables
const WMO_MAP: Record<number, { icon: string; condition: string }> = {
  0:  { icon: "☀️", condition: "Clear" },
  1:  { icon: "🌤️", condition: "Mostly clear" },
  2:  { icon: "⛅",  condition: "Partly cloudy" },
  3:  { icon: "☁️", condition: "Overcast" },
  45: { icon: "🌫️", condition: "Fog" },
  48: { icon: "🌫️", condition: "Fog" },
  51: { icon: "🌦️", condition: "Light drizzle" },
  53: { icon: "🌦️", condition: "Drizzle" },
  55: { icon: "🌧️", condition: "Heavy drizzle" },
  61: { icon: "🌧️", condition: "Light rain" },
  63: { icon: "🌧️", condition: "Rain" },
  65: { icon: "🌧️", condition: "Heavy rain" },
  71: { icon: "🌨️", condition: "Light snow" },
  73: { icon: "🌨️", condition: "Snow" },
  75: { icon: "❄️", condition: "Heavy snow" },
  77: { icon: "🌨️", condition: "Snow grains" },
  80: { icon: "🌧️", condition: "Rain showers" },
  81: { icon: "🌧️", condition: "Heavy showers" },
  82: { icon: "⛈️", condition: "Violent showers" },
  95: { icon: "⛈️", condition: "Thunderstorm" },
  96: { icon: "⛈️", condition: "Thunderstorm w/ hail" },
  99: { icon: "⛈️", condition: "Severe storm" },
};

function descCode(code: number) {
  return WMO_MAP[code] ?? { icon: "🌡️", condition: "Unknown" };
}

export async function getWeather(): Promise<WeatherSnapshot | null> {
  const lat = getSetting("weather_lat");
  const lon = getSetting("weather_lon");
  const label = getSetting("weather_label") ?? "";
  const tz = getSetting("weather_tz") || "auto";
  if (!lat || !lon) return null;

  // Cache key includes every field that would change the fetched payload —
  // so changing city in Settings invalidates immediately.
  const key = `${lat}|${lon}|${tz}|${label}`;
  if (cache && cache.expiresAt > Date.now() && cache.key === key) return cache.data;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", tz);
  url.searchParams.set("forecast_days", "7");

  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data.current ?? {};
    const daily = data.daily ?? {};
    const hourlyRaw = data.hourly ?? {};
    const curDesc = descCode(cur.weather_code ?? 0);
    const forecast = (daily.time ?? []).map((d: string, i: number) => {
      const c = descCode(daily.weather_code?.[i] ?? 0);
      return {
        date: d,
        highF: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        lowF: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        icon: c.icon,
        condition: c.condition,
      };
    });

    // Hourly for the rest of today (the API returns times already in the
    // requested timezone). Filter to today's date and from the current hour.
    const today: string | undefined = daily.time?.[0];
    const nowHour = String(cur.time ?? "").slice(0, 13); // "YYYY-MM-DDTHH"
    const hourly = (hourlyRaw.time ?? [])
      .map((t: string, i: number) => {
        const c = descCode(hourlyRaw.weather_code?.[i] ?? 0);
        return { time: t, tempF: Math.round(hourlyRaw.temperature_2m?.[i] ?? 0), icon: c.icon, condition: c.condition };
      })
      .filter((h: { time: string }) => today && h.time.startsWith(today) && h.time.slice(0, 13) >= nowHour)
      .slice(0, 12);

    const snap: WeatherSnapshot = {
      label,
      currentTempF: Math.round(cur.temperature_2m ?? 0),
      currentCondition: curDesc.condition,
      conditionIcon: curDesc.icon,
      highF: forecast[0]?.highF ?? 0,
      lowF: forecast[0]?.lowF ?? 0,
      forecast,
      hourly,
      fetchedAt: Date.now(),
    };
    cache = { data: snap, expiresAt: Date.now() + 10 * 60 * 1000, key };
    return snap;
  } catch {
    return null;
  }
}

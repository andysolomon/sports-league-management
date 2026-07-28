import { CloudRain, CloudSnow, Snowflake, Sun, Wind } from "lucide-react";
import type { Weather } from "@/lib/pbp/weather";
import { cn } from "@/lib/utils";

/*
 * Conditions chip (A5).
 *
 * Two very different callers, and the difference matters:
 *
 * - The schedule shows a FORECAST for a game nobody has played. It is derived
 *   from season, week and venue, and it is stable, so it is a real prediction
 *   rather than a guess.
 * - The Gamecast shows what a game was ACTUALLY played in, read off the stored
 *   log.
 *
 * These must never be interchanged. Substituting the forecast for a completed
 * v1 game would assert that a game was played in conditions the engine never
 * modelled — the same fabricated-fact problem as reporting 0 penalties for a
 * game nobody counted.
 */

function WeatherIcon({ weather }: { weather: Weather }) {
  const className = "h-3.5 w-3.5 shrink-0";
  if (weather.precipitation !== "none") {
    return weather.temperatureF <= 32 ? (
      <CloudSnow className={className} aria-hidden />
    ) : (
      <CloudRain className={className} aria-hidden />
    );
  }
  if (weather.windMph >= 18) return <Wind className={className} aria-hidden />;
  if (weather.temperatureF <= 32) {
    return <Snowflake className={className} aria-hidden />;
  }
  return <Sun className={className} aria-hidden />;
}

export function WeatherChip({
  weather,
  variant = "forecast",
  className,
}: {
  weather: Weather;
  /** `forecast` for an unplayed game, `actual` for what a game was played in. */
  variant?: "forecast" | "actual";
  className?: string;
}) {
  const label = `${weather.condition}, ${weather.temperatureF}°F, wind ${weather.windMph} mph`;
  return (
    <span
      data-testid="weather-chip"
      data-weather-variant={variant}
      title={variant === "forecast" ? `Forecast: ${label}` : label}
      aria-label={variant === "forecast" ? `Forecast: ${label}` : label}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-caption-12 text-text-muted",
        className,
      )}
    >
      <WeatherIcon weather={weather} />
      <span>{weather.temperatureF}°</span>
    </span>
  );
}

/** Full-width conditions strip for the Gamecast. */
export function WeatherStrip({ weather }: { weather: Weather }) {
  return (
    <div
      data-testid="gamecast-weather"
      className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface-2 px-3 py-2 text-caption-12 text-text-muted"
    >
      <span className="inline-flex items-center gap-1.5 text-foreground">
        <WeatherIcon weather={weather} />
        {weather.condition}
      </span>
      <span>{weather.temperatureF}°F</span>
      <span>Wind {weather.windMph} mph</span>
      {weather.precipitation === "none" ? null : (
        <span className="capitalize">{weather.precipitation} precipitation</span>
      )}
    </div>
  );
}

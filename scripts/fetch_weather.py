#!/usr/bin/env python3
"""Update weather.json without failing the site on a temporary provider outage."""
from __future__ import annotations

import json
import pathlib
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "weather.json"
BOM_URLS = (
    "https://www.bom.gov.au/fwo/IDV60801/IDV60801.95936.json",
    "https://www.bom.gov.au/fwo/IDV60901/IDV60901.95936.json",
)
OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"
USER_AGENT = "Aurecon-Split-Flap-Wall/1.0 (+https://github.com/creative-innovation-labs-bmc/aurecon-split-flap-wall)"


def request_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def utc_iso(value: str | None) -> str | None:
    if not value or len(value) != 14:
        return None
    dt = datetime.strptime(value, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def condition_from_text(record: dict) -> str:
    weather = str(record.get("weather") or "").strip().upper()
    if not weather or weather in {"-", "N/A"}:
        return "LIVE"
    if "THUNDER" in weather or "STORM" in weather:
        return "STORM"
    if "SHOWER" in weather:
        return "SHOWER"
    if "RAIN" in weather:
        return "RAIN"
    if "FOG" in weather:
        return "FOG"
    return weather[:7]


def bom_weather() -> dict:
    errors: list[str] = []
    for url in BOM_URLS:
        try:
            payload = request_json(url)
            data = payload.get("observations", {}).get("data", [])
            if not data:
                raise RuntimeError("response contained no observations")
            record = data[0]
            return {
                "source": "Bureau of Meteorology",
                "station": record.get("name", "Melbourne (Olympic Park)"),
                "station_wmo": record.get("wmo", 95936),
                "status": "ok",
                "temp_c": record.get("air_temp"),
                "apparent_temp_c": record.get("apparent_t"),
                "condition": condition_from_text(record),
                "wind_dir": record.get("wind_dir"),
                "wind_kmh": record.get("wind_spd_kmh"),
                "gust_kmh": record.get("gust_kmh"),
                "humidity_pct": record.get("rel_hum"),
                "rain_since_9am_mm": record.get("rain_trace"),
                "pressure_hpa": record.get("press_msl"),
                "observation_local": record.get("local_date_time_full"),
                "observation_utc": utc_iso(record.get("aifstime_utc")),
                "updated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "copyright": "Copyright Commonwealth of Australia, Bureau of Meteorology",
            }
        except Exception as exc:  # provider/network failures should not kill the workflow
            errors.append(f"{url}: {exc}")
    raise RuntimeError("; ".join(errors))


def compass_direction(degrees: object) -> str:
    try:
        value = float(degrees)
    except (TypeError, ValueError):
        return "--"
    points = ("N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW")
    return points[round((value % 360) / 22.5) % 16]


def condition_from_code(code: object) -> str:
    try:
        value = int(code)
    except (TypeError, ValueError):
        return "MODEL"
    if value == 0:
        return "CLEAR"
    if value in {1, 2}:
        return "PARTLY"
    if value == 3:
        return "CLOUDY"
    if value in {45, 48}:
        return "FOG"
    if value in {51, 53, 55, 56, 57}:
        return "DRIZZLE"
    if value in {61, 63, 65, 66, 67}:
        return "RAIN"
    if value in {71, 73, 75, 77}:
        return "SNOW"
    if value in {80, 81, 82, 85, 86}:
        return "SHOWER"
    if value in {95, 96, 99}:
        return "STORM"
    return "MODEL"


def rain_since_nine(data: dict) -> float:
    times = data.get("hourly", {}).get("time", [])
    amounts = data.get("hourly", {}).get("precipitation", [])
    current_time = data.get("current", {}).get("time")
    if not current_time or not times or not amounts:
        return float(data.get("current", {}).get("precipitation") or 0)
    current = datetime.fromisoformat(current_time)
    start = current.replace(hour=9, minute=0, second=0, microsecond=0)
    if current < start:
        start = start.replace(day=start.day - 1)
    total = 0.0
    for stamp, amount in zip(times, amounts):
        moment = datetime.fromisoformat(stamp)
        if start <= moment <= current:
            try:
                total += float(amount or 0)
            except (TypeError, ValueError):
                pass
    return round(total, 1)


def model_weather() -> dict:
    query = urllib.parse.urlencode(
        {
            "latitude": -37.8178,
            "longitude": 144.9468,
            "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
            "hourly": "precipitation",
            "past_days": 1,
            "forecast_days": 1,
            "timezone": "Australia/Melbourne",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        }
    )
    data = request_json(f"{OPEN_METEO_BASE}?{query}")
    current = data.get("current", {})
    if current.get("temperature_2m") is None:
        raise RuntimeError("Open-Meteo returned no current temperature")
    updated = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "source": "Open-Meteo model fallback",
        "station": "850 Collins Street, Docklands",
        "station_wmo": None,
        "status": "ok",
        "temp_c": current.get("temperature_2m"),
        "apparent_temp_c": current.get("apparent_temperature"),
        "condition": condition_from_code(current.get("weather_code")),
        "wind_dir": compass_direction(current.get("wind_direction_10m")),
        "wind_kmh": round(float(current.get("wind_speed_10m") or 0)),
        "gust_kmh": None,
        "humidity_pct": round(float(current.get("relative_humidity_2m") or 0)),
        "rain_since_9am_mm": rain_since_nine(data),
        "pressure_hpa": None,
        "observation_local": current.get("time"),
        "observation_utc": updated,
        "updated_utc": updated,
        "copyright": "Weather model data provided by Open-Meteo",
    }


def main() -> None:
    try:
        output = bom_weather()
        print("Using fresh BOM observation")
    except Exception as bom_error:
        print(f"BOM unavailable: {bom_error}")
        try:
            output = model_weather()
            print("Using Open-Meteo fallback")
        except Exception as fallback_error:
            print(f"Weather fallback unavailable: {fallback_error}")
            print("Keeping the last committed weather.json; workflow will exit successfully")
            return
    OUTPUT.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

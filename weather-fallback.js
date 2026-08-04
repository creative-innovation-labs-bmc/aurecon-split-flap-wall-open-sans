(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  const WEATHER_FILE = 'weather.json';
  const MAX_BOM_AGE_MS = 90 * 60 * 1000;

  function isWeatherRequest(input) {
    const url = typeof input === 'string' ? input : input?.url || '';
    return url.includes(WEATHER_FILE);
  }

  function bomIsUsable(data) {
    if (!data || data.status !== 'ok' || data.temp_c == null) return false;
    const stamp = data.observation_utc || data.updated_utc;
    if (!stamp) return true;
    const age = Date.now() - new Date(stamp).getTime();
    return !Number.isFinite(age) || age <= MAX_BOM_AGE_MS;
  }

  function compassDirection(degrees) {
    const value = Number(degrees);
    if (!Number.isFinite(value)) return '--';
    const points = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round((((value % 360) + 360) % 360) / 22.5) % 16;
    return points[index];
  }

  function conditionFromCode(code) {
    const value = Number(code);
    if (value === 0) return 'CLEAR';
    if ([1, 2].includes(value)) return 'PARTLY';
    if (value === 3) return 'CLOUDY';
    if ([45, 48].includes(value)) return 'FOG';
    if ([51, 53, 55, 56, 57].includes(value)) return 'DRIZZLE';
    if ([61, 63, 65, 66, 67].includes(value)) return 'RAIN';
    if ([71, 73, 75, 77].includes(value)) return 'SNOW';
    if ([80, 81, 82, 85, 86].includes(value)) return 'SHOWER';
    if ([95, 96, 99].includes(value)) return 'STORM';
    return 'MODEL';
  }

  function rainSinceNineAm(data) {
    const times = data?.hourly?.time;
    const precipitation = data?.hourly?.precipitation;
    const currentTime = data?.current?.time;
    if (!Array.isArray(times) || !Array.isArray(precipitation) || !currentTime) {
      return Number(data?.current?.precipitation) || 0;
    }

    const current = new Date(currentTime);
    if (Number.isNaN(current.getTime())) return Number(data?.current?.precipitation) || 0;
    const start = new Date(current);
    start.setHours(9, 0, 0, 0);
    if (current < start) start.setDate(start.getDate() - 1);

    return times.reduce((total, time, index) => {
      const stamp = new Date(time);
      const amount = Number(precipitation[index]);
      if (stamp >= start && stamp <= current && Number.isFinite(amount)) return total + amount;
      return total;
    }, 0);
  }

  async function modelWeatherResponse() {
    const query = new URLSearchParams({
      latitude: '-37.8178',
      longitude: '144.9468',
      current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
      hourly: 'precipitation',
      past_days: '1',
      forecast_days: '1',
      timezone: 'Australia/Melbourne',
      wind_speed_unit: 'kmh',
      precipitation_unit: 'mm'
    });
    const response = await nativeFetch(`https://api.open-meteo.com/v1/forecast?${query}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
    const data = await response.json();
    const current = data.current || {};
    if (current.temperature_2m == null) throw new Error('Open-Meteo returned no current temperature');

    const payload = {
      source: 'Open-Meteo model fallback',
      status: 'ok',
      temp_c: current.temperature_2m,
      condition: conditionFromCode(current.weather_code),
      wind_dir: compassDirection(current.wind_direction_10m),
      wind_kmh: Math.round(Number(current.wind_speed_10m)),
      humidity_pct: Math.round(Number(current.relative_humidity_2m)),
      rain_since_9am_mm: rainSinceNineAm(data),
      observation_utc: new Date().toISOString(),
      updated_utc: new Date().toISOString()
    };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  window.fetch = async function weatherAwareFetch(input, init) {
    if (!isWeatherRequest(input)) return nativeFetch(input, init);

    let bomResponse = null;
    try {
      bomResponse = await nativeFetch(input, init);
      if (bomResponse.ok) {
        const data = await bomResponse.clone().json();
        if (bomIsUsable(data)) return bomResponse;
      }
    } catch (error) {
      console.warn('BOM cache unavailable:', error);
    }

    try {
      console.warn('Using Open-Meteo model fallback until fresh BOM data is available.');
      return await modelWeatherResponse();
    } catch (error) {
      console.warn('Model weather fallback unavailable:', error);
      if (bomResponse) return bomResponse;
      throw error;
    }
  };
})();

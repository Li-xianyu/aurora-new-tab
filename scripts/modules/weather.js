import { getCurrentLanguage, subscribeLanguageChange, t, translateWeatherCode } from "./i18n.js";
import { toSimplifiedChinese } from "./chinese-t2s.js";

const WEATHER_CACHE_KEY = "weatherWidgetCache";
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;
const WEATHER_REQUEST_TIMEOUT_MS = 8000;
const DEGREE_SYMBOL = "\u00B0";

const WEATHER_ICON_MAP = {
  0: { iconDay: "bi-brightness-high", iconNight: "bi-moon-stars" },
  1: { iconDay: "bi-brightness-high", iconNight: "bi-moon-stars" },
  2: { iconDay: "bi-cloud-sun", iconNight: "bi-cloud-moon" },
  3: { iconDay: "bi-clouds", iconNight: "bi-clouds" },
  45: { iconDay: "bi-cloud-fog2", iconNight: "bi-cloud-fog2" },
  48: { iconDay: "bi-cloud-fog2", iconNight: "bi-cloud-fog2" },
  51: { iconDay: "bi-cloud-drizzle", iconNight: "bi-cloud-drizzle" },
  53: { iconDay: "bi-cloud-drizzle", iconNight: "bi-cloud-drizzle" },
  55: { iconDay: "bi-cloud-drizzle", iconNight: "bi-cloud-drizzle" },
  61: { iconDay: "bi-cloud-rain", iconNight: "bi-cloud-rain" },
  63: { iconDay: "bi-cloud-rain-heavy", iconNight: "bi-cloud-rain-heavy" },
  65: { iconDay: "bi-cloud-rain-heavy", iconNight: "bi-cloud-rain-heavy" },
  71: { iconDay: "bi-cloud-snow", iconNight: "bi-cloud-snow" },
  73: { iconDay: "bi-cloud-snow", iconNight: "bi-cloud-snow" },
  75: { iconDay: "bi-cloud-snow-fill", iconNight: "bi-cloud-snow-fill" },
  77: { iconDay: "bi-cloud-hail", iconNight: "bi-cloud-hail" },
  80: { iconDay: "bi-cloud-rain", iconNight: "bi-cloud-rain" },
  81: { iconDay: "bi-cloud-rain-heavy", iconNight: "bi-cloud-rain-heavy" },
  82: { iconDay: "bi-cloud-rain-heavy", iconNight: "bi-cloud-rain-heavy" },
  95: { iconDay: "bi-cloud-lightning-rain", iconNight: "bi-cloud-lightning-rain" },
  96: { iconDay: "bi-cloud-lightning-rain", iconNight: "bi-cloud-lightning-rain" },
  99: { iconDay: "bi-cloud-lightning-rain", iconNight: "bi-cloud-lightning-rain" },
};

function getWeatherDescriptor(code, isDay) {
  const descriptor = WEATHER_ICON_MAP[code] || {
    iconDay: "bi-cloud",
    iconNight: "bi-cloud",
  };

  return {
    text: translateWeatherCode(code),
    iconClass: isDay ? descriptor.iconDay : descriptor.iconNight,
  };
}

function uniqueDefined(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildChineseLocation(geo) {
  const candidates = [geo?.locality, geo?.city, geo?.principalSubdivision];
  const unique = uniqueDefined(candidates);
  const top2 = unique.slice(0, 2);
  const reversed = top2.reverse();
  return toSimplifiedChinese(reversed.join(" "));
}

function buildEnglishLocation(geo) {
  return uniqueDefined([
    geo?.city,
    geo?.principalSubdivisionCode?.replace(/^[A-Z]{2}-/, ""),
    geo?.countryName,
  ])
    .slice(0, 2)
    .join(", ");
}


async function getCachedWeather() {
  const result = await chrome.storage.local.get(WEATHER_CACHE_KEY);
  return result[WEATHER_CACHE_KEY] || null;
}

async function setCachedWeather(payload) {
  await chrome.storage.local.set({
    [WEATHER_CACHE_KEY]: {
      ...payload,
      cachedAt: Date.now(),
    },
  });
}

function isFresh(cache) {
  return Boolean(cache?.cachedAt) && Date.now() - cache.cachedAt < WEATHER_CACHE_TTL_MS;
}

function createWeatherError(code, message, cause) {
  const error = new Error(message);
  error.name = "WeatherWidgetError";
  error.code = code;
  error.cause = cause;
  return error;
}

async function fetchJson(url, { timeoutMs = WEATHER_REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createWeatherError("http", `Request failed with status ${response.status}.`);
    }

    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createWeatherError("timeout", "Request timed out.", error);
    }

    if (error?.name === "WeatherWidgetError") {
      throw error;
    }

    throw createWeatherError("network", "Request failed.", error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error?.code === error.PERMISSION_DENIED) {
          reject(createWeatherError("geolocation-denied", "Geolocation permission denied.", error));
          return;
        }

        if (error?.code === error.POSITION_UNAVAILABLE) {
          reject(createWeatherError("geolocation-unavailable", "Geolocation is unavailable.", error));
          return;
        }

        if (error?.code === error.TIMEOUT) {
          reject(createWeatherError("geolocation-timeout", "Geolocation timed out.", error));
          return;
        }

        reject(createWeatherError("geolocation", "Failed to resolve geolocation.", error));
      },
      {
        enableHighAccuracy: false,
        timeout: WEATHER_REQUEST_TIMEOUT_MS,
        maximumAge: WEATHER_CACHE_TTL_MS,
      }
    );
  });
}

async function fetchLocationPayload(lat, lon, lang) {
  try {
    return await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${lang}`
    );
  } catch {
    return null;
  }
}

async function fetchWeatherPayload() {
  const position = await getCurrentPosition();
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  const [geoCn, geoEn, weather] = await Promise.all([
    fetchLocationPayload(lat, lon, "zh-Hans"),
    fetchLocationPayload(lat, lon, "en"),
    fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    ),
  ]);

  const current = weather.current || {};
  const daily = weather.daily || {};

  if (
    current.temperature_2m == null ||
    current.apparent_temperature == null ||
    current.relative_humidity_2m == null ||
    current.wind_speed_10m == null
  ) {
    throw createWeatherError("invalid-payload", "Weather payload is incomplete.");
  }

  return {
    locationCn: buildChineseLocation(geoCn) || buildEnglishLocation(geoCn) || "",
    locationEn: buildEnglishLocation(geoEn) || "",
    weatherCode: Number(current.weather_code ?? -1),
    isDay: current.is_day === 1,
    temperature: Math.round(current.temperature_2m ?? 0),
    feelsLike: Math.round(current.apparent_temperature ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    windSpeed: Math.round(current.wind_speed_10m ?? 0),
    maxTemp: Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0),
    minTemp: Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0),
    observedAt: new Date().toISOString(),
  };
}

function formatObservedTime(value) {
  if (!value) {
    return t("weatherUpdatedFallback");
  }

  const observedDate = new Date(value);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - observedDate.getTime()) / (60 * 1000)));

  if (diffMinutes < 1) {
    return t("weatherJustNow");
  }

  if (diffMinutes < 60) {
    return t(diffMinutes === 1 ? "weatherMinuteAgo" : "weatherMinutesAgo", { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return t(diffHours === 1 ? "weatherHourAgo" : "weatherHoursAgo", { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);
  return t(diffDays === 1 ? "weatherDayAgo" : "weatherDaysAgo", { count: diffDays });
}

function renderWeather(widgetElement, elements, payload) {
  const descriptor = getWeatherDescriptor(payload.weatherCode, payload.isDay);
  elements.iconElement.className = `weather-summary-icon bi ${descriptor.iconClass}`;

  const currentLang = getCurrentLanguage();
  let loc = "";
  if (payload.locationCn || payload.locationEn) {
    loc = currentLang === "en"
      ? (payload.locationEn || t("weatherCurrentLocation"))
      : (payload.locationCn || payload.locationEn || t("weatherCurrentLocation"));
  } else {
    loc = payload.location || t("weatherCurrentLocation");
  }
  elements.locationElement.textContent = loc;

  elements.temperatureElement.textContent = `${payload.temperature}${DEGREE_SYMBOL}`;
  elements.descElement.textContent = descriptor.text;
  elements.rangeElement.textContent = `${payload.minTemp}${DEGREE_SYMBOL} / ${payload.maxTemp}${DEGREE_SYMBOL}`;
  elements.feelsElement.textContent = `${t("weatherFeelsLike")} ${payload.feelsLike}${DEGREE_SYMBOL}`;
  elements.humidityElement.textContent = `${t("weatherHumidity")} ${payload.humidity}%`;
  elements.windElement.textContent = `${t("weatherWind")} ${payload.windSpeed} ${t("weatherUnitSpeed")}`;
  elements.updatedElement.textContent = `${t("weatherUpdated")} ${formatObservedTime(payload.observedAt)}`;
  widgetElement.hidden = false;
}

function renderWeatherUnavailable(widgetElement, elements) {
  elements.iconElement.className = "weather-summary-icon bi bi-cloud-slash";
  elements.locationElement.textContent = t("weatherCurrentLocation");
  elements.temperatureElement.textContent = `--${DEGREE_SYMBOL}`;
  elements.descElement.textContent = t("weatherUnknown");
  elements.rangeElement.textContent = `--${DEGREE_SYMBOL} / --${DEGREE_SYMBOL}`;
  elements.feelsElement.textContent = `${t("weatherFeelsLike")} --${DEGREE_SYMBOL}`;
  elements.humidityElement.textContent = `${t("weatherHumidity")} --%`;
  elements.windElement.textContent = `${t("weatherWind")} -- ${t("weatherUnitSpeed")}`;
  elements.updatedElement.textContent = `${t("weatherUpdated")} ${t("weatherUpdatedFallback")}`;
  widgetElement.hidden = false;
}

export function initializeWeatherWidget({
  widgetElement,
  iconElement,
  locationElement,
  temperatureElement,
  descElement,
  rangeElement,
  feelsElement,
  humidityElement,
  windElement,
  updatedElement,
  refreshButtonElement,
}) {
  if (
    !widgetElement ||
    !iconElement ||
    !locationElement ||
    !temperatureElement ||
    !descElement ||
    !rangeElement ||
    !feelsElement ||
    !humidityElement ||
    !windElement ||
    !updatedElement ||
    !refreshButtonElement
  ) {
    return {
      destroy() {},
      refresh() {},
    };
  }

  const elements = {
    iconElement,
    locationElement,
    temperatureElement,
    descElement,
    rangeElement,
    feelsElement,
    humidityElement,
    windElement,
    updatedElement,
  };

  let isRefreshing = false;
  let destroyed = false;
  let currentPayload = null;

  const setRefreshing = (value) => {
    isRefreshing = value;
    refreshButtonElement.disabled = value;
    refreshButtonElement.classList.toggle("is-spinning", value);
  };

  const load = async ({ force = false } = {}) => {
    if (destroyed || isRefreshing) {
      return;
    }

    setRefreshing(true);
    let cached = null;

    try {
      cached = await getCachedWeather();

      if (!force && isFresh(cached)) {
        currentPayload = cached;
        if (!destroyed) {
          renderWeather(widgetElement, elements, cached);
        }
        return;
      }

      const payload = await fetchWeatherPayload();
      currentPayload = payload;
      await setCachedWeather(payload);

      if (!destroyed) {
        renderWeather(widgetElement, elements, payload);
      }
    } catch {
      if (destroyed) {
        return;
      }

      if (cached) {
        currentPayload = cached;
        renderWeather(widgetElement, elements, cached);
        return;
      }

      currentPayload = null;
      renderWeatherUnavailable(widgetElement, elements);
    } finally {
      if (!destroyed) {
        setRefreshing(false);
      }
    }
  };

  const handleRefreshClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    load({ force: true });
  };

  const handleLanguageChange = () => {
    if (destroyed) {
      return;
    }

    if (currentPayload) {
      renderWeather(widgetElement, elements, currentPayload);
      return;
    }

    renderWeatherUnavailable(widgetElement, elements);
  };

  refreshButtonElement.addEventListener("click", handleRefreshClick);
  const unsubscribeLanguage = subscribeLanguageChange(handleLanguageChange);

  locationElement.textContent = t("weatherLocating");
  descElement.textContent = t("weatherLoading");
  load();

  return {
    refresh() {
      load({ force: true });
    },
    destroy() {
      destroyed = true;
      unsubscribeLanguage();
      refreshButtonElement.removeEventListener("click", handleRefreshClick);
      setRefreshing(false);
      widgetElement.hidden = true;
    },
  };
}

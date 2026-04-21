import { getCurrentLanguage, subscribeLanguageChange, t, translateWeatherCode } from "./i18n.js";

const WEATHER_CACHE_KEY = "weatherWidgetCache";
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

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

function toSimplifiedChinese(text) {
  const map = {
    臺: "台",
    區: "区",
    縣: "县",
    鄉: "乡",
    鎮: "镇",
    廣: "广",
    東: "东",
    門: "门",
    陽: "阳",
    陰: "阴",
    灣: "湾",
    龍: "龙",
    雲: "云",
    蘇: "苏",
    鄖: "郧",
  };

  return String(text || "")
    .split("")
    .map((char) => map[char] || char)
    .join("");
}

function looksTraditional(text) {
  return /[臺區縣鄉鎮廣東門陽陰灣龍雲蘇鄖]/.test(String(text || ""));
}

function normalizeChineseLocation(geo) {
  const parts = [geo?.locality, geo?.city, geo?.principalSubdivision].filter(Boolean);
  return toSimplifiedChinese([...new Set(parts)].slice(0, 2).join(" "));
}

function buildEnglishLocation(geo) {
  const parts = [
    geo?.city,
    geo?.principalSubdivisionCode?.replace(/^[A-Z]{2}-/, ""),
    geo?.countryName,
  ].filter(Boolean);

  return [...new Set(parts)].slice(0, 2).join(", ") || t("weatherCurrentLocation");
}

function resolveLocationText(geo) {
  if (getCurrentLanguage() === "en") {
    return buildEnglishLocation(geo);
  }

  const chineseText = normalizeChineseLocation(geo);
  if (chineseText && !looksTraditional(chineseText)) {
    return chineseText;
  }

  return buildEnglishLocation(geo);
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
  return Boolean(cache?.cachedAt) && (Date.now() - cache.cachedAt) < WEATHER_CACHE_TTL_MS;
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 8000,
      maximumAge: WEATHER_CACHE_TTL_MS,
    });
  });
}

async function fetchWeatherPayload() {
  const position = await getCurrentPosition();
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;

  const [geoResponse, weatherResponse] = await Promise.all([
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh`),
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`),
  ]);

  if (!geoResponse.ok || !weatherResponse.ok) {
    throw new Error("Failed to load weather data.");
  }

  const geo = await geoResponse.json();
  const weather = await weatherResponse.json();
  const current = weather.current || {};
  const daily = weather.daily || {};

  return {
    location: resolveLocationText(geo),
    weatherCode: Number(current.weather_code ?? -1),
    isDay: current.is_day === 1,
    temperature: Math.round(current.temperature_2m ?? 0),
    feelsLike: Math.round(current.apparent_temperature ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    windSpeed: Math.round(current.wind_speed_10m ?? 0),
    maxTemp: Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m ?? 0),
    minTemp: Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m ?? 0),
    observedAt: current.time || "",
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
  elements.locationElement.textContent = payload.location;
  elements.temperatureElement.textContent = `${payload.temperature}°`;
  elements.descElement.textContent = descriptor.text;
  elements.rangeElement.textContent = `${payload.minTemp}° / ${payload.maxTemp}°`;
  elements.feelsElement.textContent = `${t("weatherFeelsLike")} ${payload.feelsLike}°`;
  elements.humidityElement.textContent = `${t("weatherHumidity")} ${payload.humidity}%`;
  elements.windElement.textContent = `${t("weatherWind")} ${payload.windSpeed} ${t("weatherUnitSpeed")}`;
  elements.updatedElement.textContent = `${t("weatherUpdated")} ${formatObservedTime(payload.observedAt)}`;
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

    try {
      const cached = await getCachedWeather();

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
    } catch (error) {
      if (!destroyed) {
        console.error("Weather widget failed:", error);
      }
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
      load({ force: true });
      return;
    }

    locationElement.textContent = t("weatherLocating");
    descElement.textContent = t("weatherLoading");
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

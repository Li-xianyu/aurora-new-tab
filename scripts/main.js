import { initializeSearch } from "./modules/search.js";
import { initializeClock } from "./modules/time.js";
import { initializeDailyBackground } from "./modules/background.js";
import { initializeSavedLinks } from "./modules/saved-links.js";
import { initializeFrequentLinks } from "./modules/frequent-links.js";
import { initializeHistory } from "./modules/history.js";
import { initializeI18n, setLanguage, subscribeLanguageChange, t } from "./modules/i18n.js";
import { initializeWeatherWidget } from "./modules/weather.js";
import { initializeScrollScreens } from "./modules/scroll-screens.js";
import { getQuickLinkOpenMode, setQuickLinkOpenMode } from "./modules/saved-links.js";

const WEATHER_ENABLED_STORAGE_KEY = "weatherWidgetEnabled";
const REDUCED_MOTION_STORAGE_KEY = "reducedGlobalMotion";

async function getWeatherEnabled() {
  const result = await chrome.storage.local.get(WEATHER_ENABLED_STORAGE_KEY);
  return result[WEATHER_ENABLED_STORAGE_KEY] !== false;
}

async function setWeatherEnabled(enabled) {
  await chrome.storage.local.set({
    [WEATHER_ENABLED_STORAGE_KEY]: Boolean(enabled),
  });
}

async function getReducedMotionEnabled() {
  const result = await chrome.storage.local.get(REDUCED_MOTION_STORAGE_KEY);
  return result[REDUCED_MOTION_STORAGE_KEY] === true;
}

async function setReducedMotionEnabled(enabled) {
  await chrome.storage.local.set({
    [REDUCED_MOTION_STORAGE_KEY]: Boolean(enabled),
  });
}

function applyReducedMotionState(enabled) {
  document.body.classList.toggle("is-reduced-motion", Boolean(enabled));
}

function applyStaticTranslations() {
  document.title = t("pageTitle");
  document.getElementById("settings-placeholder")?.setAttribute("aria-label", t("settingsTitle"));
  document.getElementById("settings-title").textContent = t("settingsTitle");
  document.getElementById("settings-tabs")?.setAttribute("aria-label", t("settingsTabsAria"));
  document.getElementById("settings-tab-general").textContent = t("settingsSectionGeneral");
  document.getElementById("settings-tab-quick-links").textContent = t("settingsSectionQuickLinks");
  document.getElementById("settings-language-label").textContent = t("settingsLanguageLabel");
  document.getElementById("settings-weather-label").textContent = t("settingsWeatherLabel");
  document.getElementById("settings-reduced-motion-label").textContent = t("settingsReducedMotionLabel");
  document.getElementById("settings-quick-links-open-mode-label").textContent = t("settingsQuickLinksOpenModeLabel");
  const quickLinksToggle = document.getElementById("quick-links-open-mode-toggle");
  const weatherToggle = document.getElementById("weather-toggle");
  const reducedMotionToggle = document.getElementById("reduced-motion-toggle");
  if (quickLinksToggle) {
    quickLinksToggle.setAttribute("aria-label", t("settingsQuickLinksOpenModeAria"));
    const currentButton = quickLinksToggle.querySelector('[data-quick-link-open-mode="current"]');
    const newTabButton = quickLinksToggle.querySelector('[data-quick-link-open-mode="new-tab"]');
    if (currentButton) {
      currentButton.textContent = t("settingsQuickLinksOpenModeCurrent");
    }
    if (newTabButton) {
      newTabButton.textContent = t("settingsQuickLinksOpenModeNewTab");
    }
  }
  if (weatherToggle) {
    const onButton = weatherToggle.querySelector('[data-weather-enabled="true"]');
    const offButton = weatherToggle.querySelector('[data-weather-enabled="false"]');
    if (onButton) {
      onButton.textContent = t("settingsOptionOn");
    }
    if (offButton) {
      offButton.textContent = t("settingsOptionOff");
    }
  }
  if (reducedMotionToggle) {
    const onButton = reducedMotionToggle.querySelector('[data-reduced-motion="true"]');
    const offButton = reducedMotionToggle.querySelector('[data-reduced-motion="false"]');
    if (onButton) {
      onButton.textContent = t("settingsOptionOn");
    }
    if (offButton) {
      offButton.textContent = t("settingsOptionOff");
    }
  }
  document.getElementById("weather-widget")?.setAttribute("aria-label", t("weatherAria"));
  document.getElementById("weather-refresh")?.setAttribute("aria-label", t("weatherRefreshAria"));
  document.querySelector(".history-screen")?.setAttribute("aria-label", t("historyScreenAria"));
  document.getElementById("history-title").textContent = t("historyTitle");
  document.getElementById("history-filter-tabs")?.setAttribute("aria-label", t("historyFiltersAria"));
  document.querySelector('.history-filter-tab[data-filter="all"]').textContent = t("historyTabAll");
  document.querySelector('.history-filter-tab[data-filter="today"]').textContent = t("historyTabToday");
  document.querySelector('.history-filter-tab[data-filter="yesterday"]').textContent = t("historyTabYesterday");
  document.querySelector('.history-filter-tab[data-filter="search"]').textContent = t("historyTabSearch");
  document.getElementById("history-search-input").placeholder = t("historySearchPlaceholder");
  document.getElementById("history-time-filters")?.setAttribute("aria-label", t("historyTimeFiltersAria"));
  document.querySelector('.history-time-filter[data-range="all"]').textContent = t("historyRangeAll");
  document.querySelector('.history-time-filter[data-range="today"]').textContent = t("historyRangeToday");
  document.querySelector('.history-time-filter[data-range="yesterday"]').textContent = t("historyRangeYesterday");
  document.querySelector('.history-time-filter[data-range="7d"]').textContent = t("historyRange7d");
  document.querySelector('.history-time-filter[data-range="30d"]').textContent = t("historyRange30d");
  document.querySelector('.history-time-filter[data-range="90d"]').textContent = t("historyRange90d");
  document.getElementById("history-loading").textContent = t("historyLoadingMore");
  document.querySelector(".hero-screen")?.setAttribute("aria-label", t("heroAria"));
  document.querySelector(".clock-section")?.setAttribute("aria-label", t("clockAria"));
  document.getElementById("search-shell")?.setAttribute("aria-label", t("searchAria"));
  document.getElementById("search-label").textContent = t("searchLabel");
  document.getElementById("search-trigger").textContent = t("searchTrigger");
  document.getElementById("search").placeholder = t("searchPlaceholder");
  document.getElementById("suggestion-list")?.setAttribute("aria-label", t("searchSuggestionsAria"));
  document.getElementById("frequent-links-section")?.setAttribute("aria-label", t("frequentLinksAria"));
  document.querySelector(".links-screen")?.setAttribute("aria-label", t("linksScreenAria"));
  document.getElementById("links-title").textContent = t("linksTitle");
}

function initializeSettingsTabs() {
  const tabContainer = document.getElementById("settings-tabs");
  const tabElements = [...document.querySelectorAll("[data-settings-tab]")];
  const panelElements = [...document.querySelectorAll("[data-settings-panel]")];

  if (!tabContainer || !tabElements.length || !panelElements.length) {
    return;
  }

  const syncActiveTab = (nextTab) => {
    tabElements.forEach((tabElement) => {
      const isActive = tabElement.dataset.settingsTab === nextTab;
      tabElement.classList.toggle("is-active", isActive);
      tabElement.setAttribute("aria-selected", String(isActive));
      tabElement.tabIndex = isActive ? 0 : -1;
    });

    panelElements.forEach((panelElement) => {
      const isActive = panelElement.dataset.settingsPanel === nextTab;
      panelElement.classList.toggle("is-active", isActive);
      panelElement.hidden = !isActive;
    });
  };

  tabContainer.addEventListener("click", (event) => {
    const tabElement = event.target instanceof Element
      ? event.target.closest("[data-settings-tab]")
      : null;

    if (!tabElement?.dataset.settingsTab) {
      return;
    }

    syncActiveTab(tabElement.dataset.settingsTab);
  });

  syncActiveTab("general");
}

function initializeLanguageToggle() {
  const toggleElement = document.getElementById("language-toggle");

  if (!toggleElement) {
    return;
  }

  const syncToggle = () => {
    const activeLanguage = document.documentElement.lang === "en" ? "en" : "zh-CN";
    toggleElement.querySelectorAll(".settings-language-option").forEach((buttonElement) => {
      const isActive = buttonElement.dataset.language === activeLanguage;
      buttonElement.classList.toggle("is-active", isActive);
      buttonElement.setAttribute("aria-selected", String(isActive));
    });
  };

  toggleElement.addEventListener("click", async (event) => {
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".settings-language-option")
      : null;

    if (!buttonElement?.dataset.language) {
      return;
    }

    await setLanguage(buttonElement.dataset.language);
  });

  syncToggle();
  subscribeLanguageChange(() => {
    applyStaticTranslations();
    syncToggle();
  });
}

function initializeWeatherToggle({ getController, setController }) {
  const toggleElement = document.getElementById("weather-toggle");
  const widgetElement = document.getElementById("weather-widget");

  if (!toggleElement || !widgetElement) {
    return;
  }

  const buildWeatherController = () => initializeWeatherWidget({
    widgetElement,
    iconElement: document.getElementById("weather-icon"),
    locationElement: document.getElementById("weather-location"),
    temperatureElement: document.getElementById("weather-temperature"),
    descElement: document.getElementById("weather-desc"),
    rangeElement: document.getElementById("weather-range"),
    feelsElement: document.getElementById("weather-feels"),
    humidityElement: document.getElementById("weather-humidity"),
    windElement: document.getElementById("weather-wind"),
    updatedElement: document.getElementById("weather-updated"),
    refreshButtonElement: document.getElementById("weather-refresh"),
  });

  const syncToggle = async () => {
    const isEnabled = await getWeatherEnabled();
    toggleElement.querySelectorAll(".settings-language-option").forEach((buttonElement) => {
      const buttonEnabled = buttonElement.dataset.weatherEnabled === "true";
      const isActive = buttonEnabled === isEnabled;
      buttonElement.classList.toggle("is-active", isActive);
      buttonElement.setAttribute("aria-selected", String(isActive));
    });
  };

  const applyWeatherState = async (enabled) => {
    const currentController = getController();

    if (enabled) {
      if (!currentController) {
        setController(buildWeatherController());
      }
      widgetElement.hidden = false;
    } else {
      currentController?.destroy();
      setController(null);
      widgetElement.hidden = true;
    }

    await syncToggle();
  };

  toggleElement.addEventListener("click", async (event) => {
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".settings-language-option")
      : null;

    if (!buttonElement?.dataset.weatherEnabled) {
      return;
    }

    const enabled = buttonElement.dataset.weatherEnabled === "true";
    await setWeatherEnabled(enabled);
    await applyWeatherState(enabled);
  });

  subscribeLanguageChange(() => {
    syncToggle();
  });

  return {
    syncToggle,
    applyWeatherState,
    buildWeatherController,
  };
}

function initializeReducedMotionToggle() {
  const toggleElement = document.getElementById("reduced-motion-toggle");

  if (!toggleElement) {
    return null;
  }

  const syncToggle = async () => {
    const isEnabled = await getReducedMotionEnabled();
    toggleElement.querySelectorAll(".settings-language-option").forEach((buttonElement) => {
      const buttonEnabled = buttonElement.dataset.reducedMotion === "true";
      const isActive = buttonEnabled === isEnabled;
      buttonElement.classList.toggle("is-active", isActive);
      buttonElement.setAttribute("aria-selected", String(isActive));
    });
  };

  toggleElement.addEventListener("click", async (event) => {
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".settings-language-option")
      : null;

    if (!buttonElement?.dataset.reducedMotion) {
      return;
    }

    const enabled = buttonElement.dataset.reducedMotion === "true";
    await setReducedMotionEnabled(enabled);
    applyReducedMotionState(enabled);
    await syncToggle();
  });

  subscribeLanguageChange(() => {
    syncToggle();
  });

  return {
    syncToggle,
  };
}

function initializeQuickLinksOpenModeToggle() {
  const toggleElement = document.getElementById("quick-links-open-mode-toggle");

  if (!toggleElement) {
    return null;
  }

  const syncToggle = async () => {
    const openMode = await getQuickLinkOpenMode();
    toggleElement.querySelectorAll(".settings-language-option").forEach((buttonElement) => {
      const isActive = buttonElement.dataset.quickLinkOpenMode === openMode;
      buttonElement.classList.toggle("is-active", isActive);
      buttonElement.setAttribute("aria-selected", String(isActive));
    });
  };

  toggleElement.addEventListener("click", async (event) => {
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".settings-language-option")
      : null;

    if (!buttonElement?.dataset.quickLinkOpenMode) {
      return;
    }

    await setQuickLinkOpenMode(buttonElement.dataset.quickLinkOpenMode);
    await syncToggle();
  });

  subscribeLanguageChange(() => {
    applyStaticTranslations();
    void syncToggle();
  });

  return {
    syncToggle,
  };
}

async function bootstrap() {
  await initializeI18n();
  applyReducedMotionState(await getReducedMotionEnabled());
  applyStaticTranslations();
  initializeSettingsTabs();
  initializeLanguageToggle();
  const reducedMotionToggle = initializeReducedMotionToggle();
  const quickLinksOpenModeToggle = initializeQuickLinksOpenModeToggle();
  let weatherController = null;
  const weatherToggle = initializeWeatherToggle({
    getController: () => weatherController,
    setController: (controller) => {
      weatherController = controller;
    },
  });
  const weatherEnabled = await getWeatherEnabled();
  if (weatherEnabled) {
    weatherController = weatherToggle?.buildWeatherController() || null;
  } else {
    document.getElementById("weather-widget").hidden = true;
  }
  await weatherToggle?.syncToggle();
  await reducedMotionToggle?.syncToggle();
  await quickLinksOpenModeToggle?.syncToggle();
  initializeHistory({
    tabContainerElement: document.getElementById("history-filter-tabs"),
    searchToolsElement: document.getElementById("history-search-tools"),
    searchInputElement: document.getElementById("history-search-input"),
    timeFilterContainerElement: document.getElementById("history-time-filters"),
    listShellElement: document.getElementById("history-list-shell"),
    listElement: document.getElementById("history-list"),
    loadingElement: document.getElementById("history-loading"),
    loadSentinelElement: document.getElementById("history-load-sentinel"),
  });
  initializeClock(document.getElementById("clock"));
  initializeSearch(
    document.querySelector(".search-section"),
    document.getElementById("search-trigger"),
    document.getElementById("search"),
    document.getElementById("suggestions"),
    document.getElementById("suggestion-list"),
    document.querySelector(".clock-section")
  );
  initializeDailyBackground({
    baseLayer: document.getElementById("background-base"),
    activeLayer: document.getElementById("background-active"),
  });
  initializeSavedLinks({
    groupListElement: document.getElementById("group-list"),
  });
  initializeFrequentLinks({
    sectionElement: document.getElementById("frequent-links-section"),
    listElement: document.getElementById("frequent-links-list"),
  });
  initializeScrollScreens({
    scrollRootElement: document.getElementById("scroll-root"),
    historyScreenElement: document.querySelector(".history-screen"),
    heroScreenElement: document.querySelector(".hero-screen"),
    linksScreenElement: document.querySelector(".links-screen"),
  });
}

bootstrap();

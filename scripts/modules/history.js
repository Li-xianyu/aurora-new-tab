import { subscribeLanguageChange, t } from "./i18n.js";

const HISTORY_BATCH_SIZE = 50;
const SCROLL_LOAD_THRESHOLD_PX = 120;
const HISTORY_REVEAL_STAGGER_MS = 20;
const HISTORY_ROW_ESTIMATE_PX = 76;
const HISTORY_VIRTUAL_OVERSCAN = 8;

function debugHistoryLazyLoad(stage, payload = {}) {
  void stage;
  void payload;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) {
    return t("historyRecently");
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));

  if (diffMinutes < 60) {
    return t(diffMinutes === 1 ? "historyMinuteAgo" : "historyMinutesAgo", { count: diffMinutes });
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return t(diffHours === 1 ? "historyHourAgo" : "historyHoursAgo", { count: diffHours });
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return t(diffDays === 1 ? "historyDayAgo" : "historyDaysAgo", { count: diffDays });
  }

  const diffWeeks = Math.floor(diffDays / 7);
  return t(diffWeeks === 1 ? "historyWeekAgo" : "historyWeeksAgo", { count: diffWeeks });
}

function formatDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toUpperCase();
  } catch {
    return String(url || "").toUpperCase();
  }
}

function buildExtensionFaviconUrl(url, size = 32) {
  const faviconBaseUrl = chrome.runtime.getURL("/_favicon/");
  return `${faviconBaseUrl}?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

function requestRecentHistory(payload) {
  return chrome.runtime.sendMessage({
    type: "GET_RECENT_HISTORY",
    payload,
  }).then((response) => {
    if (!response?.ok) {
      throw new Error(response?.error || "Failed to load browser history.");
    }

    return Array.isArray(response.items) ? response.items : [];
  });
}

function createDayBoundaries() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);

  return {
    now: Date.now(),
    todayStart,
    yesterdayStart,
  };
}

function getTimeRangePreset(rangeId) {
  const { now, todayStart, yesterdayStart } = createDayBoundaries();

  switch (rangeId) {
    case "today":
      return { startTime: todayStart, endTime: now };
    case "yesterday":
      return { startTime: yesterdayStart, endTime: todayStart - 1 };
    case "7d":
      return { startTime: now - (7 * 24 * 60 * 60 * 1000), endTime: now };
    case "30d":
      return { startTime: now - (30 * 24 * 60 * 60 * 1000), endTime: now };
    case "90d":
      return { startTime: now - (90 * 24 * 60 * 60 * 1000), endTime: now };
    default:
      return { startTime: undefined, endTime: now };
  }
}

function buildRequestPayload(activeTab, searchQuery, timeRange, nextEndTime) {
  if (activeTab === "all") {
    return {
      text: "",
      endTime: Number.isFinite(nextEndTime) ? nextEndTime : Date.now(),
      maxResults: HISTORY_BATCH_SIZE,
    };
  }

  const range = activeTab === "search"
    ? getTimeRangePreset(timeRange)
    : getTimeRangePreset(activeTab);

  return {
    text: activeTab === "search" ? searchQuery : "",
    startTime: range.startTime,
    endTime: Number.isFinite(nextEndTime) ? nextEndTime : range.endTime,
    maxResults: HISTORY_BATCH_SIZE,
  };
}

function createHistoryItem(historyItem) {
  const anchor = document.createElement("a");
  anchor.className = "history-item";
  anchor.href = historyItem.url;
  anchor.title = historyItem.title || historyItem.url;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";

  const meta = document.createElement("div");
  meta.className = "history-item-meta";

  const leftMeta = document.createElement("div");
  leftMeta.className = "history-item-meta-left";

  const icon = document.createElement("img");
  icon.className = "history-item-icon";
  icon.alt = "";
  icon.width = 16;
  icon.height = 16;
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.src = buildExtensionFaviconUrl(historyItem.url, 32);
  icon.addEventListener("error", () => {
    icon.hidden = true;
  });

  const domain = document.createElement("span");
  domain.className = "history-item-domain";
  domain.textContent = formatDomain(historyItem.url);

  leftMeta.append(icon, domain);

  const time = document.createElement("span");
  time.className = "history-item-time";
  time.textContent = formatRelativeTime(historyItem.lastVisitTime);

  meta.append(leftMeta, time);

  const title = document.createElement("div");
  title.className = "history-item-title";
  title.textContent = historyItem.title || historyItem.url;

  const detail = document.createElement("div");
  detail.className = "history-item-detail";
  detail.textContent = historyItem.url;

  anchor.append(meta, title, detail);
  anchor.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({
      url: historyItem.url,
    });
  });

  return anchor;
}

function createRevealController(listShellElement) {
  if (!("IntersectionObserver" in window)) {
    return {
      observe() {},
      reset() {},
      disconnect() {},
    };
  }

  const observedElements = new Set();
  const observer = new IntersectionObserver((entries) => {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        entry.target.classList.remove("is-visible");
        entry.target.style.setProperty("--history-reveal-delay", "0ms");
      }
    });

    visibleEntries.forEach((entry, index) => {
      const localDelay = index * HISTORY_REVEAL_STAGGER_MS;
      entry.target.style.setProperty("--history-reveal-delay", `${localDelay}ms`);
      entry.target.classList.add("is-visible");
    });
  }, {
    root: listShellElement,
    rootMargin: "0px 0px -4% 0px",
    threshold: 0.02,
  });

  return {
    observe(element) {
      if (!element) {
        return;
      }

      observedElements.add(element);
      observer.observe(element);
    },
    reset() {
      observedElements.forEach((element) => {
        element.classList.remove("is-visible");
        element.style.setProperty("--history-reveal-delay", "0ms");
        observer.unobserve(element);
      });
      observedElements.clear();
    },
    disconnect() {
      observer.disconnect();
      observedElements.clear();
    },
  };
}

function createVirtualHistoryRenderer(listElement, listShellElement, revealController) {
  const topSpacerElement = document.createElement("div");
  topSpacerElement.className = "history-virtual-spacer";

  const windowElement = document.createElement("div");
  windowElement.className = "history-virtual-window";

  const bottomSpacerElement = document.createElement("div");
  bottomSpacerElement.className = "history-virtual-spacer";

  listElement.replaceChildren(topSpacerElement, windowElement, bottomSpacerElement);

  let items = [];
  let renderedStart = -1;
  let renderedEnd = -1;
  let emptyMode = false;
  let rafId = 0;

  const renderWindow = () => {
    rafId = 0;

    if (emptyMode) {
      return;
    }

    const viewportHeight = Math.max(listShellElement.clientHeight, HISTORY_ROW_ESTIMATE_PX);
    const estimatedVisibleCount = Math.ceil(viewportHeight / HISTORY_ROW_ESTIMATE_PX);
    const startIndex = Math.max(
      0,
      Math.floor(listShellElement.scrollTop / HISTORY_ROW_ESTIMATE_PX) - HISTORY_VIRTUAL_OVERSCAN
    );
    const endIndex = Math.min(
      items.length,
      startIndex + estimatedVisibleCount + (HISTORY_VIRTUAL_OVERSCAN * 2)
    );

    if (renderedStart === startIndex && renderedEnd === endIndex) {
      return;
    }

    renderedStart = startIndex;
    renderedEnd = endIndex;

    const fragment = document.createDocumentFragment();
    const visibleItems = items.slice(startIndex, endIndex);

    visibleItems.forEach((item) => {
      const historyItemElement = createHistoryItem(item);
      historyItemElement.style.setProperty("--history-reveal-delay", "0ms");
      fragment.appendChild(historyItemElement);
      revealController?.observe(historyItemElement);
    });

    windowElement.replaceChildren(fragment);
    topSpacerElement.style.height = `${startIndex * HISTORY_ROW_ESTIMATE_PX}px`;
    bottomSpacerElement.style.height = `${Math.max(0, (items.length - endIndex) * HISTORY_ROW_ESTIMATE_PX)}px`;
  };

  const scheduleRender = () => {
    if (rafId) {
      return;
    }

    rafId = window.requestAnimationFrame(renderWindow);
  };

  return {
    setItems(nextItems, { resetScroll = false } = {}) {
      items = nextItems;
      emptyMode = false;
      renderedStart = -1;
      renderedEnd = -1;
      revealController?.reset();
      if (resetScroll) {
        listShellElement.scrollTop = 0;
      }
      scheduleRender();
    },
    renderEmpty(text) {
      emptyMode = true;
      renderedStart = -1;
      renderedEnd = -1;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      revealController?.reset();
      listElement.replaceChildren();
      renderEmptyState(listElement, text);
    },
    refresh() {
      scheduleRender();
    },
    resetStructure() {
      emptyMode = false;
      listElement.replaceChildren(topSpacerElement, windowElement, bottomSpacerElement);
      renderedStart = -1;
      renderedEnd = -1;
      scheduleRender();
    },
  };
}

function renderEmptyState(listElement, text) {
  listElement.replaceChildren();

  const emptyState = document.createElement("p");
  emptyState.className = "history-empty";
  emptyState.textContent = text;
  listElement.appendChild(emptyState);
}

function syncFilterTabs(tabContainerElement, activeTab) {
  tabContainerElement.querySelectorAll(".history-filter-tab").forEach((tabElement) => {
    const isActive = tabElement.dataset.filter === activeTab;
    tabElement.classList.toggle("is-active", isActive);
    tabElement.setAttribute("aria-selected", String(isActive));
  });
}

function syncTimeFilters(timeFilterContainerElement, timeRange) {
  timeFilterContainerElement.querySelectorAll(".history-time-filter").forEach((buttonElement) => {
    const isActive = buttonElement.dataset.range === timeRange;
    buttonElement.classList.toggle("is-active", isActive);
    buttonElement.setAttribute("aria-selected", String(isActive));
  });
}

export function initializeHistory({
  tabContainerElement,
  searchToolsElement,
  searchInputElement,
  timeFilterContainerElement,
  listShellElement,
  listElement,
  loadingElement,
  loadSentinelElement,
}) {
  if (
    !tabContainerElement ||
    !searchToolsElement ||
    !searchInputElement ||
    !timeFilterContainerElement ||
    !listShellElement ||
    !listElement ||
    !loadingElement ||
    !loadSentinelElement
  ) {
    return;
  }

  let items = [];
  let activeTab = "all";
  let timeRange = "all";
  let searchQuery = "";
  let isLoading = false;
  let hasMore = true;
  let lastTimeCursor = Number.NaN;
  let requestVersion = 0;
  let searchDebounceId = 0;
  let sentinelObserver = null;
  const revealController = createRevealController(listShellElement);
  const virtualRenderer = createVirtualHistoryRenderer(listElement, listShellElement, revealController);

  const syncUi = () => {
    const shouldShowSearchTools = activeTab === "search";
    syncFilterTabs(tabContainerElement, activeTab);
    syncTimeFilters(timeFilterContainerElement, timeRange);
    searchToolsElement.hidden = !shouldShowSearchTools;
    searchToolsElement.classList.toggle("is-visible", shouldShowSearchTools);
    loadingElement.hidden = !isLoading;
  };

  const updatePaginationState = (batch) => {
    if (!batch.length) {
      hasMore = false;
      debugHistoryLazyLoad("pagination-empty-batch", {
        hasMore,
        lastTimeCursor,
      });
      return;
    }

    const previousCursor = lastTimeCursor;
    const oldestItem = batch[batch.length - 1];
    const nextCursor = (oldestItem.lastVisitTime || 0) - 1;

    // Chrome history search is not guaranteed to always fill maxResults,
    // so a short batch does not reliably mean there is no more data.
    lastTimeCursor = nextCursor;
    hasMore = nextCursor > 0 && (!Number.isFinite(previousCursor) || nextCursor < previousCursor);

    debugHistoryLazyLoad("pagination-updated", {
      batchSize: batch.length,
      lastTimeCursor,
      hasMore,
      oldestTime: oldestItem.lastVisitTime || null,
    });
  };

  const maybeLoadMore = () => {
    if (activeTab !== "all" || isLoading || !hasMore) {
      debugHistoryLazyLoad("maybe-load-skipped", {
        activeTab,
        isLoading,
        hasMore,
      });
      return;
    }

    const distanceToBottom =
      listShellElement.scrollHeight - listShellElement.scrollTop - listShellElement.clientHeight;

    debugHistoryLazyLoad("check-bottom", {
      distanceToBottom,
      threshold: SCROLL_LOAD_THRESHOLD_PX,
      scrollTop: listShellElement.scrollTop,
      scrollHeight: listShellElement.scrollHeight,
      clientHeight: listShellElement.clientHeight,
      lastTimeCursor,
    });

    if (distanceToBottom <= SCROLL_LOAD_THRESHOLD_PX) {
      debugHistoryLazyLoad("trigger-from-check-bottom", {
        lastTimeCursor,
      });
      loadBatch({ append: true });
    }
  };

  const loadBatch = async ({ append }) => {
    if (isLoading) {
      debugHistoryLazyLoad("load-skipped-already-loading", {
        append,
        lastTimeCursor,
      });
      return;
    }

    if (append && (!hasMore || activeTab !== "all")) {
      debugHistoryLazyLoad("load-skipped-append-blocked", {
        append,
        activeTab,
        hasMore,
        lastTimeCursor,
      });
      return;
    }

    const version = requestVersion;
    isLoading = true;
    syncUi();

    try {
      const payload = buildRequestPayload(
        activeTab,
        searchQuery,
        timeRange,
        append ? lastTimeCursor : Date.now()
      );
      debugHistoryLazyLoad("request-start", {
        append,
        payload,
        requestVersion: version,
      });
      const batch = await requestRecentHistory(payload);
      debugHistoryLazyLoad("request-finish", {
        append,
        requestVersion: version,
        batchSize: batch.length,
        firstTime: batch[0]?.lastVisitTime || null,
        lastTime: batch[batch.length - 1]?.lastVisitTime || null,
      });

      if (version !== requestVersion) {
        debugHistoryLazyLoad("response-discarded-stale", {
          responseVersion: version,
          currentVersion: requestVersion,
        });
        return;
      }

      updatePaginationState(batch);

      if (append) {
        items = [...items, ...batch];
      } else {
        items = batch;
      }

      if (!items.length) {
        const emptyText = activeTab === "search"
          ? t("historyEmptySearch")
          : t("historyEmptyDefault");
        virtualRenderer.renderEmpty(emptyText);
        return;
      }

      virtualRenderer.resetStructure();
      virtualRenderer.setItems(items, { resetScroll: !append });

      window.requestAnimationFrame(() => {
        maybeLoadMore();
      });
    } catch (error) {
      console.error(error);

      if (!append) {
        virtualRenderer.renderEmpty(t("historyUnavailable"));
      }
    } finally {
      if (version === requestVersion) {
        isLoading = false;
        syncUi();
      }
    }
  };

  const reload = () => {
    requestVersion += 1;
    items = [];
    hasMore = true;
    lastTimeCursor = Date.now();
    debugHistoryLazyLoad("reload", {
      requestVersion,
      lastTimeCursor,
      activeTab,
      timeRange,
      searchQuery,
    });
    loadBatch({ append: false });
  };

  const ensureSentinelObserver = () => {
    if (sentinelObserver || !("IntersectionObserver" in window)) {
      return;
    }

    sentinelObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        debugHistoryLazyLoad("sentinel", {
          isIntersecting: entry.isIntersecting,
          intersectionRatio: entry.intersectionRatio,
          activeTab,
          hasMore,
          isLoading,
          lastTimeCursor,
        });

        if (entry.isIntersecting) {
          maybeLoadMore();
        }
      });
    }, {
      root: listShellElement,
      rootMargin: "0px 0px 180px 0px",
      threshold: 0.01,
    });

    sentinelObserver.observe(loadSentinelElement);
  };

  tabContainerElement.addEventListener("click", (event) => {
    const tabElement = event.target instanceof Element
      ? event.target.closest(".history-filter-tab")
      : null;

    if (!tabElement?.dataset.filter || tabElement.dataset.filter === activeTab) {
      return;
    }

    activeTab = tabElement.dataset.filter;
    reload();
  });

  timeFilterContainerElement.addEventListener("click", (event) => {
    const filterElement = event.target instanceof Element
      ? event.target.closest(".history-time-filter")
      : null;

    if (!filterElement?.dataset.range || filterElement.dataset.range === timeRange) {
      return;
    }

    timeRange = filterElement.dataset.range;
    reload();
  });

  searchInputElement.addEventListener("input", () => {
    searchQuery = searchInputElement.value.trim();

    if (searchDebounceId) {
      window.clearTimeout(searchDebounceId);
    }

    searchDebounceId = window.setTimeout(() => {
      if (activeTab === "search") {
        reload();
      }
    }, 180);
  });

  listShellElement.addEventListener("scroll", () => {
    virtualRenderer.refresh();
    maybeLoadMore();
  }, { passive: true });

  listShellElement.addEventListener("wheel", (event) => {
    const distanceToBottom =
      listShellElement.scrollHeight - listShellElement.scrollTop - listShellElement.clientHeight;

    debugHistoryLazyLoad("wheel", {
      deltaY: event.deltaY,
      activeTab,
      distanceToBottom,
      threshold: SCROLL_LOAD_THRESHOLD_PX,
      scrollTop: listShellElement.scrollTop,
      scrollHeight: listShellElement.scrollHeight,
      clientHeight: listShellElement.clientHeight,
      hasMore,
      isLoading,
      lastTimeCursor,
    });

    if (activeTab !== "all") {
      return;
    }

    if (event.deltaY > 0 && distanceToBottom <= SCROLL_LOAD_THRESHOLD_PX) {
      debugHistoryLazyLoad("trigger-from-wheel", {
        lastTimeCursor,
      });
      loadBatch({ append: true });
    }
  }, { passive: true });

  listShellElement.addEventListener("touchstart", (event) => {
    event.stopPropagation();
  }, { passive: true });

  listShellElement.addEventListener("touchmove", (event) => {
    event.stopPropagation();
  }, { passive: true });

  ensureSentinelObserver();
  syncUi();
  reload();

  subscribeLanguageChange(() => {
    syncUi();

    if (!items.length) {
      virtualRenderer.renderEmpty(activeTab === "search" ? t("historyEmptySearch") : t("historyEmptyDefault"));
      return;
    }

    virtualRenderer.resetStructure();
    virtualRenderer.setItems(items, { resetScroll: false });
  });
}

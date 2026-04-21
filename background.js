const BING_ARCHIVE_API =
  "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN";
const BING_BASE_URL = "https://www.bing.com";
const DAILY_IMAGE_CACHE_KEY = "bingDailyImageCache";
const SAVED_LINKS_KEY = "savedPageLinks";
const SAVE_DIALOG_STATE_KEY = "saveDialogState";
const DEFAULT_GROUP_NAME = "Ungrouped";
const HISTORY_LOOKBACK_DAYS = 365;
const HISTORY_RESULT_LIMIT = 120;

function normalizeImageUrl(urlPath) {
  if (!urlPath) {
    return "";
  }

  if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
    return urlPath;
  }

  return new URL(urlPath, BING_BASE_URL).toString();
}

function getTodayStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", "");
}

function getLocalTodayStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function fetchDailyImagePayload() {
  const response = await fetch(BING_ARCHIVE_API, {
    method: "GET",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Bing image request failed with status ${response.status}.`);
  }

  return response.json();
}

async function fetchBaiduSuggestionText(keyword) {
  const url = new URL("https://suggestion.baidu.com/su");
  url.searchParams.set("wd", keyword);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Baidu suggestion request failed with status ${response.status}.`);
  }

  const buffer = await response.arrayBuffer();
  return new TextDecoder("gb18030").decode(buffer);
}

function parseBaiduSuggestionText(rawText) {
  const trimmed = rawText.trim();
  const match =
    trimmed.match(/^[\w$.]+\(([\s\S]+)\);?$/) ||
    trimmed.match(/^([\s\S]+)$/);

  if (!match?.[1]) {
    throw new Error("Baidu suggestion response format is invalid.");
  }

  const payloadText = match[1];
  const normalizedPayloadText = payloadText.replace(
    /([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g,
    '$1"$2"$3'
  );
  let payload;

  try {
    payload = JSON.parse(normalizedPayloadText);
  } catch {
    throw new Error("Failed to parse Baidu suggestion payload.");
  }

  return Array.isArray(payload?.s) ? payload.s : [];
}

async function getStoredDailyImageCache() {
  const result = await chrome.storage.local.get(DAILY_IMAGE_CACHE_KEY);
  return result[DAILY_IMAGE_CACHE_KEY] || null;
}

async function setStoredDailyImageCache(cache) {
  await chrome.storage.local.set({ [DAILY_IMAGE_CACHE_KEY]: cache });
}

function createDailyImageCache(image) {
  if (!image?.url) {
    return null;
  }

  return {
    startDate: image.startdate ?? "",
    endDate: image.enddate ?? "",
    localDateStamp: getLocalTodayStamp(),
    title: image.title ?? "",
    copyright: image.copyright ?? "",
    copyrightLink: image.copyrightlink ?? "",
    imageUrl: normalizeImageUrl(image.url),
    imageDataUrl: image.imageDataUrl ?? "",
    cachedAt: new Date().toISOString(),
  };
}

function isCurrentDailyImageCache(cache) {
  if (!cache) {
    return false;
  }

  if (cache.localDateStamp) {
    return cache.localDateStamp === getLocalTodayStamp();
  }

  if (!cache.startDate) {
    return false;
  }

  return cache.startDate === getTodayStamp();
}

async function refreshDailyImageCache() {
  const data = await fetchDailyImagePayload();
  const image = data?.images?.[0];

  if (!image) {
    throw new Error("Bing daily image payload is missing images[0].");
  }

  const imageUrl = normalizeImageUrl(image.url);
  const imageResponse = await fetch(imageUrl, {
    method: "GET",
    cache: "force-cache",
  });

  if (!imageResponse.ok) {
    throw new Error(`Bing image download failed with status ${imageResponse.status}.`);
  }

  const imageBuffer = await imageResponse.arrayBuffer();
  const imageContentType = imageResponse.headers.get("content-type") || "image/jpeg";
  const imageDataUrl = `data:${imageContentType};base64,${arrayBufferToBase64(imageBuffer)}`;

  image.imageDataUrl = imageDataUrl;

  const cache = createDailyImageCache(image);

  if (cache) {
    await setStoredDailyImageCache(cache);
  }

  return {
    data,
    cache,
  };
}

async function getDailyImagePayloadWithCache() {
  const cachedImage = await getStoredDailyImageCache();

  if (isCurrentDailyImageCache(cachedImage) && (cachedImage.imageDataUrl || cachedImage.imageUrl)) {
    return {
      data: {
        images: [{
          startdate: cachedImage.startDate,
          enddate: cachedImage.endDate,
          localDateStamp: cachedImage.localDateStamp,
          title: cachedImage.title,
          copyright: cachedImage.copyright,
          copyrightlink: cachedImage.copyrightLink,
          url: cachedImage.imageUrl,
          imageDataUrl: cachedImage.imageDataUrl,
        }],
      },
      fromCache: true,
    };
  }

  const result = await refreshDailyImageCache();
  return {
    data: result.data,
    fromCache: false,
  };
}

function normalizeGroupName(groupName) {
  const trimmedGroupName = String(groupName || "").trim();
  return trimmedGroupName || DEFAULT_GROUP_NAME;
}

function isSavableUrl(url) {
  return /^https?:\/\//i.test(url || "");
}

function isExpectedUnsavableUrl(url) {
  const normalizedUrl = String(url || "").trim().toLowerCase();

  if (!normalizedUrl) {
    return true;
  }

  return (
    normalizedUrl.startsWith("chrome://") ||
    normalizedUrl.startsWith("chrome-extension://") ||
    normalizedUrl.startsWith("edge://") ||
    normalizedUrl.startsWith("about:") ||
    normalizedUrl.startsWith("view-source:") ||
    normalizedUrl.startsWith("devtools://")
  );
}

function createBookmarkRecord({ url, title, group }) {
  const normalizedUrl = String(url || "").trim();

  return {
    id: crypto.randomUUID(),
    url: normalizedUrl,
    title: String(title || normalizedUrl || "Untitled Page").trim() || normalizedUrl,
    group: normalizeGroupName(group),
    createdAt: new Date().toISOString(),
  };
}

function getUniqueGroups(links) {
  return [...new Set(
    links
      .map((item) => normalizeGroupName(item.group))
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right, "en"));
}

async function getSavedLinks() {
  const result = await chrome.storage.local.get(SAVED_LINKS_KEY);
  return Array.isArray(result[SAVED_LINKS_KEY]) ? result[SAVED_LINKS_KEY] : [];
}

function getDefaultHistoryStartTime() {
  return Date.now() - (HISTORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

function normalizeHistorySearchParams(params) {
  const startTime = Number.isFinite(params?.startTime)
    ? params.startTime
    : getDefaultHistoryStartTime();
  const endTime = Number.isFinite(params?.endTime) ? params.endTime : Date.now();
  const maxResults = Number.isFinite(params?.maxResults)
    ? Math.min(Math.max(params.maxResults, 1), 250)
    : HISTORY_RESULT_LIMIT;
  const text = String(params?.text || "").trim();

  return {
    text,
    startTime,
    endTime,
    maxResults,
  };
}

async function getRecentHistoryEntries(params = {}) {
  const searchParams = normalizeHistorySearchParams(params);
  const items = await chrome.history.search(searchParams);

  return items
    .filter((item) => /^https?:\/\//i.test(item?.url || ""))
    .sort((left, right) => (right.lastVisitTime || 0) - (left.lastVisitTime || 0))
    .map((item) => ({
      id: item.id || item.url || crypto.randomUUID(),
      url: item.url || "",
      title: String(item.title || item.url || "Untitled Page").trim(),
      visitCount: Number.isFinite(item.visitCount) ? item.visitCount : 0,
      typedCount: Number.isFinite(item.typedCount) ? item.typedCount : 0,
      lastVisitTime: Number.isFinite(item.lastVisitTime) ? item.lastVisitTime : 0,
    }));
}

async function setSavedLinks(links) {
  await chrome.storage.local.set({ [SAVED_LINKS_KEY]: links });
}

async function saveBookmarkEntry(entry) {
  if (!isSavableUrl(entry?.url)) {
    throw new Error("Only http and https pages can be saved.");
  }

  const existingLinks = await getSavedLinks();
  const bookmark = createBookmarkRecord(entry);
  const duplicateIndex = existingLinks.findIndex(
    (item) => item.url === bookmark.url && normalizeGroupName(item.group) === bookmark.group
  );

  if (duplicateIndex >= 0) {
    existingLinks[duplicateIndex] = {
      ...existingLinks[duplicateIndex],
      title: bookmark.title,
      group: bookmark.group,
      updatedAt: bookmark.createdAt,
    };
  } else {
    const nextSortIndex = existingLinks.reduce((maxValue, item) => {
      const sortIndex = Number.isFinite(item?.sortIndex) ? item.sortIndex : -1;
      return Math.max(maxValue, sortIndex);
    }, -1) + 1;

    existingLinks.unshift(bookmark);
    existingLinks[0].sortIndex = nextSortIndex;
  }

  await setSavedLinks(existingLinks);
  return duplicateIndex >= 0 ? existingLinks[duplicateIndex] : bookmark;
}

async function deleteSavedGroup(groupName) {
  const normalizedTargetGroup = normalizeGroupName(groupName);

  if (normalizedTargetGroup === DEFAULT_GROUP_NAME) {
    throw new Error("The default group cannot be deleted.");
  }

  const existingLinks = await getSavedLinks();
  const nextLinks = existingLinks.map((link) => {
    if (normalizeGroupName(link.group) !== normalizedTargetGroup) {
      return link;
    }

    return {
      ...link,
      group: DEFAULT_GROUP_NAME,
      updatedAt: new Date().toISOString(),
    };
  });

  await setSavedLinks(nextLinks);

  return {
    links: nextLinks,
    groups: getUniqueGroups(nextLinks),
  };
}

function normalizeSavedLinkForStorage(link, index) {
  return {
    ...link,
    group: normalizeGroupName(link?.group),
    sortIndex: index,
  };
}

async function trackSavedLinkUsage(id) {
  const linkId = String(id || "").trim();

  if (!linkId) {
    throw new Error("Saved link id is required.");
  }

  const existingLinks = await getSavedLinks();
  const nextLinks = existingLinks.map((link) => {
    if (link.id !== linkId) {
      return link;
    }

    return {
      ...link,
      usedCount: (Number.isFinite(link.usedCount) ? link.usedCount : 0) + 1,
      lastUsedAt: new Date().toISOString(),
    };
  });

  await setSavedLinks(nextLinks);
  return nextLinks;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0] || null;
}

async function setSaveDialogState(state) {
  await chrome.storage.local.set({
    [SAVE_DIALOG_STATE_KEY]: {
      ...state,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function getSaveDialogState() {
  const result = await chrome.storage.local.get(SAVE_DIALOG_STATE_KEY);
  return result[SAVE_DIALOG_STATE_KEY] || null;
}

async function getCenteredPopupBounds(width, height) {
  try {
    const currentWindow = await chrome.windows.getLastFocused();
    const baseLeft = Number.isFinite(currentWindow.left) ? currentWindow.left : 0;
    const baseTop = Number.isFinite(currentWindow.top) ? currentWindow.top : 0;
    const baseWidth = Number.isFinite(currentWindow.width) ? currentWindow.width : width;
    const baseHeight = Number.isFinite(currentWindow.height) ? currentWindow.height : height;

    return {
      width,
      height,
      left: Math.max(0, Math.round(baseLeft + ((baseWidth - width) / 2))),
      top: Math.max(0, Math.round(baseTop + ((baseHeight - height) / 2))),
    };
  } catch {
    return {
      width,
      height,
    };
  }
}

async function openSaveDialogForActiveTab() {
  const activeTab = await getActiveTab();

  if (!activeTab?.url || !isSavableUrl(activeTab.url)) {
    return {
      ok: false,
      reason: isExpectedUnsavableUrl(activeTab?.url) ? "unsupported-page" : "unsavable-url",
    };
  }

  const existingLinks = await getSavedLinks();

  await setSaveDialogState({
    title: activeTab.title || activeTab.url,
    url: activeTab.url,
    selectedGroup: DEFAULT_GROUP_NAME,
    groups: getUniqueGroups(existingLinks),
  });

  return {
    ok: true,
  };
}

chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-current-page") {
    return;
  }

  (async () => {
    const result = await openSaveDialogForActiveTab();

    if (!result?.ok) {
      return;
    }

    await chrome.action.openPopup();
  })().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);

    if (
      /popup/i.test(message) ||
      /user gesture/i.test(message) ||
      /current page cannot be saved/i.test(message)
    ) {
      return;
    }

    console.error("Failed to open save dialog from shortcut.", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_BING_DAILY_IMAGE") {
    (async () => {
      const result = await getDailyImagePayloadWithCache();
      sendResponse({ ok: true, data: result.data, fromCache: result.fromCache });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "GET_BAIDU_SUGGESTIONS") {
    (async () => {
      const keyword = String(message.keyword || "").trim();

      if (!keyword) {
        sendResponse({ ok: true, suggestions: [] });
        return;
      }

      const text = await fetchBaiduSuggestionText(keyword);
      const suggestions = parseBaiduSuggestionText(text);

      sendResponse({ ok: true, suggestions });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "GET_SAVED_LINKS") {
    (async () => {
      const links = await getSavedLinks();
      sendResponse({ ok: true, links });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "GET_RECENT_HISTORY") {
    (async () => {
      const items = await getRecentHistoryEntries(message.payload);
      sendResponse({ ok: true, items });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "GET_SAVE_DIALOG_STATE") {
    (async () => {
      const state = await getSaveDialogState();
      sendResponse({ ok: true, state });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "SAVE_LINK_ENTRY") {
    (async () => {
      const savedEntry = await saveBookmarkEntry(message.payload);
      const links = await getSavedLinks();
      await setSaveDialogState({
        title: savedEntry.title,
        url: savedEntry.url,
        selectedGroup: savedEntry.group,
        groups: getUniqueGroups(links),
      });
      sendResponse({ ok: true, entry: savedEntry });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "DELETE_SAVED_LINK") {
    (async () => {
      const id = String(message.id || "").trim();
      const existingLinks = await getSavedLinks();
      const nextLinks = existingLinks.filter((item) => item.id !== id);
      await setSavedLinks(nextLinks);
      sendResponse({ ok: true, links: nextLinks });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "TRACK_SAVED_LINK_USAGE") {
    (async () => {
      const links = await trackSavedLinkUsage(message.id);
      sendResponse({ ok: true, links });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "SET_SAVED_LINKS_ORDER") {
    (async () => {
      const links = Array.isArray(message.links) ? message.links : [];
      const normalizedLinks = links.map((link, index) => normalizeSavedLinkForStorage(link, index));
      await setSavedLinks(normalizedLinks);
      sendResponse({ ok: true, links: normalizedLinks });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  if (message?.type === "DELETE_SAVED_GROUP") {
    (async () => {
      const result = await deleteSavedGroup(message.group);
      const currentState = await getSaveDialogState();
      const nextSelectedGroup = normalizeGroupName(currentState?.selectedGroup);

      await setSaveDialogState({
        ...(currentState || {}),
        selectedGroup: result.groups.includes(nextSelectedGroup) ? nextSelectedGroup : DEFAULT_GROUP_NAME,
        groups: result.groups,
      });

      sendResponse({ ok: true, ...result });
    })().catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return true;
  }

  return false;
});

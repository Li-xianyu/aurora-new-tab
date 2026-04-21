import { subscribeLanguageChange, t } from "./i18n.js";

const DEFAULT_GROUP_NAME = "Ungrouped";
const LONG_PRESS_DELAY_MS = 220;
const LONG_PRESS_MOVE_THRESHOLD = 8;
const MIN_FREQUENT_LINK_USAGE_COUNT = 2;
const RECENT_USAGE_WINDOW_DAYS = 14;
const RECENT_USAGE_BONUS = 0.75;
const QUICK_LINK_OPEN_MODE_STORAGE_KEY = "quickLinkOpenMode";
const QUICK_LINK_OPEN_MODE_CURRENT = "current";
const QUICK_LINK_OPEN_MODE_NEW_TAB = "new-tab";

function buildExtensionFaviconUrl(url, size = 32) {
  const faviconBaseUrl = chrome.runtime.getURL("/_favicon/");
  return `${faviconBaseUrl}?pageUrl=${encodeURIComponent(url)}&size=${size}`;
}

function getLinkActivityScore(link) {
  const usedCount = Number.isFinite(link?.usedCount) ? link.usedCount : 0;
  const lastUsedAt = Date.parse(link?.lastUsedAt || 0);
  const updatedAt = Date.parse(link?.updatedAt || link?.createdAt || 0);
  const recentWindowMs = RECENT_USAGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const isRecentlyUsed = lastUsedAt > 0 && (Date.now() - lastUsedAt) <= recentWindowMs;
  const rankScore = usedCount + (isRecentlyUsed ? RECENT_USAGE_BONUS : 0);
  return {
    usedCount,
    lastUsedAt,
    updatedAt,
    rankScore,
  };
}

function sortLinksByOrder(links) {
  return [...links].sort((left, right) => {
    const leftOrder = Number.isFinite(left.sortIndex) ? left.sortIndex : Number.MAX_SAFE_INTEGER;
    const rightOrder = Number.isFinite(right.sortIndex) ? right.sortIndex : Number.MAX_SAFE_INTEGER;

    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftDate = Date.parse(left.updatedAt || left.createdAt || 0);
    const rightDate = Date.parse(right.updatedAt || right.createdAt || 0);
    return rightDate - leftDate;
  });
}

function groupLinks(links) {
  const groups = new Map();

  sortLinksByOrder(links).forEach((link) => {
    const groupName = String(link.group || DEFAULT_GROUP_NAME).trim() || DEFAULT_GROUP_NAME;

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }

    groups.get(groupName).push(link);
  });

  return [...groups.entries()].sort(([leftName], [rightName]) => leftName.localeCompare(rightName, "en"));
}

export async function requestSavedLinks() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SAVED_LINKS" });

  if (!response?.ok) {
    throw new Error(response?.error || "Failed to load saved links.");
  }

  return Array.isArray(response.links) ? response.links : [];
}

export async function getQuickLinkOpenMode() {
  const result = await chrome.storage.local.get(QUICK_LINK_OPEN_MODE_STORAGE_KEY);
  return result[QUICK_LINK_OPEN_MODE_STORAGE_KEY] === QUICK_LINK_OPEN_MODE_NEW_TAB
    ? QUICK_LINK_OPEN_MODE_NEW_TAB
    : QUICK_LINK_OPEN_MODE_CURRENT;
}

export async function setQuickLinkOpenMode(mode) {
  const normalizedMode = mode === QUICK_LINK_OPEN_MODE_NEW_TAB
    ? QUICK_LINK_OPEN_MODE_NEW_TAB
    : QUICK_LINK_OPEN_MODE_CURRENT;

  await chrome.storage.local.set({
    [QUICK_LINK_OPEN_MODE_STORAGE_KEY]: normalizedMode,
  });
}

export async function trackSavedLinkUsage(id) {
  const response = await chrome.runtime.sendMessage({
    type: "TRACK_SAVED_LINK_USAGE",
    id,
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Failed to track saved link usage.");
  }

  return Array.isArray(response.links) ? response.links : [];
}

async function deleteSavedLink(id) {
  const response = await chrome.runtime.sendMessage({
    type: "DELETE_SAVED_LINK",
    id,
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Failed to delete saved link.");
  }

  return Array.isArray(response.links) ? response.links : [];
}

async function persistSavedLinksOrder(links) {
  const response = await chrome.runtime.sendMessage({
    type: "SET_SAVED_LINKS_ORDER",
    links,
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Failed to save link order.");
  }

  return Array.isArray(response.links) ? response.links : [];
}

export function createBookmarkChip(link) {
  const anchor = document.createElement("a");
  anchor.className = "bookmark-chip";
  anchor.href = link.url;
  anchor.title = link.title || link.url;
  anchor.target = "_self";
  anchor.rel = "noreferrer";
  anchor.draggable = false;
  anchor.dataset.linkId = link.id;
  anchor.dataset.groupName = link.group || DEFAULT_GROUP_NAME;
  anchor.addEventListener("dragstart", (event) => {
    event.preventDefault();
  });

  const icon = document.createElement("img");
  icon.className = "bookmark-chip-icon";
  icon.alt = "";
  icon.width = 14;
  icon.height = 14;
  icon.loading = "lazy";
  icon.decoding = "async";
  icon.src = buildExtensionFaviconUrl(link.url, 32);
  icon.addEventListener("error", () => {
    icon.hidden = true;
  });

  const text = document.createElement("span");
  text.className = "bookmark-chip-text";
  text.textContent = link.title || link.url;

  anchor.append(icon, text);

  return anchor;
}

export function openBookmarkChipInNewTab(chipElement) {
  const nextUrl = String(chipElement?.getAttribute("href") || "").trim();

  if (!nextUrl) {
    return;
  }

  chrome.tabs.create({
    url: nextUrl,
  });
}

export function openBookmarkChipInCurrentTab(chipElement) {
  const nextUrl = String(chipElement?.getAttribute("href") || "").trim();

  if (!nextUrl) {
    return;
  }

  window.location.href = nextUrl;
}

export async function openBookmarkChip(chipElement) {
  const openMode = await getQuickLinkOpenMode();

  if (openMode === QUICK_LINK_OPEN_MODE_NEW_TAB) {
    openBookmarkChipInNewTab(chipElement);
    return;
  }

  openBookmarkChipInCurrentTab(chipElement);
}

export function hydrateBookmarkChipFavicons(rootElement) {
  void rootElement;
  return null;
}

export function selectFrequentLinks(links, limit = 5) {
  return [...links]
    .filter((link) => {
      const score = getLinkActivityScore(link);
      return score.usedCount >= MIN_FREQUENT_LINK_USAGE_COUNT;
    })
    .sort((left, right) => {
      const leftScore = getLinkActivityScore(left);
      const rightScore = getLinkActivityScore(right);

      if (leftScore.rankScore !== rightScore.rankScore) {
        return rightScore.rankScore - leftScore.rankScore;
      }

      if (leftScore.usedCount !== rightScore.usedCount) {
        return rightScore.usedCount - leftScore.usedCount;
      }

      if (leftScore.lastUsedAt !== rightScore.lastUsedAt) {
        return rightScore.lastUsedAt - leftScore.lastUsedAt;
      }

      if (leftScore.updatedAt !== rightScore.updatedAt) {
        return rightScore.updatedAt - leftScore.updatedAt;
      }

      const leftOrder = Number.isFinite(left?.sortIndex) ? left.sortIndex : Number.MAX_SAFE_INTEGER;
      const rightOrder = Number.isFinite(right?.sortIndex) ? right.sortIndex : Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    })
    .slice(0, limit);
}

function renderGroups(groupListElement, links) {
  groupListElement.replaceChildren();

  if (!links.length) {
    return;
  }

  groupLinks(links).forEach(([groupName, groupLinksList]) => {
    const section = document.createElement("section");
    section.className = "group-section";

    const header = document.createElement("header");
    header.className = "group-header";

    const title = document.createElement("h3");
    title.className = "group-name";
    title.textContent = groupName === DEFAULT_GROUP_NAME ? t("bookmarkDefaultGroup") : groupName;

    const count = document.createElement("p");
    count.className = "group-count";
    count.textContent = String(groupLinksList.length);

    const chipList = document.createElement("div");
    chipList.className = "bookmark-chip-list";
    chipList.dataset.groupName = groupName;

    groupLinksList.forEach((link) => {
      chipList.appendChild(createBookmarkChip(link));
    });

    header.append(title, count);
    section.append(header, chipList);
    groupListElement.appendChild(section);
  });
}

export function initializeSavedLinks({ groupListElement }) {
  if (!groupListElement) {
    return;
  }

  let currentLinks = [];
  let menuState = {
    activeLinkId: "",
    isArmed: false,
  };
  let suppressNextClick = false;
  let pendingPress = null;
  let dragState = null;
  let faviconObserver = null;

  const menuElement = document.createElement("div");
  menuElement.className = "bookmark-context-menu";
  menuElement.hidden = true;

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "bookmark-context-action";
  deleteButton.innerHTML = `
    <span class="bookmark-context-label">${t("bookmarkDelete")}</span>
    <span class="bookmark-context-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" focusable="false">
        <path d="M13.485 1.929a.75.75 0 0 1 0 1.06L6.56 9.914 3.47 6.823a.75.75 0 1 0-1.06 1.061l3.62 3.62a.75.75 0 0 0 1.06 0l7.456-7.455a.75.75 0 0 0-1.06-1.06Z"></path>
      </svg>
    </span>
  `;

  menuElement.appendChild(deleteButton);
  document.body.appendChild(menuElement);

  const hideContextMenu = () => {
    menuState = {
      activeLinkId: "",
      isArmed: false,
    };
    menuElement.hidden = true;
    deleteButton.classList.remove("is-armed");
  };

  const clearPendingPress = () => {
    if (pendingPress?.timerId) {
      window.clearTimeout(pendingPress.timerId);
    }

    pendingPress = null;
  };

  const finishDrag = () => {
    if (!dragState) {
      return;
    }

    dragState.previewElement.remove();
    dragState.sourceElement.classList.remove("is-drag-source");

    if (dragState.placeholderElement.parentElement) {
      dragState.placeholderElement.replaceWith(dragState.sourceElement);
    }

    dragState = null;
    document.body.classList.remove("is-chip-dragging");
  };

  const buildLinksFromDom = () => {
    const linkMap = new Map(currentLinks.map((link) => [link.id, link]));
    const orderedLinks = [];
    let sortIndex = 0;

    groupListElement.querySelectorAll(".bookmark-chip-list").forEach((chipList) => {
      const groupName = chipList.dataset.groupName || DEFAULT_GROUP_NAME;

      chipList.querySelectorAll(".bookmark-chip").forEach((chipElement) => {
        const link = linkMap.get(chipElement.dataset.linkId || "");

        if (!link) {
          return;
        }

        orderedLinks.push({
          ...link,
          group: groupName,
          sortIndex,
        });
        sortIndex += 1;
      });
    });

    return orderedLinks;
  };

  const syncPlaceholderPosition = (clientX, clientY) => {
    if (!dragState) {
      return;
    }

    const hitList = document.elementsFromPoint(clientX, clientY)
      .find((element) => element.classList?.contains("bookmark-chip-list"));

    const targetList = hitList || dragState.placeholderElement.parentElement;

    if (!targetList) {
      return;
    }

    const siblingChips = [...targetList.querySelectorAll(".bookmark-chip")]
      .filter((chip) => chip !== dragState.sourceElement);

    const nextSibling = siblingChips.find((chip) => {
      const rect = chip.getBoundingClientRect();
      const isWithinRow = clientY >= rect.top - 8 && clientY <= rect.bottom + 8;
      return isWithinRow && clientX < rect.left + rect.width / 2;
    });

    if (nextSibling) {
      targetList.insertBefore(dragState.placeholderElement, nextSibling);
      return;
    }

    targetList.appendChild(dragState.placeholderElement);
  };

  const startDrag = (chipElement, pointerEvent) => {
    hideContextMenu();

    const rect = chipElement.getBoundingClientRect();
    const previewElement = chipElement.cloneNode(true);
    previewElement.classList.add("is-drag-preview");
    previewElement.style.width = `${rect.width}px`;
    previewElement.style.height = `${rect.height}px`;
    previewElement.style.left = `${rect.left}px`;
    previewElement.style.top = `${rect.top}px`;

    const placeholderElement = document.createElement("div");
    placeholderElement.className = "bookmark-chip-placeholder";
    placeholderElement.style.width = `${rect.width}px`;
    placeholderElement.style.height = `${rect.height}px`;

    chipElement.parentElement?.insertBefore(placeholderElement, chipElement);
    chipElement.remove();
    chipElement.classList.add("is-drag-source");

    document.body.appendChild(previewElement);
    document.body.classList.add("is-chip-dragging");

    dragState = {
      pointerId: pointerEvent.pointerId,
      sourceElement: chipElement,
      previewElement,
      placeholderElement,
      offsetX: pointerEvent.clientX - rect.left,
      offsetY: pointerEvent.clientY - rect.top,
    };

    suppressNextClick = true;
    syncPlaceholderPosition(pointerEvent.clientX, pointerEvent.clientY);
  };

  const updateDragPreview = (clientX, clientY) => {
    if (!dragState) {
      return;
    }

    dragState.previewElement.style.left = `${clientX - dragState.offsetX}px`;
    dragState.previewElement.style.top = `${clientY - dragState.offsetY}px`;
    syncPlaceholderPosition(clientX, clientY);
  };

  const showContextMenu = (event, linkId) => {
    menuState = {
      activeLinkId: linkId,
      isArmed: false,
    };

    deleteButton.classList.remove("is-armed");
    menuElement.hidden = false;

    const menuWidth = 156;
    const menuHeight = 52;
    const maxLeft = Math.max(12, window.innerWidth - menuWidth - 12);
    const maxTop = Math.max(12, window.innerHeight - menuHeight - 12);
    const left = Math.min(event.clientX, maxLeft);
    const top = Math.min(event.clientY, maxTop);

    menuElement.style.left = `${left}px`;
    menuElement.style.top = `${top}px`;
  };

  const render = () => {
    renderGroups(groupListElement, currentLinks);
    deleteButton.querySelector(".bookmark-context-label").textContent = t("bookmarkDelete");

    if (faviconObserver) {
      faviconObserver.disconnect();
    }

    faviconObserver = hydrateBookmarkChipFavicons(groupListElement);
  };

  const load = async () => {
    try {
      currentLinks = await requestSavedLinks();
      render();
    } catch (error) {
      console.error(error);
    }
  };

  groupListElement.addEventListener("contextmenu", (event) => {
    if (dragState) {
      event.preventDefault();
      return;
    }

    const chipElement = event.target instanceof Element
      ? event.target.closest(".bookmark-chip")
      : null;

    if (!chipElement) {
      hideContextMenu();
      return;
    }

    event.preventDefault();
    showContextMenu(event, chipElement.dataset.linkId || "");
  });

  groupListElement.addEventListener("click", (event) => {
    const chipElement = event.target instanceof Element
      ? event.target.closest(".bookmark-chip")
      : null;

    if (suppressNextClick && chipElement) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClick = false;
      return;
    }

    if (!chipElement?.dataset.linkId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    trackSavedLinkUsage(chipElement.dataset.linkId)
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        void openBookmarkChip(chipElement);
      });
  }, true);

  groupListElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || dragState) {
      return;
    }

    const chipElement = event.target instanceof Element
      ? event.target.closest(".bookmark-chip")
      : null;

    if (!chipElement) {
      return;
    }

    clearPendingPress();

    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;

    pendingPress = {
      pointerId,
      startX,
      startY,
      chipElement,
      timerId: window.setTimeout(() => {
        startDrag(chipElement, event);
        clearPendingPress();
      }, LONG_PRESS_DELAY_MS),
    };
  });

  document.addEventListener("pointermove", (event) => {
    if (dragState) {
      event.preventDefault();
      updateDragPreview(event.clientX, event.clientY);
      return;
    }

    if (!pendingPress || pendingPress.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - pendingPress.startX;
    const deltaY = event.clientY - pendingPress.startY;

    if (Math.hypot(deltaX, deltaY) > LONG_PRESS_MOVE_THRESHOLD) {
      clearPendingPress();
    }
  });

  const finalizeDrag = async () => {
    if (!dragState) {
      clearPendingPress();
      return;
    }

    finishDrag();

    try {
      currentLinks = await persistSavedLinksOrder(buildLinksFromDom());
      render();
    } catch (error) {
      console.error(error);
      render();
    }
  };

  document.addEventListener("pointerup", () => {
    if (dragState) {
      finalizeDrag();
      return;
    }

    clearPendingPress();
  });

  document.addEventListener("pointercancel", () => {
    if (dragState) {
      finishDrag();
      render();
      return;
    }

    clearPendingPress();
  });

  deleteButton.addEventListener("click", async () => {
    if (!menuState.activeLinkId) {
      hideContextMenu();
      return;
    }

    if (!menuState.isArmed) {
      menuState.isArmed = true;
      deleteButton.classList.add("is-armed");
      return;
    }

    try {
      currentLinks = await deleteSavedLink(menuState.activeLinkId);
      render();
    } catch (error) {
      console.error(error);
    }

    hideContextMenu();
  });

  document.addEventListener("pointerdown", (event) => {
    if (menuElement.hidden) {
      return;
    }

    if (menuElement.contains(event.target)) {
      return;
    }

    hideContextMenu();
  });

  document.addEventListener("scroll", () => {
    hideContextMenu();
    if (dragState) {
      finishDrag();
      render();
    }
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      clearPendingPress();
      if (dragState) {
        finishDrag();
        render();
      }
      hideContextMenu();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes.savedPageLinks) {
      currentLinks = Array.isArray(changes.savedPageLinks.newValue)
        ? changes.savedPageLinks.newValue
        : [];
      render();
      return;
    }

    if (changes[QUICK_LINK_OPEN_MODE_STORAGE_KEY]) {
      render();
    }
  });

  subscribeLanguageChange(() => {
    render();
  });

  load();
}

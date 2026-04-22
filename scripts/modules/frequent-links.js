import {
  createBookmarkChip,
  hydrateBookmarkChipFavicons,
  openBookmarkChip,
  requestSavedLinks,
  selectFrequentLinks,
  trackSavedLinkUsage,
} from "./saved-links.js";

const FREQUENT_LINKS_VISIBLE_STORAGE_KEY = "frequentLinksVisible";

async function getFrequentLinksVisible() {
  const result = await chrome.storage.local.get(FREQUENT_LINKS_VISIBLE_STORAGE_KEY);
  return result[FREQUENT_LINKS_VISIBLE_STORAGE_KEY] !== false;
}

function renderFrequentLinks(containerElement, sectionElement, links) {
  containerElement.replaceChildren();

  const frequentLinks = selectFrequentLinks(links, 5);
  sectionElement.hidden = frequentLinks.length === 0;

  frequentLinks.forEach((link) => {
    containerElement.appendChild(createBookmarkChip(link));
  });
}

export function initializeFrequentLinks({ sectionElement, listElement }) {
  if (!sectionElement || !listElement) {
    return;
  }

  let currentLinks = [];
  let faviconObserver = null;

  const render = async () => {
    const isVisible = await getFrequentLinksVisible();

    if (!isVisible) {
      sectionElement.hidden = true;
      listElement.replaceChildren();
      if (faviconObserver) {
        faviconObserver.disconnect();
      }
      faviconObserver = null;
      return;
    }

    renderFrequentLinks(listElement, sectionElement, currentLinks);

    if (faviconObserver) {
      faviconObserver.disconnect();
    }

    faviconObserver = hydrateBookmarkChipFavicons(listElement);
  };

  const load = async () => {
    try {
      currentLinks = await requestSavedLinks();
      await render();
    } catch (error) {
      console.error(error);
    }
  };

  listElement.addEventListener("click", (event) => {
    const chipElement = event.target instanceof Element
      ? event.target.closest(".bookmark-chip")
      : null;

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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (changes.savedPageLinks) {
      currentLinks = Array.isArray(changes.savedPageLinks.newValue)
        ? changes.savedPageLinks.newValue
        : [];
      void render();
      return;
    }

    if (changes.quickLinkOpenMode || changes[FREQUENT_LINKS_VISIBLE_STORAGE_KEY]) {
      void render();
    }
  });

  window.addEventListener("focus", () => {
    load();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      load();
    }
  });

  load();
}

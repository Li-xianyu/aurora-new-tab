import {
  createBookmarkChip,
  hydrateBookmarkChipFavicons,
  openBookmarkChip,
  requestSavedLinks,
  selectFrequentLinks,
  trackSavedLinkUsage,
} from "./saved-links.js";

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

  const render = () => {
    renderFrequentLinks(listElement, sectionElement, currentLinks);

    if (faviconObserver) {
      faviconObserver.disconnect();
    }

    faviconObserver = hydrateBookmarkChipFavicons(listElement);
  };

  const load = async () => {
    try {
      currentLinks = await requestSavedLinks();
      render();
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
      render();
      return;
    }

    if (changes.quickLinkOpenMode) {
      render();
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

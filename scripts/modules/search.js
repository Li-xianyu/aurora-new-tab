import { getBaiduSuggestions } from "../services/baidu-suggestion-service.js";

const SEARCH_ENGINE_URL = "https://www.google.com/search?q=";
const EMPTY_ACTIVE_INDEX = -1;
const COLLAPSE_ANIMATION_MS = 300;

function navigateToSearch(keyword) {
  if (!keyword) {
    return;
  }

  window.open(`${SEARCH_ENGINE_URL}${encodeURIComponent(keyword)}`, "_blank", "noopener,noreferrer");
}

function renderSuggestions(listElement, suggestions, activeIndex, handleSelect) {
  listElement.replaceChildren();

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "suggestion-item";
    button.textContent = suggestion;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === activeIndex));

    if (index === activeIndex) {
      button.classList.add("is-active");
    }

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      handleSelect(suggestion);
    });

    item.appendChild(button);
    listElement.appendChild(item);
  });
}

export function initializeSearch(
  searchShellElement,
  triggerElement,
  inputElement,
  suggestionsPanel,
  suggestionListElement,
  clockSectionElement
) {
  if (!searchShellElement || !triggerElement || !inputElement || !suggestionsPanel || !suggestionListElement) {
    return;
  }

  let suggestions = [];
  let activeIndex = EMPTY_ACTIVE_INDEX;
  let requestSequence = 0;
  let suggestionsVisible = false;
  let isExpanded = false;
  let collapseTimerId = 0;

  const setExpandedState = (shouldExpand) => {
    if (isExpanded === shouldExpand) {
      return;
    }

    if (collapseTimerId) {
      window.clearTimeout(collapseTimerId);
      collapseTimerId = 0;
    }

    isExpanded = shouldExpand;
    searchShellElement.classList.toggle("is-expanded", shouldExpand);
    searchShellElement.classList.toggle("is-collapsing", false);
    triggerElement.setAttribute("aria-expanded", String(shouldExpand));

    if (!shouldExpand) {
      inputElement.blur();
    }
  };

  const expandSearch = () => {
    setExpandedState(true);
    window.requestAnimationFrame(() => {
      inputElement.focus();
      inputElement.select();
    });
  };

  const collapseSearch = () => {
    hideSuggestions();

    if (inputElement.value.trim()) {
      return;
    }

    if (!isExpanded) {
      return;
    }

    isExpanded = false;
    searchShellElement.classList.remove("is-expanded");
    searchShellElement.classList.add("is-collapsing");
    triggerElement.setAttribute("aria-expanded", "false");
    inputElement.blur();

    collapseTimerId = window.setTimeout(() => {
      searchShellElement.classList.remove("is-collapsing");
      collapseTimerId = 0;
    }, COLLAPSE_ANIMATION_MS);
  };

  const syncClockVisibility = (shouldShowSuggestions) => {
    if (!clockSectionElement || suggestionsVisible === shouldShowSuggestions) {
      suggestionsVisible = shouldShowSuggestions;
      return;
    }

    suggestionsVisible = shouldShowSuggestions;
    clockSectionElement.classList.toggle("is-suppressed", shouldShowSuggestions);
    clockSectionElement.setAttribute("aria-hidden", String(shouldShowSuggestions));
  };

  const hideSuggestions = () => {
    suggestions = [];
    activeIndex = EMPTY_ACTIVE_INDEX;
    suggestionsPanel.hidden = true;
    suggestionListElement.replaceChildren();
    syncClockVisibility(false);
  };

  const showSuggestions = () => {
    const hasSuggestions = suggestions.length > 0;
    suggestionsPanel.hidden = !hasSuggestions;
    syncClockVisibility(hasSuggestions);

    if (!hasSuggestions) {
      return;
    }

    renderSuggestions(
      suggestionListElement,
      suggestions,
      activeIndex,
      (selectedSuggestion) => {
        inputElement.value = selectedSuggestion;
        hideSuggestions();
        navigateToSearch(selectedSuggestion);
      }
    );
  };

  const updateSuggestions = async (keyword) => {
    const currentRequestId = ++requestSequence;
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      hideSuggestions();
      return;
    }

    try {
      const nextSuggestions = await getBaiduSuggestions(trimmedKeyword);

      if (currentRequestId !== requestSequence) {
        return;
      }

      suggestions = nextSuggestions.filter(Boolean);
      activeIndex = EMPTY_ACTIVE_INDEX;
      showSuggestions();
    } catch (error) {
      if (currentRequestId !== requestSequence) {
        return;
      }

      console.error("Failed to load search suggestions.", error);
      hideSuggestions();
    }
  };

  inputElement.addEventListener("input", () => {
    updateSuggestions(inputElement.value);
  });

  inputElement.addEventListener("focus", () => {
    setExpandedState(true);

    if (inputElement.value.trim()) {
      updateSuggestions(inputElement.value);
    }
  });

  inputElement.addEventListener("blur", () => {
    window.setTimeout(() => {
      collapseSearch();
    }, 120);
  });

  inputElement.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % suggestions.length;
      showSuggestions();
      return;
    }

    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
      showSuggestions();
      return;
    }

    if (event.key === "Escape") {
      inputElement.value = "";
      collapseSearch();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    if (activeIndex >= 0 && suggestions[activeIndex]) {
      inputElement.value = suggestions[activeIndex];
      navigateToSearch(suggestions[activeIndex]);
      return;
    }

    const keyword = inputElement.value.trim();

    if (!keyword) {
      return;
    }

    navigateToSearch(keyword);
  });

  triggerElement.addEventListener("click", () => {
    expandSearch();
  });

  document.addEventListener("pointerdown", (event) => {
    if (searchSectionContainsTarget(searchShellElement, suggestionsPanel, event.target)) {
      return;
    }

    collapseSearch();
  });
}

function searchSectionContainsTarget(searchShellElement, suggestionsPanel, target) {
  return searchShellElement.contains(target) || suggestionsPanel.contains(target);
}

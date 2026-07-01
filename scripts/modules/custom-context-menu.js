import { subscribeLanguageChange, t } from "./i18n.js";

const SEARCH_CONTEXT_INPUT_SELECTOR = "#search, #history-search-input";
const LINK_CONTEXT_SELECTOR = ".history-item, #frequent-links-list .bookmark-chip";
const CONTEXT_MENU_OPEN_CLASS = "is-opening";
const SETTINGS_TRANSITION_DURATION_MS = 420;
const CONTEXT_MENU_ICONS = {
  refresh: '<svg viewBox="0 0 16 16" focusable="false"><path d="M13.25 2.75v3.5h-3.5a.75.75 0 0 1 0-1.5h1.58A4.25 4.25 0 1 0 12.06 9a.75.75 0 0 1 1.44.43 5.75 5.75 0 1 1-1.04-5.73V2.75a.75.75 0 0 1 1.5 0Z"></path></svg>',
  cut: '<svg viewBox="0 0 16 16" focusable="false"><path d="M4.25 3.5a2.25 2.25 0 1 1 1.34 2.06l1.64 1.64.93-.93a.75.75 0 0 1 1.06 1.06L8.28 8.27l1.96 1.96a2.25 2.25 0 1 1-1.06 1.06L3.9 6.01A2.25 2.25 0 0 1 4.25 3.5Zm2.5 0a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm4.5 7.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm1.28-6.22L10.1 6.96a.75.75 0 0 1-1.06-1.06l2.43-2.43a.75.75 0 0 1 1.06 1.06Z"></path></svg>',
  copy: '<svg viewBox="0 0 16 16" focusable="false"><path d="M5.75 2A1.75 1.75 0 0 0 4 3.75V4h-.25A1.75 1.75 0 0 0 2 5.75v6.5C2 13.22 2.78 14 3.75 14h6.5A1.75 1.75 0 0 0 12 12.25V12h.25A1.75 1.75 0 0 0 14 10.25v-6.5A1.75 1.75 0 0 0 12.25 2h-6.5ZM12 10.5V5.75A1.75 1.75 0 0 0 10.25 4H5.5v-.25c0-.14.11-.25.25-.25h6.5c.14 0 .25.11.25.25v6.5c0 .14-.11.25-.25.25H12Zm-8.5-4.75c0-.14.11-.25.25-.25h6.5c.14 0 .25.11.25.25v6.5c0 .14-.11.25-.25.25h-6.5a.25.25 0 0 1-.25-.25v-6.5Z"></path></svg>',
  "copy-link": '<svg viewBox="0 0 16 16" focusable="false"><path d="M6.25 4.25a.75.75 0 0 1 0 1.5H5.5a2.5 2.5 0 0 0 0 5h.75a.75.75 0 0 1 0 1.5H5.5a4 4 0 0 1 0-8h.75Zm3.5 0h.75a4 4 0 0 1 0 8h-.75a.75.75 0 0 1 0-1.5h.75a2.5 2.5 0 0 0 0-5h-.75a.75.75 0 0 1 0-1.5ZM5.75 8c0-.41.34-.75.75-.75h3a.75.75 0 0 1 0 1.5h-3A.75.75 0 0 1 5.75 8Z"></path></svg>',
  paste: '<svg viewBox="0 0 16 16" focusable="false"><path d="M6.25 1.5h3.5c.62 0 1.16.34 1.45.84h.55c.97 0 1.75.78 1.75 1.75v8.16c0 .97-.78 1.75-1.75 1.75h-7.5A1.75 1.75 0 0 1 2.5 12.25V4.09c0-.97.78-1.75 1.75-1.75h.55c.29-.5.83-.84 1.45-.84Zm0 1.5a.25.25 0 0 0 0 .5h3.5a.25.25 0 0 0 0-.5h-3.5ZM4.25 3.84a.25.25 0 0 0-.25.25v8.16c0 .14.11.25.25.25h7.5c.14 0 .25-.11.25-.25V4.09a.25.25 0 0 0-.25-.25h-.35c-.25.68-.9 1.16-1.65 1.16h-3.5c-.75 0-1.4-.48-1.65-1.16h-.35Z"></path></svg>',
  "select-all": '<svg viewBox="0 0 16 16" focusable="false"><path d="M3.75 2h8.5C13.22 2 14 2.78 14 3.75v8.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.78 2.78 2 3.75 2Zm0 1.5a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h8.5c.14 0 .25-.11.25-.25v-8.5a.25.25 0 0 0-.25-.25h-8.5ZM5.75 6h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Zm0 2.5h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5Z"></path></svg>',
  "new-tab": '<svg viewBox="0 0 16 16" focusable="false"><path d="M3.75 3.5a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25h8.5c.14 0 .25-.11.25-.25V9.5a.75.75 0 0 1 1.5 0v2.75A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.78 2.78 2 3.75 2H6.5a.75.75 0 0 1 0 1.5H3.75ZM8.5 2.75c0-.41.34-.75.75-.75h4a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0V4.56L8.78 8.28a.75.75 0 0 1-1.06-1.06l3.72-3.72H9.25a.75.75 0 0 1-.75-.75Z"></path></svg>',
  "new-window": '<svg viewBox="0 0 16 16" focusable="false"><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v6.5C2 12.22 2.78 13 3.75 13h8.5A1.75 1.75 0 0 0 14 11.25v-6.5A1.75 1.75 0 0 0 12.25 3h-8.5Zm0 1.5h8.5c.14 0 .25.11.25.25V6h-9V4.75c0-.14.11-.25.25-.25Zm-.25 3h9v3.75c0 .14-.11.25-.25.25h-8.5a.25.25 0 0 1-.25-.25V7.5Z"></path></svg>',
  incognito: '<svg viewBox="0 0 16 16" focusable="false"><path d="M3.25 6.5 4.2 3.67A1 1 0 0 1 5.15 3h5.7a1 1 0 0 1 .95.67l.95 2.83H14a.75.75 0 0 1 0 1.5h-.47A2.75 2.75 0 0 1 8 8a2.75 2.75 0 0 1-5.53 0H2a.75.75 0 0 1 0-1.5h1.25Zm1.62 0h6.26L10.4 4.5H5.6l-.73 2ZM5.25 8a1.25 1.25 0 1 0 0 .01V8Zm5.5 0a1.25 1.25 0 1 0 0 .01V8Z"></path></svg>',
  save: '<svg viewBox="0 0 16 16" focusable="false"><path d="M3.75 2h7.19c.46 0 .91.18 1.24.51l1.31 1.31c.33.33.51.78.51 1.24v7.19A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.78 2.78 2 3.75 2Zm0 1.5a.25.25 0 0 0-.25.25v8.5c0 .14.11.25.25.25H4.5V9.75C4.5 8.78 5.28 8 6.25 8h3.5c.97 0 1.75.78 1.75 1.75v2.75h.75c.14 0 .25-.11.25-.25V5.06a.25.25 0 0 0-.07-.18l-1.31-1.31a.25.25 0 0 0-.18-.07H10.5v1.75C10.5 6.22 9.72 7 8.75 7h-3.5A1.75 1.75 0 0 1 3.5 5.25v-1.5c0-.14.11-.25.25-.25ZM6 9.5v3h4v-2.75a.25.25 0 0 0-.25-.25H6Zm-1-6v1.75c0 .14.11.25.25.25h3.5c.14 0 .25-.11.25-.25V3.5H5Z"></path></svg>',
  settings: '<svg viewBox="0 0 16 16" focusable="false"><path d="M7.06 1.5h1.88l.34 1.36c.33.12.65.25.94.43l1.2-.72 1.33 1.33-.72 1.2c.18.29.32.61.43.94l1.36.34v1.88l-1.36.34c-.11.33-.25.65-.43.94l.72 1.2-1.33 1.33-1.2-.72c-.29.18-.61.32-.94.43l-.34 1.36H7.06l-.34-1.36a4.64 4.64 0 0 1-.94-.43l-1.2.72-1.33-1.33.72-1.2a4.64 4.64 0 0 1-.43-.94l-1.36-.34V6.38l1.36-.34c.11-.33.25-.65.43-.94l-.72-1.2 1.33-1.33 1.2.72c.29-.18.61-.31.94-.43L7.06 1.5ZM8 5.25a2.75 2.75 0 1 0 0 5.5 2.75 2.75 0 0 0 0-5.5Zm0 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"></path></svg>',
};

function getContextInput(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const inputElement = target.closest(SEARCH_CONTEXT_INPUT_SELECTOR);
  return inputElement instanceof HTMLInputElement ? inputElement : null;
}

function getContextLink(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  const linkElement = target.closest(LINK_CONTEXT_SELECTOR);
  return linkElement instanceof HTMLAnchorElement ? linkElement : null;
}

function shouldUseCustomContextMenu(target) {
  if (!(target instanceof Element)) {
    return true;
  }

  if (getContextInput(target)) {
    return true;
  }

  if (getContextLink(target)) {
    return true;
  }

  if (target.closest(".bookmark-chip, input, textarea, select, [contenteditable=\"true\"]")) {
    return false;
  }

  return true;
}

function hasSelection(inputElement) {
  return (inputElement.selectionEnd || 0) > (inputElement.selectionStart || 0);
}

function replaceSelection(inputElement, value) {
  const selectionStart = inputElement.selectionStart ?? inputElement.value.length;
  const selectionEnd = inputElement.selectionEnd ?? inputElement.value.length;
  const nextValue = `${inputElement.value.slice(0, selectionStart)}${value}${inputElement.value.slice(selectionEnd)}`;
  const nextCaretPosition = selectionStart + value.length;

  inputElement.value = nextValue;
  inputElement.focus();
  inputElement.setSelectionRange(nextCaretPosition, nextCaretPosition);
  inputElement.dispatchEvent(new Event("input", { bubbles: true }));
}

function createMenuButton({ action, label, disabled = false }) {
  const buttonElement = document.createElement("button");
  buttonElement.type = "button";
  buttonElement.className = "page-context-menu-item";
  buttonElement.dataset.action = action;
  buttonElement.innerHTML = `
    <span class="context-menu-leading-icon" aria-hidden="true">${CONTEXT_MENU_ICONS[action] || ""}</span>
    <span class="context-menu-label">${label}</span>
  `;
  buttonElement.disabled = disabled;
  return buttonElement;
}

function playContextMenuOpening(menuElement) {
  const menuItems = [...menuElement.querySelectorAll(".page-context-menu-item")];

  menuElement.style.setProperty("--context-menu-count", String(menuItems.length));
  menuItems.forEach((itemElement, index) => {
    itemElement.style.setProperty("--context-menu-item-index", String(index));
  });

  menuElement.classList.remove(CONTEXT_MENU_OPEN_CLASS);
  void menuElement.offsetWidth;
  menuElement.classList.add(CONTEXT_MENU_OPEN_CLASS);
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function getSettingsProgress() {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--settings-progress"));
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0;
}

function openSettingsPanel() {
  const pageShellElement = document.querySelector(".page-shell");

  if (!pageShellElement) {
    return;
  }

  if (document.body.classList.contains("is-reduced-motion")) {
    document.documentElement.style.setProperty("--settings-progress", "1");
    pageShellElement.classList.add("is-settings-preview");
    return;
  }

  const startProgress = getSettingsProgress();
  const distance = 1 - startProgress;
  const startTime = performance.now();

  pageShellElement.classList.add("is-settings-preview", "is-settings-dragging");

  const tick = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(Math.max(elapsed / SETTINGS_TRANSITION_DURATION_MS, 0), 1);
    const nextProgress = startProgress + (distance * easeOutCubic(progress));

    document.documentElement.style.setProperty("--settings-progress", nextProgress.toFixed(4));

    if (progress < 1) {
      window.requestAnimationFrame(tick);
      return;
    }

    document.documentElement.style.setProperty("--settings-progress", "1");
    pageShellElement.classList.remove("is-settings-dragging");
  };

  window.requestAnimationFrame(tick);
}

function buildMenu() {
  const menuElement = document.createElement("div");
  menuElement.className = "page-context-menu";
  menuElement.hidden = true;
  document.body.appendChild(menuElement);

  return menuElement;
}

export function initializeCustomContextMenu() {
  const menuElement = buildMenu();
  let activeInputElement = null;
  let activeLinkUrl = "";

  const inputMenuItems = [
    {
      action: "cut",
      labelKey: "contextMenuCut",
      isEnabled: (inputElement) => hasSelection(inputElement),
      run: async (inputElement) => {
        const selectedText = inputElement.value.slice(inputElement.selectionStart || 0, inputElement.selectionEnd || 0);
        await navigator.clipboard?.writeText(selectedText);
        replaceSelection(inputElement, "");
      },
    },
    {
      action: "copy",
      labelKey: "contextMenuCopy",
      isEnabled: (inputElement) => hasSelection(inputElement),
      run: async (inputElement) => {
        const selectedText = inputElement.value.slice(inputElement.selectionStart || 0, inputElement.selectionEnd || 0);
        await navigator.clipboard?.writeText(selectedText);
        inputElement.focus();
      },
    },
    {
      action: "paste",
      labelKey: "contextMenuPaste",
      isEnabled: () => Boolean(navigator.clipboard?.readText),
      run: async (inputElement) => {
        const clipboardText = await navigator.clipboard.readText();
        replaceSelection(inputElement, clipboardText);
      },
    },
    {
      action: "select-all",
      labelKey: "contextMenuSelectAll",
      isEnabled: (inputElement) => inputElement.value.length > 0,
      run: async (inputElement) => {
        inputElement.focus();
        inputElement.select();
      },
    },
  ];

  const hideMenu = () => {
    menuElement.hidden = true;
    menuElement.classList.remove(CONTEXT_MENU_OPEN_CLASS);
    activeInputElement = null;
    activeLinkUrl = "";
  };

  const showMenuAt = (x, y) => {
    menuElement.hidden = false;

    const menuWidth = 188;
    const menuHeight = menuElement.offsetHeight || 68;
    const left = Math.min(x, Math.max(12, window.innerWidth - menuWidth - 12));
    const top = Math.min(y, Math.max(12, window.innerHeight - menuHeight - 12));

    menuElement.style.left = `${left}px`;
    menuElement.style.top = `${top}px`;
    playContextMenuOpening(menuElement);
  };

  const renderPageMenu = () => {
    activeInputElement = null;
    activeLinkUrl = "";
    menuElement.replaceChildren(
      createMenuButton({
        action: "refresh",
        label: t("contextMenuRefresh"),
      }),
      createMenuButton({
        action: "settings",
        label: t("contextMenuOpenSettings"),
      })
    );
  };

  const renderInputMenu = (inputElement) => {
    activeInputElement = inputElement;
    activeLinkUrl = "";
    const fragment = document.createDocumentFragment();

    inputMenuItems.forEach((item) => {
      fragment.append(createMenuButton({
        action: item.action,
        label: t(item.labelKey),
        disabled: !item.isEnabled(inputElement),
      }));
    });

    menuElement.replaceChildren(fragment);
  };

  const renderLinkMenu = (url) => {
    activeInputElement = null;
    activeLinkUrl = url;
    const fragment = document.createDocumentFragment();
    const linkMenuItems = [
      { action: "new-tab", label: t("contextMenuOpenNewTab") },
      { action: "new-window", label: t("contextMenuOpenNewWindow") },
      { action: "incognito", label: t("contextMenuOpenIncognito") },
      { action: "copy-link", label: t("contextMenuCopyLink") },
      { action: "save", label: t("contextMenuSaveLinkAs") },
    ];

    linkMenuItems.forEach((item) => {
      fragment.append(createMenuButton(item));
    });

    menuElement.replaceChildren(fragment);
  };

  document.addEventListener("contextmenu", (event) => {
    if (!shouldUseCustomContextMenu(event.target)) {
      hideMenu();
      return;
    }

    event.preventDefault();

    const inputElement = getContextInput(event.target);
    const linkElement = getContextLink(event.target);

    if (inputElement) {
      renderInputMenu(inputElement);
    } else if (linkElement) {
      renderLinkMenu(linkElement.href);
    } else {
      renderPageMenu();
    }

    showMenuAt(event.clientX, event.clientY);
  });

  menuElement.addEventListener("click", async (event) => {
    const buttonElement = event.target instanceof Element
      ? event.target.closest(".page-context-menu-item")
      : null;

    if (!buttonElement || buttonElement.disabled) {
      return;
    }

    const action = buttonElement.dataset.action;

    if (action === "refresh") {
      hideMenu();
      window.location.reload();
      return;
    }

    if (action === "settings") {
      hideMenu();
      openSettingsPanel();
      return;
    }

    if (activeLinkUrl) {
      const url = activeLinkUrl;
      hideMenu();

      try {
        if (action === "new-tab") {
          await chrome.tabs.create({ url });
        } else if (action === "new-window") {
          await chrome.windows.create({ url });
        } else if (action === "incognito") {
          await chrome.windows.create({ url, incognito: true });
        } else if (action === "copy-link") {
          await navigator.clipboard.writeText(url);
        } else if (action === "save") {
          await chrome.runtime.sendMessage({ type: "SAVE_LINK_AS", url });
        }
      } catch (error) {
        console.error("Failed to run link context menu action.", error);
      }

      return;
    }

    const inputElement = activeInputElement;
    const menuItem = inputMenuItems.find((item) => item.action === action);

    if (!inputElement || !menuItem) {
      return;
    }

    hideMenu();

    try {
      await menuItem.run(inputElement);
    } catch (error) {
      console.error("Failed to run input context menu action.", error);
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (menuElement.hidden) {
      return;
    }

    if (menuElement.contains(event.target)) {
      return;
    }

    hideMenu();
  });

  document.addEventListener("scroll", hideMenu, true);
  window.addEventListener("blur", hideMenu);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideMenu();
    }
  });

  subscribeLanguageChange(hideMenu);
}

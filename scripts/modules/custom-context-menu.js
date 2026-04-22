function shouldUseCustomContextMenu(target) {
  if (!(target instanceof Element)) {
    return true;
  }

  if (target.closest(".bookmark-chip, .history-item, input, textarea, select, [contenteditable=\"true\"]")) {
    return false;
  }

  return true;
}

function buildMenu() {
  const menuElement = document.createElement("div");
  menuElement.className = "page-context-menu";
  menuElement.hidden = true;

  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.className = "page-context-menu-item";
  refreshButton.textContent = "刷新本页";

  menuElement.append(refreshButton);
  document.body.appendChild(menuElement);

  return {
    menuElement,
    refreshButton,
  };
}

export function initializeCustomContextMenu() {
  const { menuElement, refreshButton } = buildMenu();

  const hideMenu = () => {
    menuElement.hidden = true;
  };

  const showMenuAt = (x, y) => {
    menuElement.hidden = false;

    const menuWidth = 188;
    const menuHeight = 68;
    const left = Math.min(x, Math.max(12, window.innerWidth - menuWidth - 12));
    const top = Math.min(y, Math.max(12, window.innerHeight - menuHeight - 12));

    menuElement.style.left = `${left}px`;
    menuElement.style.top = `${top}px`;
  };

  document.addEventListener("contextmenu", (event) => {
    if (!shouldUseCustomContextMenu(event.target)) {
      hideMenu();
      return;
    }

    event.preventDefault();
    showMenuAt(event.clientX, event.clientY);
  });

  refreshButton.addEventListener("click", () => {
    hideMenu();
    window.location.reload();
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
}

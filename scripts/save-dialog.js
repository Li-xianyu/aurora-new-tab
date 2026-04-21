import { initializeI18n, t } from "./modules/i18n.js";

const DEFAULT_GROUP_NAME = "Ungrouped";
const DELETE_ICON_SVG = `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M4.25 4.25 11.75 11.75M11.75 4.25 4.25 11.75" />
  </svg>
`;
const CONFIRM_ICON_SVG = `
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3.4 8.4 6.35 11.2 12.6 4.95" />
  </svg>
`;

function setStatus(statusElement, message, type = "") {
  statusElement.textContent = message || "";
  statusElement.classList.toggle("is-error", type === "error");
  statusElement.classList.toggle("is-success", type === "success");
}

function normalizeGroupName(groupName) {
  const normalizedGroupName = String(groupName || "").trim();
  return normalizedGroupName || DEFAULT_GROUP_NAME;
}

function getLocalizedDefaultGroupName() {
  return t("bookmarkDefaultGroup");
}

function getDisplayGroupName(groupName) {
  if (normalizeGroupName(groupName) === DEFAULT_GROUP_NAME) {
    return getLocalizedDefaultGroupName();
  }

  return String(groupName || "").trim();
}

function dedupeGroups(groups = []) {
  return [...new Set([DEFAULT_GROUP_NAME, ...groups.map((groupName) => normalizeGroupName(groupName))])];
}

async function requestSaveDialogState() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SAVE_DIALOG_STATE" });

  if (!response?.ok) {
    throw new Error(response?.error || t("saveDialogLoadFailed"));
  }

  return response.state || null;
}

async function saveLinkEntry(payload) {
  const response = await chrome.runtime.sendMessage({
    type: "SAVE_LINK_ENTRY",
    payload,
  });

  if (!response?.ok) {
    throw new Error(response?.error || t("saveDialogSaveFailed"));
  }

  return response.entry;
}

async function deleteSavedGroup(groupName) {
  const response = await chrome.runtime.sendMessage({
    type: "DELETE_SAVED_GROUP",
    group: groupName,
  });

  if (!response?.ok) {
    throw new Error(response?.error || t("saveDialogDeleteGroupFailed"));
  }

  return response;
}

function updateTextContent(elementId, value) {
  const element = document.getElementById(elementId);

  if (element) {
    element.textContent = value;
  }
}

function applyStaticTranslations() {
  document.title = t("saveDialogTitle");
  updateTextContent("dialog-title", t("saveDialogTitle"));
  updateTextContent("dialog-subtitle", t("saveDialogSubtitle"));
  updateTextContent("title-label", t("saveDialogFieldTitle"));
  updateTextContent("url-label", t("saveDialogFieldLink"));
  updateTextContent("group-label", t("saveDialogFieldGroup"));
  updateTextContent("new-group-tip", t("saveDialogNewGroupTip"));
  updateTextContent("new-group-cancel", t("saveDialogCancel"));
  updateTextContent("new-group-confirm", t("saveDialogAddGroup"));
  updateTextContent("cancel-button", t("saveDialogCancel"));
  updateTextContent("save-button", t("saveDialogSave"));

  const titleInput = document.getElementById("title-input");
  const urlInput = document.getElementById("url-input");
  const newGroupInput = document.getElementById("new-group-input");

  if (titleInput) {
    titleInput.placeholder = t("saveDialogTitlePlaceholder");
  }

  if (urlInput) {
    urlInput.placeholder = t("saveDialogLinkPlaceholder");
  }

  if (newGroupInput) {
    newGroupInput.placeholder = t("saveDialogNewGroupPlaceholder");
  }
}

function setDeleteButtonIcon(button, isConfirm) {
  button.innerHTML = isConfirm ? CONFIRM_ICON_SVG : DELETE_ICON_SVG;
}

function renderGroupPills(containerElement, groups, selectedGroup, pendingDeleteGroup, handlers) {
  containerElement.replaceChildren();

  dedupeGroups(groups).forEach((groupName) => {
    if (groupName === DEFAULT_GROUP_NAME) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "group-pill";
      button.textContent = getDisplayGroupName(groupName);
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", groupName === selectedGroup ? "true" : "false");

      if (groupName === selectedGroup) {
        button.classList.add("is-selected");
      }

      button.addEventListener("click", () => {
        handlers.onSelect(groupName);
      });

      containerElement.appendChild(button);
      return;
    }

    const pill = document.createElement("div");
    pill.className = "group-pill-shell";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-pill";
    button.textContent = getDisplayGroupName(groupName);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", groupName === selectedGroup ? "true" : "false");

    if (groupName === selectedGroup) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      handlers.onSelect(groupName);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "group-delete-button";

    if (pendingDeleteGroup === groupName) {
      deleteButton.classList.add("is-confirm");
      setDeleteButtonIcon(deleteButton, true);
      deleteButton.setAttribute("aria-label", t("saveDialogConfirmDeleteGroup", { group: getDisplayGroupName(groupName) }));
      deleteButton.title = t("saveDialogConfirmDeleteGroup", { group: getDisplayGroupName(groupName) });
    } else {
      setDeleteButtonIcon(deleteButton, false);
      deleteButton.setAttribute("aria-label", t("saveDialogDeleteGroup", { group: getDisplayGroupName(groupName) }));
      deleteButton.title = t("saveDialogDeleteGroup", { group: getDisplayGroupName(groupName) });
    }

    deleteButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      handlers.onDelete(groupName);
    });

    deleteButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    pill.append(button, deleteButton);
    containerElement.appendChild(pill);
  });

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "group-pill is-create";
  createButton.setAttribute("aria-label", t("saveDialogCreateGroup"));
  createButton.title = t("saveDialogCreateGroup");
  createButton.textContent = "+";
  createButton.addEventListener("click", handlers.onCreate);
  containerElement.appendChild(createButton);
}

function toggleNewGroupField(newGroupField, newGroupInput, shouldShow) {
  newGroupField.hidden = !shouldShow;

  if (shouldShow) {
    window.requestAnimationFrame(() => {
      newGroupInput.focus();
      newGroupInput.select();
    });
    return;
  }

  newGroupInput.value = "";
}

async function bootstrap() {
  await initializeI18n();
  applyStaticTranslations();

  const formElement = document.getElementById("save-form");
  const titleInput = document.getElementById("title-input");
  const urlInput = document.getElementById("url-input");
  const groupPills = document.getElementById("group-pills");
  const newGroupField = document.getElementById("new-group-field");
  const newGroupInput = document.getElementById("new-group-input");
  const newGroupCancelButton = document.getElementById("new-group-cancel");
  const newGroupConfirmButton = document.getElementById("new-group-confirm");
  const statusText = document.getElementById("status-text");
  const cancelButton = document.getElementById("cancel-button");

  let groups = [DEFAULT_GROUP_NAME];
  let selectedGroup = DEFAULT_GROUP_NAME;
  let isCreatingGroup = false;
  let pendingDeleteGroup = "";

  const syncGroupPills = () => {
    renderGroupPills(groupPills, groups, selectedGroup, pendingDeleteGroup, {
      onSelect(groupName) {
        selectedGroup = groupName;
        pendingDeleteGroup = "";
        isCreatingGroup = false;
        toggleNewGroupField(newGroupField, newGroupInput, false);
        syncGroupPills();
      },
      onCreate() {
        pendingDeleteGroup = "";
        isCreatingGroup = true;
        toggleNewGroupField(newGroupField, newGroupInput, true);
        syncGroupPills();
      },
      async onDelete(groupName) {
        if (pendingDeleteGroup === groupName) {
          try {
            setStatus(statusText, t("saveDialogDeletingGroup"));
            const result = await deleteSavedGroup(groupName);
            groups = dedupeGroups(result.groups || []);
            selectedGroup = groups.includes(selectedGroup) ? selectedGroup : DEFAULT_GROUP_NAME;
            pendingDeleteGroup = "";
            setStatus(statusText, t("saveDialogDeletedGroup", { group: getDisplayGroupName(groupName) }), "success");
            syncGroupPills();
          } catch (error) {
            pendingDeleteGroup = "";
            syncGroupPills();
            setStatus(statusText, error instanceof Error ? error.message : String(error), "error");
          }
          return;
        }

        pendingDeleteGroup = groupName;
        isCreatingGroup = false;
        toggleNewGroupField(newGroupField, newGroupInput, false);
        setStatus(statusText, t("saveDialogDeleteGroupHint", { group: getDisplayGroupName(groupName) }));
        syncGroupPills();
      },
    });
  };

  try {
    const state = await requestSaveDialogState();

    titleInput.value = state?.title || "";
    urlInput.value = state?.url || "";
    groups = dedupeGroups(state?.groups || []);
    selectedGroup = normalizeGroupName(state?.selectedGroup || DEFAULT_GROUP_NAME);
    syncGroupPills();
  } catch (error) {
    syncGroupPills();
    setStatus(statusText, error instanceof Error ? error.message : String(error), "error");
  }

  toggleNewGroupField(newGroupField, newGroupInput, false);

  newGroupCancelButton.addEventListener("click", () => {
    isCreatingGroup = false;
    toggleNewGroupField(newGroupField, newGroupInput, false);
  });

  newGroupConfirmButton.addEventListener("click", () => {
    const nextGroupName = String(newGroupInput.value || "").trim();

    if (!nextGroupName) {
      setStatus(statusText, t("saveDialogEmptyGroupName"), "error");
      newGroupInput.focus();
      return;
    }

    groups = dedupeGroups([...groups, nextGroupName]);
    selectedGroup = nextGroupName;
    pendingDeleteGroup = "";
    isCreatingGroup = false;
    toggleNewGroupField(newGroupField, newGroupInput, false);
    setStatus(statusText, "");
    syncGroupPills();
  });

  newGroupInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      newGroupConfirmButton.click();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      newGroupCancelButton.click();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const target = event.target;

    if (!(target instanceof Element) || !pendingDeleteGroup) {
      return;
    }

    if (target.closest(".group-delete-button")) {
      return;
    }

    pendingDeleteGroup = "";
    syncGroupPills();
    setStatus(statusText, "");
  });

  cancelButton.addEventListener("click", () => {
    window.close();
  });

  formElement.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isCreatingGroup && String(newGroupInput.value || "").trim()) {
      newGroupConfirmButton.click();
    }

    try {
      setStatus(statusText, t("saveDialogSaving"));

      const savedEntry = await saveLinkEntry({
        title: titleInput.value.trim(),
        url: urlInput.value.trim(),
        group: selectedGroup || DEFAULT_GROUP_NAME,
      });

      setStatus(statusText, t("saveDialogSavedTo", { group: getDisplayGroupName(savedEntry.group) }), "success");
      window.setTimeout(() => {
        window.close();
      }, 280);
    } catch (error) {
      setStatus(statusText, error instanceof Error ? error.message : String(error), "error");
    }
  });
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap save dialog.", error);
});

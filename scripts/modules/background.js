import { getMicrosoftDailyImage } from "../services/bing-image-service.js";

const FALLBACK_BACKGROUND =
  "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 52%, rgba(255, 255, 255, 1) 100%)";

const CUSTOM_BACKGROUND_STORAGE_KEY = "customBackgroundImage";
const BACKGROUND_SOURCE_MODE_STORAGE_KEY = "backgroundSourceMode";
const BACKGROUND_SOURCE_MODE_BING = "bing";
const BACKGROUND_SOURCE_MODE_LOCAL = "local";

const IMAGE_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
]);

function applyBackground(element, imageUrl) {
  if (!element) {
    return;
  }

  element.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : FALLBACK_BACKGROUND;
  element.style.backgroundPosition = "center center";
  element.style.backgroundRepeat = "no-repeat";
  element.style.backgroundSize = "cover";
}

function preloadImage(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(imageUrl);
    image.onerror = () => reject(new Error(`Failed to preload image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function resetLayerVisibility(baseLayer, activeLayer) {
  baseLayer?.classList.add("is-visible");
  activeLayer?.classList.remove("is-visible");
}

function transitionBackground(baseLayer, activeLayer, imageUrl) {
  if (!baseLayer || !activeLayer) {
    return;
  }

  activeLayer.classList.remove("is-visible");
  applyBackground(activeLayer, imageUrl);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      activeLayer.classList.add("is-visible");
      baseLayer.classList.remove("is-visible");
    });
  });
}

async function getStoredCustomBackground() {
  const result = await chrome.storage.local.get(CUSTOM_BACKGROUND_STORAGE_KEY);
  return result[CUSTOM_BACKGROUND_STORAGE_KEY] || null;
}

async function setStoredCustomBackground(payload) {
  await chrome.storage.local.set({
    [CUSTOM_BACKGROUND_STORAGE_KEY]: payload,
  });
}

async function removeStoredCustomBackground() {
  await chrome.storage.local.remove(CUSTOM_BACKGROUND_STORAGE_KEY);
}

export async function getBackgroundSourceMode() {
  const result = await chrome.storage.local.get(BACKGROUND_SOURCE_MODE_STORAGE_KEY);
  return result[BACKGROUND_SOURCE_MODE_STORAGE_KEY] === BACKGROUND_SOURCE_MODE_LOCAL
    ? BACKGROUND_SOURCE_MODE_LOCAL
    : BACKGROUND_SOURCE_MODE_BING;
}

export async function setBackgroundSourceMode(mode) {
  const normalizedMode = mode === BACKGROUND_SOURCE_MODE_LOCAL
    ? BACKGROUND_SOURCE_MODE_LOCAL
    : BACKGROUND_SOURCE_MODE_BING;

  if (normalizedMode === BACKGROUND_SOURCE_MODE_LOCAL) {
    const customBackground = await getStoredCustomBackground();

    if (!customBackground?.imageDataUrl) {
      await chrome.storage.local.set({
        [BACKGROUND_SOURCE_MODE_STORAGE_KEY]: BACKGROUND_SOURCE_MODE_BING,
      });
      return BACKGROUND_SOURCE_MODE_BING;
    }
  }

  await chrome.storage.local.set({
    [BACKGROUND_SOURCE_MODE_STORAGE_KEY]: normalizedMode,
  });

  return normalizedMode;
}

export async function hasCustomBackgroundImage() {
  const customBackground = await getStoredCustomBackground();
  return Boolean(customBackground?.imageDataUrl);
}

export async function clearCustomBackgroundImage() {
  await removeStoredCustomBackground();
  await chrome.storage.local.set({
    [BACKGROUND_SOURCE_MODE_STORAGE_KEY]: BACKGROUND_SOURCE_MODE_BING,
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`Failed to read image file: ${file?.name || "unknown"}`));
    reader.readAsDataURL(file);
  });
}

function findFirstImageFile(fileList) {
  return [...(fileList || [])].find((file) => {
    if (!file) {
      return false;
    }

    if (file.type && IMAGE_FILE_TYPES.has(file.type)) {
      return true;
    }

    return /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(file.name || "");
  }) || null;
}

export async function initializeDailyBackground({
  baseLayer,
  activeLayer,
  dropOverlayElement,
  onStateChange,
}) {
  if (!baseLayer || !activeLayer) {
    return null;
  }

  applyBackground(baseLayer, "");
  applyBackground(activeLayer, "");
  resetLayerVisibility(baseLayer, activeLayer);

  const emitStateChange = async () => {
    if (typeof onStateChange !== "function") {
      return;
    }

    onStateChange({
      mode: await getBackgroundSourceMode(),
      hasCustomImage: await hasCustomBackgroundImage(),
    });
  };

  const showDropOverlay = (visible) => {
    if (!dropOverlayElement) {
      return;
    }

    dropOverlayElement.hidden = !visible;
    dropOverlayElement.classList.toggle("is-visible", visible);
  };

  const renderBackground = async (imageSource) => {
    if (!imageSource) {
      applyBackground(baseLayer, "");
      applyBackground(activeLayer, "");
      resetLayerVisibility(baseLayer, activeLayer);
      return;
    }

    const imageUrl = await preloadImage(imageSource);
    transitionBackground(baseLayer, activeLayer, imageUrl);
  };

  const renderForCurrentMode = async () => {
    const [mode, customBackground] = await Promise.all([
      getBackgroundSourceMode(),
      getStoredCustomBackground(),
    ]);

    if (mode === BACKGROUND_SOURCE_MODE_LOCAL && customBackground?.imageDataUrl) {
      await renderBackground(customBackground.imageDataUrl);
      await emitStateChange();
      return;
    }

    if (mode === BACKGROUND_SOURCE_MODE_LOCAL && !customBackground?.imageDataUrl) {
      await setBackgroundSourceMode(BACKGROUND_SOURCE_MODE_BING);
    }

    const dailyImage = await getMicrosoftDailyImage();
    await renderBackground(dailyImage.imageDataUrl || dailyImage.imageUrl);
    await emitStateChange();
  };

  try {
    await renderForCurrentMode();
  } catch (error) {
    console.error("Failed to load background image.", error);
    applyBackground(baseLayer, "");
    applyBackground(activeLayer, "");
    resetLayerVisibility(baseLayer, activeLayer);
    await emitStateChange();
  }

  let dragDepth = 0;

  const resetDragState = () => {
    dragDepth = 0;
    showDropOverlay(false);
  };

  document.addEventListener("dragenter", (event) => {
    const imageFile = findFirstImageFile(event.dataTransfer?.items || event.dataTransfer?.files);

    if (!imageFile) {
      return;
    }

    dragDepth += 1;
    event.preventDefault();
    showDropOverlay(true);
  });

  document.addEventListener("dragover", (event) => {
    const imageFile = findFirstImageFile(event.dataTransfer?.items || event.dataTransfer?.files);

    if (!imageFile) {
      return;
    }

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    showDropOverlay(true);
  });

  document.addEventListener("dragleave", (event) => {
    dragDepth = Math.max(0, dragDepth - 1);

    if (
      dragDepth === 0 ||
      event.relatedTarget === null ||
      event.target === document.documentElement ||
      event.target === document.body
    ) {
      showDropOverlay(false);
    }
  });

  document.addEventListener("drop", (event) => {
    const imageFile = findFirstImageFile(event.dataTransfer?.files);

    if (!imageFile) {
      resetDragState();
      return;
    }

    event.preventDefault();
    resetDragState();

    void (async () => {
      try {
        const imageDataUrl = await readFileAsDataUrl(imageFile);
        await setStoredCustomBackground({
          name: imageFile.name || "custom-background",
          type: imageFile.type || "",
          size: Number.isFinite(imageFile.size) ? imageFile.size : 0,
          imageDataUrl,
          updatedAt: new Date().toISOString(),
        });
        await setBackgroundSourceMode(BACKGROUND_SOURCE_MODE_LOCAL);
        await renderBackground(imageDataUrl);
        await emitStateChange();
      } catch (error) {
        console.error("Failed to import custom background image.", error);
      }
    })();
  });

  window.addEventListener("blur", resetDragState);

  return {
    async sync() {
      await renderForCurrentMode();
    },
    async setMode(mode) {
      await setBackgroundSourceMode(mode);
      await renderForCurrentMode();
    },
    async clearCustomImage() {
      await clearCustomBackgroundImage();
      await renderForCurrentMode();
    },
    async getState() {
      return {
        mode: await getBackgroundSourceMode(),
        hasCustomImage: await hasCustomBackgroundImage(),
      };
    },
  };
}

export {
  BACKGROUND_SOURCE_MODE_BING,
  BACKGROUND_SOURCE_MODE_LOCAL,
};

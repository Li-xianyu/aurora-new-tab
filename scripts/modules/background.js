import { getMicrosoftDailyImage } from "../services/bing-image-service.js";

const FALLBACK_BACKGROUND =
  "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 52%, rgba(255, 255, 255, 1) 100%)";

function applyBackground(element, imageUrl) {
  if (!element) {
    return;
  }

  element.style.backgroundImage = imageUrl
    ? `url("${imageUrl}")`
    : FALLBACK_BACKGROUND;
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

export async function initializeDailyBackground({ baseLayer, activeLayer }) {
  if (!baseLayer || !activeLayer) {
    return;
  }

  applyBackground(baseLayer, "");
  applyBackground(activeLayer, "");
  resetLayerVisibility(baseLayer, activeLayer);

  try {
    const dailyImage = await getMicrosoftDailyImage();
    const imageSource = dailyImage.imageDataUrl || dailyImage.imageUrl;
    const imageUrl = await preloadImage(imageSource);
    transitionBackground(baseLayer, activeLayer, imageUrl);
  } catch (error) {
    console.error("Failed to load Microsoft daily image.", error);
    applyBackground(baseLayer, "");
    applyBackground(activeLayer, "");
    resetLayerVisibility(baseLayer, activeLayer);
  }
}

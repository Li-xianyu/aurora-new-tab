const BING_BASE_URL = "https://www.bing.com";

function normalizeImageUrl(urlPath) {
  if (!urlPath) {
    return "";
  }

  if (urlPath.startsWith("http://") || urlPath.startsWith("https://")) {
    return urlPath;
  }

  return new URL(urlPath, BING_BASE_URL).toString();
}

function parseDailyImagePayload(data) {
  const image = data?.images?.[0];

  if (!image?.url) {
    throw new Error("Bing daily image payload is missing images[0].url.");
  }

  return {
    startDate: image.startdate ?? "",
    endDate: image.enddate ?? "",
    title: image.title ?? "",
    copyright: image.copyright ?? "",
    copyrightLink: image.copyrightlink ?? "",
    imageUrl: normalizeImageUrl(image.url),
    imageDataUrl: image.imageDataUrl ?? "",
  };
}

function requestBingDailyImagePayload() {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("Chrome runtime messaging is unavailable."));
      return;
    }

    chrome.runtime.sendMessage({ type: "GET_BING_DAILY_IMAGE" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Unknown Bing image request failure."));
        return;
      }

      resolve({
        data: response.data,
        fromCache: Boolean(response.fromCache),
      });
    });
  });
}

export async function getMicrosoftDailyImage() {
  const response = await requestBingDailyImagePayload();

  return {
    ...parseDailyImagePayload(response.data),
    fromCache: response.fromCache,
  };
}

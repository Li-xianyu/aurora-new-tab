function parseBaiduSuggestionText(rawText) {
  const trimmed = String(rawText || "").trim();
  const match =
    trimmed.match(/^[\w$.]+\(([\s\S]+)\);?$/) ||
    trimmed.match(/^([\s\S]+)$/);

  if (!match?.[1]) {
    throw new Error("Baidu suggestion response format is invalid.");
  }

  const payloadText = match[1];
  const normalizedPayloadText = payloadText.replace(
    /([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g,
    '$1"$2"$3'
  );
  let payload;

  try {
    payload = JSON.parse(normalizedPayloadText);
  } catch {
    throw new Error("Failed to parse Baidu suggestion payload.");
  }

  return Array.isArray(payload?.s) ? payload.s : [];
}

async function requestSuggestionItemsDirectly(keyword) {
  const url = new URL("https://suggestion.baidu.com/su");
  url.searchParams.set("wd", keyword);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Baidu suggestion request failed with status ${response.status}.`);
  }

  const buffer = await response.arrayBuffer();
  const text = new TextDecoder("gb18030").decode(buffer);
  return parseBaiduSuggestionText(text);
}

function requestSuggestionItemsViaBackground(keyword) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "GET_BAIDU_SUGGESTIONS",
        keyword,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response?.ok) {
          reject(new Error(response?.error || "Unknown Baidu suggestion request failure."));
          return;
        }

        resolve(Array.isArray(response.suggestions) ? response.suggestions : []);
      }
    );
  });
}

export async function getBaiduSuggestions(keyword) {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    return [];
  }

  try {
    return await requestSuggestionItemsDirectly(trimmedKeyword);
  } catch (directRequestError) {
    try {
      return await requestSuggestionItemsViaBackground(trimmedKeyword);
    } catch (backgroundRequestError) {
      const directMessage =
        directRequestError instanceof Error ? directRequestError.message : String(directRequestError);
      const backgroundMessage =
        backgroundRequestError instanceof Error
          ? backgroundRequestError.message
          : String(backgroundRequestError);

      throw new Error(
        `Direct request failed: ${directMessage}; background request failed: ${backgroundMessage}`
      );
    }
  }
}

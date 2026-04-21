function formatTimePart(value) {
  return String(value).padStart(2, "0");
}

function getCurrentTimeText() {
  const now = new Date();
  const hours = formatTimePart(now.getHours());
  const minutes = formatTimePart(now.getMinutes());

  return `${hours}:${minutes}`;
}

export function initializeClock(clockElement) {
  if (!clockElement) {
    return;
  }

  const renderClock = () => {
    clockElement.textContent = getCurrentTimeText();
  };

  renderClock();

  const now = new Date();
  const delayUntilNextMinute =
    (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

  window.setTimeout(() => {
    renderClock();
    window.setInterval(renderClock, 60 * 1000);
  }, delayUntilNextMinute);
}

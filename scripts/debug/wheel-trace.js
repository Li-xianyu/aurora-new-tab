const ACTIVE_TRACE_KEY = "__newTabActiveWheelTrace";
const LAST_REPORT_KEY = "__lastNewTabWheelTraceReport";
const DEFAULT_SETTLE_AFTER_WHEEL_MS = 1200;

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function readCssNumber(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return round(Number.parseFloat(value) || 0, 4);
}

function readTranslateY(element) {
  const transform = element ? getComputedStyle(element).transform : "none";

  if (!transform || transform === "none") {
    return 0;
  }

  try {
    return round(new DOMMatrixReadOnly(transform).m42);
  } catch {
    return null;
  }
}

function describeTarget(target) {
  if (!(target instanceof Element)) {
    return String(target?.nodeName || "unknown");
  }

  const id = target.id ? `#${target.id}` : "";
  const className = [...target.classList].slice(0, 3).map((name) => `.${name}`).join("");
  return `${target.tagName.toLowerCase()}${id}${className}`;
}

function getRealScreen(className) {
  return document.querySelector(`.${className}:not(.screen-loop-clone)`);
}

function takeSnapshot(rootElement) {
  const pageShellElement = document.querySelector(".page-shell");
  const historyElement = getRealScreen("history-screen");
  const heroElement = getRealScreen("hero-screen");
  const linksElement = getRealScreen("links-screen");
  const topCloneElement = document.querySelector(".is-top-loop-clone");
  const bottomCloneElement = document.querySelector(".is-bottom-loop-clone");

  return {
    t: round(performance.now(), 1),
    scrollTop: round(rootElement.scrollTop),
    clientHeight: rootElement.clientHeight,
    scrollHeight: rootElement.scrollHeight,
    historyTop: round(historyElement?.offsetTop),
    heroTop: round(heroElement?.offsetTop),
    linksTop: round(linksElement?.offsetTop),
    topCloneTop: round(topCloneElement?.offsetTop),
    bottomCloneTop: round(bottomCloneElement?.offsetTop),
    linksViewportTop: round(linksElement?.getBoundingClientRect().top),
    linksTranslateY: readTranslateY(linksElement),
    screenProgress: readCssNumber("--screen-progress"),
    historyProgress: readCssNumber("--history-progress"),
    activeScreen: pageShellElement?.dataset.activeScreen || "",
    isAnimating: Boolean(pageShellElement?.classList.contains("is-screen-animating")),
    isLinksView: Boolean(pageShellElement?.classList.contains("is-links-view")),
    isHistoryView: Boolean(pageShellElement?.classList.contains("is-history-view")),
    isLoopEnabled: document.body.classList.contains("is-screen-loop-enabled"),
    isReducedMotion: document.body.classList.contains("is-reduced-motion"),
  };
}

function sameVisualState(left, right) {
  return (
    left.scrollTop === right.scrollTop &&
    left.linksTop === right.linksTop &&
    left.linksViewportTop === right.linksViewportTop &&
    left.linksTranslateY === right.linksTranslateY &&
    left.screenProgress === right.screenProgress &&
    left.activeScreen === right.activeScreen &&
    left.isAnimating === right.isAnimating
  );
}

function buildReport(session) {
  const states = session.entries.filter((entry) => entry.state).map((entry) => entry.state);
  const wheelEntries = session.entries.filter((entry) => entry.type === "wheel-before");
  const firstState = states[0] || {};
  const finalState = states[states.length - 1] || {};
  const minLinksViewportTop = states.length
    ? Math.min(...states.map((state) => state.linksViewportTop))
    : null;
  const maxScrollTop = states.length
    ? Math.max(...states.map((state) => state.scrollTop))
    : null;

  return {
    capturedAt: new Date().toISOString(),
    page: location.href,
    userAgent: navigator.userAgent,
    summary: {
      wheelCount: wheelEntries.length,
      totalDeltaY: round(wheelEntries.reduce((total, entry) => total + entry.deltaY, 0)),
      firstScreen: firstState.activeScreen || "",
      finalScreen: finalState.activeScreen || "",
      startScrollTop: firstState.scrollTop ?? null,
      finalScrollTop: finalState.scrollTop ?? null,
      maxScrollTop,
      minLinksViewportTop,
      linksPassedTarget: minLinksViewportTop !== null && minLinksViewportTop < -1,
      returnedAfterPassing: minLinksViewportTop !== null &&
        minLinksViewportTop < -1 &&
        finalState.linksViewportTop > minLinksViewportTop + 1,
    },
    wheels: wheelEntries.map((entry) => ({
      t: entry.state.t,
      deltaY: entry.deltaY,
      deltaMode: entry.deltaMode,
      insideScrollRoot: entry.insideScrollRoot,
      target: entry.target,
      scrollTop: entry.state.scrollTop,
      linksViewportTop: entry.state.linksViewportTop,
      activeScreen: entry.state.activeScreen,
      isAnimating: entry.state.isAnimating,
    })),
    timeline: session.entries,
  };
}

function printReport(report) {
  console.group("[wheel-trace] capture complete");
  console.table(report.wheels);
  console.table([report.summary]);
  console.log("WHEEL_TRACE_BEGIN");
  console.log(JSON.stringify(report));
  console.log("WHEEL_TRACE_END");
  console.info("Run copy(JSON.stringify(window.__lastNewTabWheelTraceReport)) and paste it back into the chat.");
  console.groupEnd();
}

function finishTrace(session, shouldPrint = true) {
  if (!session || session.finished) {
    return window[LAST_REPORT_KEY] || null;
  }

  session.finished = true;
  session.record("finished");
  document.removeEventListener("wheel", session.onWheel, true);
  session.rootElement.removeEventListener("scroll", session.onScroll);
  window.clearTimeout(session.finishTimerId);
  window.cancelAnimationFrame(session.frameId);

  const report = buildReport(session);
  window[LAST_REPORT_KEY] = report;

  if (window[ACTIVE_TRACE_KEY] === session) {
    delete window[ACTIVE_TRACE_KEY];
  }

  if (shouldPrint) {
    printReport(report);
  }

  return report;
}

export function stopWheelTrace({ print = true } = {}) {
  return finishTrace(window[ACTIVE_TRACE_KEY], print);
}

export function startWheelTrace({ settleAfterWheelMs = DEFAULT_SETTLE_AFTER_WHEEL_MS } = {}) {
  const rootElement = document.getElementById("scroll-root");

  if (!rootElement) {
    throw new Error("[wheel-trace] #scroll-root was not found on this page.");
  }

  stopWheelTrace({ print: false });

  const session = {
    entries: [],
    finished: false,
    firstWheelSeen: false,
    frameId: 0,
    finishTimerId: 0,
    rootElement,
    lastFrameState: null,
    record(type, details = {}) {
      const state = takeSnapshot(rootElement);

      if (type === "frame" && session.lastFrameState && sameVisualState(state, session.lastFrameState)) {
        return;
      }

      if (type === "frame") {
        session.lastFrameState = state;
      }

      session.entries.push({
        type,
        ...details,
        state,
      });
    },
  };

  const captureFrames = () => {
    if (session.finished || !session.firstWheelSeen) {
      return;
    }

    session.record("frame");
    session.frameId = window.requestAnimationFrame(captureFrames);
  };

  session.onScroll = () => {
    session.record("scroll");
  };

  session.onWheel = (event) => {
    if (!session.firstWheelSeen) {
      session.firstWheelSeen = true;
      session.frameId = window.requestAnimationFrame(captureFrames);
    }

    session.record("wheel-before", {
      deltaX: round(event.deltaX),
      deltaY: round(event.deltaY),
      deltaMode: event.deltaMode,
      insideScrollRoot: rootElement.contains(event.target),
      target: describeTarget(event.target),
    });

    queueMicrotask(() => {
      if (!session.finished) {
        session.record("wheel-after", {
          deltaY: round(event.deltaY),
          defaultPrevented: event.defaultPrevented,
        });
      }
    });

    window.clearTimeout(session.finishTimerId);
    session.finishTimerId = window.setTimeout(() => {
      finishTrace(session);
    }, settleAfterWheelMs);
  };

  document.addEventListener("wheel", session.onWheel, { capture: true, passive: true });
  rootElement.addEventListener("scroll", session.onScroll, { passive: true });
  session.record("armed");
  window[ACTIVE_TRACE_KEY] = session;

  console.info("[wheel-trace] armed. Scroll once now; a report prints automatically after movement settles.");
  return session;
}

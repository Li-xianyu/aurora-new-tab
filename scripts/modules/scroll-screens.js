const HERO_LOCK_THRESHOLD_RATIO = 0.18;
const LINKS_VIEW_THRESHOLD_RATIO = 0.42;
const HISTORY_VIEW_THRESHOLD_RATIO = 0.42;
const TRANSITION_DURATION_MS = 520;
const WHEEL_TRIGGER_DELTA = 14;
const WHEEL_TRIGGER_DELTA_REDUCED_MOTION = 34;
const WHEEL_DIRECT_TRIGGER_DELTA = 18;
const WHEEL_DIRECT_TRIGGER_DELTA_REDUCED_MOTION = 42;
const WHEEL_SNAP_PROXIMITY_PX = 52;
const POINTER_SWIPE_TRIGGER_DELTA = 54;
const POINTER_SETTINGS_TRIGGER_DELTA = 72;
const POINTER_SETTINGS_PREVIEW_MAX = 220;
const POINTER_DIRECTION_LOCK_DELTA = 18;
const POINTER_DIRECTION_DOMINANCE_RATIO = 1.35;
const POINTER_FLICK_VELOCITY_THRESHOLD = 0.42;
const SCROLL_SETTLE_DELAY_MS = 110;
const WHEEL_ACCUM_RESET_MS = 180;
const LOOP_TELEPORT_EPSILON = 2;
const VISUAL_STATE_SNAP_EPSILON = 36;
const ANIMATION_WATCHDOG_MS = TRANSITION_DURATION_MS + 220;

function isReducedMotionEnabled() {
  return document.body.classList.contains("is-reduced-motion");
}

function isScreenLoopEnabled() {
  return document.body.classList.contains("is-screen-loop-enabled");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}

function getNearestScreenTop(currentTop, screenTops) {
  return screenTops.reduce((nearestTop, nextTop) => {
    return Math.abs(nextTop - currentTop) < Math.abs(nearestTop - currentTop) ? nextTop : nearestTop;
  }, screenTops[0] ?? 0);
}

function isWithinHistoryList(target) {
  return target instanceof Element && Boolean(target.closest(".history-list-shell"));
}

function isPointerGestureTargetAllowed(target) {
  if (!(target instanceof Element)) {
    return true;
  }

  if (target.closest("button, input, textarea, select, a, [role=\"button\"], [contenteditable=\"true\"]")) {
    return false;
  }

  if (isWithinHistoryList(target)) {
    return false;
  }

  return true;
}

function getPageShell() {
  return document.querySelector(".page-shell");
}

function getSettingsProgressValue() {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--settings-progress"));
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

function isSettingsPreviewActive() {
  return getPageShell()?.classList.contains("is-settings-preview") || false;
}

function setSettingsDragState(isDragging) {
  getPageShell()?.classList.toggle("is-settings-dragging", isDragging);
}

function setScreenDragState(isDragging) {
  document.body.classList.toggle("is-screen-dragging", isDragging);
}

function normalizeSettingsPreviewState() {
  const pageShell = getPageShell();

  if (!pageShell || pageShell.classList.contains("is-settings-dragging")) {
    return;
  }

  if (getSettingsProgressValue() > 0.08) {
    return;
  }

  document.documentElement.style.setProperty("--settings-progress", "0");
  pageShell.classList.remove("is-settings-preview");
}

function stripCloneIds(element) {
  element.removeAttribute("id");
  element.querySelectorAll("[id]").forEach((childElement) => {
    childElement.removeAttribute("id");
  });
}

function createLoopClone(screenElement, position) {
  const cloneElement = screenElement.cloneNode(true);
  stripCloneIds(cloneElement);
  cloneElement.classList.add("screen-loop-clone", `is-${position}-loop-clone`);
  cloneElement.setAttribute("aria-hidden", "true");
  cloneElement.inert = true;
  return cloneElement;
}

function syncLoopCloneContent(sourceElement, cloneElement) {
  cloneElement.innerHTML = sourceElement.innerHTML;
  stripCloneIds(cloneElement);
}

function observeLoopCloneSource(sourceElement, cloneElement) {
  let syncTimerId = 0;
  const observer = new MutationObserver(() => {
    if (syncTimerId) {
      window.clearTimeout(syncTimerId);
    }

    syncTimerId = window.setTimeout(() => {
      syncTimerId = 0;
      syncLoopCloneContent(sourceElement, cloneElement);
    }, 60);
  });

  observer.observe(sourceElement, {
    attributes: true,
    childList: true,
    subtree: true,
  });

  return observer;
}

function resetGesturePreview(scrollRootElement, pointerGesture, refresh) {
  if (!pointerGesture) {
    return;
  }

  if (isReducedMotionEnabled()) {
    document.documentElement.style.setProperty("--settings-progress", "0");
    getPageShell()?.classList.remove("is-settings-preview");
    setSettingsDragState(false);
    setScreenDragState(false);
    refresh();
    return;
  }

  scrollRootElement.scrollTop = pointerGesture.startScrollTop;
  document.documentElement.style.setProperty("--settings-progress", "0");
  getPageShell()?.classList.remove("is-settings-preview");
  setSettingsDragState(false);
  setScreenDragState(false);
  refresh();
}

function syncScrollVisualState(scrollRootElement, historyScreenElement, heroScreenElement, linksScreenElement) {
  const heroTop = heroScreenElement?.offsetTop || 0;
  const linksTop = linksScreenElement?.offsetTop || window.innerHeight;
  const historyTop = historyScreenElement?.offsetTop || 0;
  const rawScrollTop = scrollRootElement.scrollTop;
  const scrollTop = (() => {
    if (!isScreenLoopEnabled()) {
      return rawScrollTop;
    }

    if (rawScrollTop < historyTop - LOOP_TELEPORT_EPSILON) {
      return linksTop;
    }

    if (rawScrollTop > linksTop + LOOP_TELEPORT_EPSILON) {
      return historyTop;
    }

    return rawScrollTop;
  })();
  const nearHistoryTop = Math.abs(scrollTop - historyTop) <= VISUAL_STATE_SNAP_EPSILON;
  const nearHeroTop = Math.abs(scrollTop - heroTop) <= VISUAL_STATE_SNAP_EPSILON;
  const nearLinksTop = Math.abs(scrollTop - linksTop) <= VISUAL_STATE_SNAP_EPSILON;
  const snappedScrollTop = nearHistoryTop
    ? historyTop
    : nearHeroTop
      ? heroTop
      : nearLinksTop
        ? linksTop
        : scrollTop;
  const forwardProgress = clamp((snappedScrollTop - heroTop) / Math.max(linksTop - heroTop, 1), 0, 1);
  const backwardProgress = clamp((heroTop - snappedScrollTop) / Math.max(heroTop - historyTop, 1), 0, 1);
  const isLinksView = nearLinksTop
    ? true
    : nearHeroTop || nearHistoryTop
      ? false
      : snappedScrollTop > heroTop + ((linksTop - heroTop) * LINKS_VIEW_THRESHOLD_RATIO);
  const isHistoryView = nearHistoryTop
    ? true
    : nearHeroTop || nearLinksTop
      ? false
      : snappedScrollTop < heroTop - ((heroTop - historyTop) * HISTORY_VIEW_THRESHOLD_RATIO);
  const pageShell = getPageShell();
  const scrimProgress = Math.max(forwardProgress, backwardProgress);
  const settledScreen = nearHistoryTop
    ? "history"
    : nearHeroTop
      ? "hero"
      : nearLinksTop
        ? "links"
        : "";

  document.documentElement.style.setProperty("--screen-progress", forwardProgress.toFixed(4));
  document.documentElement.style.setProperty("--history-progress", backwardProgress.toFixed(4));
  document.documentElement.style.setProperty("--view-scrim-progress", scrimProgress.toFixed(4));
  pageShell?.classList.toggle("is-links-view", isLinksView);
  pageShell?.classList.toggle("is-history-view", isHistoryView);

  if (pageShell) {
    if (settledScreen) {
      pageShell.dataset.activeScreen = settledScreen;
    } else {
      delete pageShell.dataset.activeScreen;
    }
  }
}

function animateScrollTo(scrollRootElement, targetTop, onFrame) {
  if (isReducedMotionEnabled()) {
    scrollRootElement.scrollTop = targetTop;
    onFrame();
    return Promise.resolve();
  }

  const startTop = scrollRootElement.scrollTop;
  const distance = targetTop - startTop;
  const startTime = performance.now();

  return new Promise((resolve) => {
    let frameId = 0;
    let isResolved = false;
    let watchdogTimerId = 0;

    const finish = () => {
      if (isResolved) {
        return;
      }

      isResolved = true;

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      if (watchdogTimerId) {
        window.clearTimeout(watchdogTimerId);
        watchdogTimerId = 0;
      }

      scrollRootElement.scrollTop = targetTop;
      onFrame();
      resolve();
    };

    const tick = (now) => {
      if (isResolved) {
        return;
      }

      const elapsed = now - startTime;
      const progress = clamp(elapsed / TRANSITION_DURATION_MS, 0, 1);
      const easedProgress = easeOutCubic(progress);

      scrollRootElement.scrollTop = startTop + (distance * easedProgress);
      onFrame();

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
        return;
      }

      finish();
    };

    watchdogTimerId = window.setTimeout(finish, ANIMATION_WATCHDOG_MS);
    frameId = window.requestAnimationFrame(tick);
  });
}

export function initializeScrollScreens({
  scrollRootElement,
  historyScreenElement,
  heroScreenElement,
  linksScreenElement,
}) {
  if (!scrollRootElement || !historyScreenElement || !heroScreenElement || !linksScreenElement) {
    return;
  }

  const topLoopCloneElement = createLoopClone(linksScreenElement, "top");
  const bottomLoopCloneElement = createLoopClone(historyScreenElement, "bottom");
  scrollRootElement.insertBefore(topLoopCloneElement, historyScreenElement);
  scrollRootElement.appendChild(bottomLoopCloneElement);
  observeLoopCloneSource(linksScreenElement, topLoopCloneElement);
  observeLoopCloneSource(historyScreenElement, bottomLoopCloneElement);

  let isAnimating = false;
  let pointerGesture = null;
  let scrollSettleTimerId = 0;
  let wheelAccumulatedDelta = 0;
  let wheelAccumulatedDirection = 0;
  let wheelAccumulatedTimerId = 0;
  let pendingLayoutRepair = false;
  let layoutRepairFrameId = 0;

  const refresh = () => {
    normalizeSettingsPreviewState();
    syncScrollVisualState(
      scrollRootElement,
      historyScreenElement,
      heroScreenElement,
      linksScreenElement
    );
  };

  const getScreenTops = () => ({
    topLoop: topLoopCloneElement.offsetTop,
    history: historyScreenElement.offsetTop,
    hero: heroScreenElement.offsetTop,
    links: linksScreenElement.offsetTop,
    bottomLoop: bottomLoopCloneElement.offsetTop,
  });

  const teleportTo = (targetTop) => {
    scrollRootElement.scrollTop = targetTop;
    refresh();
  };

  const normalizeLoopPosition = () => {
    if (!isScreenLoopEnabled()) {
      return;
    }

    const screenTops = getScreenTops();
    const scrollTop = scrollRootElement.scrollTop;

    if (Math.abs(scrollTop - screenTops.topLoop) <= LOOP_TELEPORT_EPSILON) {
      teleportTo(screenTops.links);
      return;
    }

    if (Math.abs(scrollTop - screenTops.bottomLoop) <= LOOP_TELEPORT_EPSILON) {
      teleportTo(screenTops.history);
    }
  };

  const requestLayoutRepair = () => {
    if (layoutRepairFrameId) {
      return;
    }

    layoutRepairFrameId = window.requestAnimationFrame(() => {
      layoutRepairFrameId = 0;

      if (isAnimating || pointerGesture || isSettingsPreviewActive()) {
        pendingLayoutRepair = true;
        refresh();
        return;
      }

      pendingLayoutRepair = false;
      refresh();
      normalizeLoopPosition();
      scheduleScrollSettle();
    });
  };

  const animateTo = async (targetTop, afterAnimate) => {
    if (isAnimating) {
      return;
    }

    isAnimating = true;
    getPageShell()?.classList.add("is-screen-animating");

    try {
      await animateScrollTo(scrollRootElement, targetTop, refresh);
      afterAnimate?.();
    } finally {
      isAnimating = false;
      getPageShell()?.classList.remove("is-screen-animating");
      normalizeLoopPosition();
      refresh();

      if (pendingLayoutRepair) {
        requestLayoutRepair();
      }
    }
  };

  const jumpToHistory = () => animateTo(historyScreenElement.offsetTop);
  const jumpToHero = () => animateTo(heroScreenElement.offsetTop);
  const jumpToLinks = () => animateTo(linksScreenElement.offsetTop);
  const jumpToLoopStart = () => animateTo(bottomLoopCloneElement.offsetTop, () => {
    teleportTo(historyScreenElement.offsetTop);
  });
  const jumpToLoopEnd = () => animateTo(topLoopCloneElement.offsetTop, () => {
    teleportTo(linksScreenElement.offsetTop);
  });

  const resetWheelAccumulation = () => {
    wheelAccumulatedDelta = 0;
    wheelAccumulatedDirection = 0;

    if (wheelAccumulatedTimerId) {
      window.clearTimeout(wheelAccumulatedTimerId);
      wheelAccumulatedTimerId = 0;
    }
  };

  const accumulateWheelDelta = (deltaY) => {
    const nextDirection = Math.sign(deltaY);

    if (!nextDirection) {
      return 0;
    }

    if (wheelAccumulatedDirection !== nextDirection) {
      wheelAccumulatedDelta = 0;
      wheelAccumulatedDirection = nextDirection;
    }

    wheelAccumulatedDelta += Math.abs(deltaY);

    if (wheelAccumulatedTimerId) {
      window.clearTimeout(wheelAccumulatedTimerId);
    }

    wheelAccumulatedTimerId = window.setTimeout(() => {
      resetWheelAccumulation();
    }, WHEEL_ACCUM_RESET_MS);

    return wheelAccumulatedDelta;
  };

  const getWheelTriggerDelta = () => {
    return isReducedMotionEnabled()
      ? WHEEL_TRIGGER_DELTA_REDUCED_MOTION
      : WHEEL_TRIGGER_DELTA;
  };

  const getWheelDirectTriggerDelta = () => {
    return isReducedMotionEnabled()
      ? WHEEL_DIRECT_TRIGGER_DELTA_REDUCED_MOTION
      : WHEEL_DIRECT_TRIGGER_DELTA;
  };

  const settleToNearestScreen = () => {
    if (
      isAnimating ||
      pointerGesture ||
      isSettingsPreviewActive() ||
      isReducedMotionEnabled()
    ) {
      return;
    }

    const historyTop = historyScreenElement.offsetTop;
    const heroTop = heroScreenElement.offsetTop;
    const linksTop = linksScreenElement.offsetTop;
    const screenTops = getScreenTops();
    const currentTop = scrollRootElement.scrollTop;
    const snapTops = isScreenLoopEnabled()
      ? [screenTops.topLoop, historyTop, heroTop, linksTop, screenTops.bottomLoop]
      : [historyTop, heroTop, linksTop];
    const nearestTop = getNearestScreenTop(currentTop, snapTops);

    if (Math.abs(currentTop - nearestTop) < 2) {
      if (isScreenLoopEnabled() && nearestTop === screenTops.topLoop) {
        teleportTo(screenTops.links);
        return;
      }

      if (isScreenLoopEnabled() && nearestTop === screenTops.bottomLoop) {
        teleportTo(screenTops.history);
        return;
      }

      teleportTo(nearestTop);
      return;
    }

    if (isScreenLoopEnabled() && nearestTop === screenTops.topLoop) {
      jumpToLoopEnd();
      return;
    }

    if (isScreenLoopEnabled() && nearestTop === screenTops.bottomLoop) {
      jumpToLoopStart();
      return;
    }

    animateTo(nearestTop);
  };

  const scheduleScrollSettle = () => {
    if (scrollSettleTimerId) {
      window.clearTimeout(scrollSettleTimerId);
    }

    scrollSettleTimerId = window.setTimeout(() => {
      scrollSettleTimerId = 0;
      settleToNearestScreen();
    }, SCROLL_SETTLE_DELAY_MS);
  };

  const snapPointerReleaseTo = (targetTop) => {
    if (scrollSettleTimerId) {
      window.clearTimeout(scrollSettleTimerId);
      scrollSettleTimerId = 0;
    }

    scrollRootElement.scrollTop = targetTop;
    refresh();

    window.requestAnimationFrame(() => {
      setScreenDragState(false);
      normalizeLoopPosition();
      refresh();
      scheduleScrollSettle();

      if (pendingLayoutRepair) {
        requestLayoutRepair();
      }
    });
  };

  const alignToHero = () => {
    scrollRootElement.scrollTop = heroScreenElement.offsetTop;
    refresh();
  };

  if (typeof ResizeObserver === "function") {
    const loopCloneResizeObserver = new ResizeObserver(() => {
      requestLayoutRepair();
    });

    loopCloneResizeObserver.observe(topLoopCloneElement);
    loopCloneResizeObserver.observe(bottomLoopCloneElement);
  }

  scrollRootElement.addEventListener("wheel", (event) => {
    const wheelTriggerDelta = getWheelTriggerDelta();
    const wheelDirectTriggerDelta = getWheelDirectTriggerDelta();

    if (isSettingsPreviewActive()) {
      event.preventDefault();
      return;
    }

    if (isAnimating) {
      event.preventDefault();
      resetWheelAccumulation();
      return;
    }

    const heroTop = heroScreenElement.offsetTop;
    const linksTop = linksScreenElement.offsetTop;
    const historyTop = historyScreenElement.offsetTop;
    const scrollTop = scrollRootElement.scrollTop;
    const nearHero = Math.abs(scrollTop - heroTop) < WHEEL_SNAP_PROXIMITY_PX;
    const nearLinksTop = Math.abs(scrollTop - linksTop) < WHEEL_SNAP_PROXIMITY_PX;
    const nearHistoryTop = Math.abs(scrollTop - historyTop) < WHEEL_SNAP_PROXIMITY_PX;
    const nearSnapPoint = nearHero || nearLinksTop || nearHistoryTop;
    const isWithinHeroDownTrigger = scrollTop < heroTop + ((linksTop - heroTop) * HERO_LOCK_THRESHOLD_RATIO);
    const isWithinHeroUpTrigger = scrollTop > heroTop - ((heroTop - historyTop) * HERO_LOCK_THRESHOLD_RATIO);
    const immediateTriggerReached = Math.abs(event.deltaY) >= wheelDirectTriggerDelta;
    const accumulatedWheelDelta = nearSnapPoint
      ? accumulateWheelDelta(event.deltaY)
      : Math.abs(event.deltaY);

    if (nearSnapPoint && !immediateTriggerReached && accumulatedWheelDelta < wheelTriggerDelta) {
      event.preventDefault();
      return;
    }

    if (event.deltaY > 0 && nearHero && isWithinHeroDownTrigger) {
      event.preventDefault();
      resetWheelAccumulation();
      jumpToLinks();
      return;
    }

    if (event.deltaY < 0 && nearHero && isWithinHeroUpTrigger) {
      event.preventDefault();
      resetWheelAccumulation();
      jumpToHistory();
      return;
    }

    if (event.deltaY < 0 && nearLinksTop) {
      event.preventDefault();
      resetWheelAccumulation();
      jumpToHero();
      return;
    }

    if (isScreenLoopEnabled() && event.deltaY > 0 && nearLinksTop) {
      event.preventDefault();
      resetWheelAccumulation();
      jumpToLoopStart();
      return;
    }

    if (isScreenLoopEnabled() && event.deltaY < 0 && nearHistoryTop && !isWithinHistoryList(event.target)) {
      event.preventDefault();
      resetWheelAccumulation();
      jumpToLoopEnd();
      return;
    }

    if (event.deltaY > 0 && nearHistoryTop && !isWithinHistoryList(event.target)) {
      event.preventDefault();
      resetWheelAccumulation();
      jumpToHero();
    }
  }, { passive: false });

  let touchStartY = 0;
  let touchStartedInHistoryList = false;

  scrollRootElement.addEventListener("touchstart", (event) => {
    touchStartY = event.touches[0]?.clientY || 0;
    touchStartedInHistoryList = isWithinHistoryList(event.target);
  }, { passive: true });

  scrollRootElement.addEventListener("touchend", (event) => {
    if (isAnimating || isSettingsPreviewActive()) {
      return;
    }

    const heroTop = heroScreenElement.offsetTop;
    const linksTop = linksScreenElement.offsetTop;
    const historyTop = historyScreenElement.offsetTop;
    const scrollTop = scrollRootElement.scrollTop;
    const touchEndY = event.changedTouches[0]?.clientY || 0;
    const deltaY = touchStartY - touchEndY;

    if (deltaY > 42 && Math.abs(scrollTop - heroTop) < 36) {
      jumpToLinks();
      return;
    }

    if (deltaY < -42 && Math.abs(scrollTop - heroTop) < 36) {
      jumpToHistory();
      return;
    }

    if (deltaY < -42 && Math.abs(scrollTop - linksTop) < 36) {
      jumpToHero();
      return;
    }

    if (isScreenLoopEnabled() && deltaY > 42 && Math.abs(scrollTop - linksTop) < 36) {
      jumpToLoopStart();
      return;
    }

    if (isScreenLoopEnabled() && deltaY < -42 && Math.abs(scrollTop - historyTop) < 36 && !touchStartedInHistoryList) {
      jumpToLoopEnd();
      return;
    }

    if (deltaY > 42 && Math.abs(scrollTop - historyTop) < 36 && !touchStartedInHistoryList) {
      jumpToHero();
    }
  }, { passive: true });

  scrollRootElement.addEventListener("touchmove", (event) => {
    if (isAnimating || isSettingsPreviewActive()) {
      event.preventDefault();
    }
  }, { passive: false });

  scrollRootElement.addEventListener("scroll", () => {
    refresh();
    scheduleScrollSettle();
  }, { passive: true });
  window.addEventListener("resize", alignToHero);

  const cancelPointerGesture = () => {
    if (!pointerGesture) {
      return;
    }

    resetGesturePreview(scrollRootElement, pointerGesture, refresh);
    pointerGesture = null;
    setSettingsDragState(false);
    setScreenDragState(false);
    requestLayoutRepair();
  };

  window.addEventListener("blur", cancelPointerGesture);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelPointerGesture();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (
      isAnimating ||
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      (!isSettingsPreviewActive() && !isPointerGestureTargetAllowed(event.target))
    ) {
      return;
    }

    pointerGesture = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startX: event.clientX,
      startScrollTop: scrollRootElement.scrollTop,
      direction: "",
      previewScrollTop: scrollRootElement.scrollTop,
      startedFromSettingsPreview: isSettingsPreviewActive(),
      lastMoveY: event.clientY,
      lastMoveAt: performance.now(),
      releaseVelocityY: 0,
    };

    if (pointerGesture.startedFromSettingsPreview) {
      setScreenDragState(false);
      setSettingsDragState(true);
      getPageShell()?.classList.add("is-settings-preview");
    }
  });

  document.addEventListener("pointermove", (event) => {
    if (
      !pointerGesture ||
      pointerGesture.pointerId !== event.pointerId ||
      pointerGesture.hasTriggered ||
      isAnimating
    ) {
      return;
    }

    const heroTop = heroScreenElement.offsetTop;
    const linksTop = linksScreenElement.offsetTop;
    const historyTop = historyScreenElement.offsetTop;
    const scrollTop = pointerGesture.startScrollTop;
    const deltaY = event.clientY - pointerGesture.startY;
    const deltaX = event.clientX - pointerGesture.startX;
    const nearHero = Math.abs(scrollTop - heroTop) < 36;
    const nearLinksTop = Math.abs(scrollTop - linksTop) < 36;
    const nearHistoryTop = Math.abs(scrollTop - historyTop) < 36;
    const pageShell = getPageShell();
    const now = performance.now();
    const elapsedSinceLastMove = Math.max(now - pointerGesture.lastMoveAt, 1);
    pointerGesture.releaseVelocityY = (event.clientY - pointerGesture.lastMoveY) / elapsedSinceLastMove;
    pointerGesture.lastMoveY = event.clientY;
    pointerGesture.lastMoveAt = now;

    if (pointerGesture.startedFromSettingsPreview) {
      if (isReducedMotionEnabled()) {
        return;
      }
      const settingsProgress = clamp(1 - (deltaX / POINTER_SETTINGS_PREVIEW_MAX), 0, 1);
      document.documentElement.style.setProperty("--settings-progress", settingsProgress.toFixed(4));
      setSettingsDragState(true);
      pageShell?.classList.add("is-settings-preview");
      return;
    }

    if (!pointerGesture.direction) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (
        absX >= POINTER_DIRECTION_LOCK_DELTA &&
        absX > absY * POINTER_DIRECTION_DOMINANCE_RATIO &&
        deltaX < 0
      ) {
        pointerGesture.direction = "settings";
        setScreenDragState(false);
        setSettingsDragState(true);
        pageShell?.classList.add("is-settings-preview");
      } else if (
        absY >= POINTER_DIRECTION_LOCK_DELTA &&
        absY > absX * POINTER_DIRECTION_DOMINANCE_RATIO
      ) {
        pointerGesture.direction = "vertical";
        setScreenDragState(true);
      } else {
        return;
      }
    }

    if (pointerGesture.direction === "settings") {
      setScreenDragState(false);
      if (isReducedMotionEnabled()) {
        return;
      }
      const settingsProgress = clamp((-deltaX) / POINTER_SETTINGS_PREVIEW_MAX, 0, 1);
      document.documentElement.style.setProperty("--settings-progress", settingsProgress.toFixed(4));
      setSettingsDragState(true);
      pageShell?.classList.add("is-settings-preview");
      return;
    }

    const screenTops = getScreenTops();
    let minScrollTop = historyTop;
    let maxScrollTop = linksTop;

    if (isScreenLoopEnabled() && nearHistoryTop) {
      minScrollTop = screenTops.topLoop;
      maxScrollTop = heroTop;
    } else if (isScreenLoopEnabled() && nearLinksTop) {
      minScrollTop = heroTop;
      maxScrollTop = screenTops.bottomLoop;
    }

    if (isReducedMotionEnabled()) {
      pointerGesture.previewScrollTop = scrollRootElement.scrollTop;
      return;
    }
    const previewScrollTop = clamp(
      pointerGesture.startScrollTop - deltaY,
      minScrollTop,
      maxScrollTop
    );

    pointerGesture.previewScrollTop = previewScrollTop;
    scrollRootElement.scrollTop = previewScrollTop;
    refresh();

    if (Math.abs(deltaY) < POINTER_SWIPE_TRIGGER_DELTA) {
      return;
    }

    if (deltaY < 0 && nearHero) {
      return;
    }

    if (deltaY > 0 && nearHero) {
      return;
    }

    if (deltaY > 0 && nearLinksTop) {
      return;
    }

    if (deltaY < 0 && nearHistoryTop) {
      return;
    }
  });

  document.addEventListener("pointerup", (event) => {
    if (pointerGesture?.pointerId === event.pointerId) {
      const heroTop = heroScreenElement.offsetTop;
      const linksTop = linksScreenElement.offsetTop;
      const historyTop = historyScreenElement.offsetTop;
      const scrollTop = pointerGesture.startScrollTop;
      const releasedScrollTop = Number.isFinite(pointerGesture.previewScrollTop)
        ? pointerGesture.previewScrollTop
        : scrollRootElement.scrollTop;
      const deltaY = event.clientY - pointerGesture.startY;
      const deltaX = event.clientX - pointerGesture.startX;
      const nearHero = Math.abs(scrollTop - heroTop) < 36;
      const nearLinksTop = Math.abs(scrollTop - linksTop) < 36;
      const nearHistoryTop = Math.abs(scrollTop - historyTop) < 36;
      const isFlickSwipe = Math.abs(pointerGesture.releaseVelocityY) >= POINTER_FLICK_VELOCITY_THRESHOLD;

      if (pointerGesture.direction === "settings") {
        const shouldOpenSettings = deltaX <= -POINTER_SETTINGS_TRIGGER_DELTA;
        document.documentElement.style.setProperty("--settings-progress", shouldOpenSettings ? "1" : "0");
        getPageShell()?.classList.toggle("is-settings-preview", shouldOpenSettings);
        setSettingsDragState(false);
        setScreenDragState(false);
      } else if (pointerGesture.startedFromSettingsPreview) {
        const shouldStayOpen = deltaX < POINTER_SETTINGS_TRIGGER_DELTA;
        document.documentElement.style.setProperty("--settings-progress", shouldStayOpen ? "1" : "0");
        getPageShell()?.classList.toggle("is-settings-preview", shouldStayOpen);
        setSettingsDragState(false);
        setScreenDragState(false);
      } else {
        const shouldConsiderSwitch = Math.abs(deltaY) >= POINTER_SWIPE_TRIGGER_DELTA;
        const nearestTop = getNearestScreenTop(releasedScrollTop, [historyTop, heroTop, linksTop]);
        const flickTargetTop = (() => {
          if (!isFlickSwipe) {
            return scrollTop;
          }

          if (nearHero && pointerGesture.releaseVelocityY < 0) {
            return linksTop;
          }

          if (nearHero && pointerGesture.releaseVelocityY > 0) {
            return historyTop;
          }

          if (nearLinksTop && pointerGesture.releaseVelocityY > 0) {
            return heroTop;
          }

          if (nearHistoryTop && pointerGesture.releaseVelocityY < 0) {
            return heroTop;
          }

          if (isScreenLoopEnabled() && nearLinksTop && pointerGesture.releaseVelocityY < 0) {
            return historyTop;
          }

          if (isScreenLoopEnabled() && nearHistoryTop && pointerGesture.releaseVelocityY > 0) {
            return linksTop;
          }

          return scrollTop;
        })();
        const loopDragTargetTop = (() => {
          if (!isScreenLoopEnabled() || !shouldConsiderSwitch) {
            return scrollTop;
          }

          if (nearLinksTop && deltaY < -POINTER_SWIPE_TRIGGER_DELTA) {
            return historyTop;
          }

          if (nearHistoryTop && deltaY > POINTER_SWIPE_TRIGGER_DELTA) {
            return linksTop;
          }

          return scrollTop;
        })();
        const finalTargetTop = flickTargetTop !== scrollTop
          ? flickTargetTop
          : loopDragTargetTop !== scrollTop
            ? loopDragTargetTop
            : nearestTop;
        const shouldSnapBack = (!shouldConsiderSwitch && !isFlickSwipe) || finalTargetTop === scrollTop;

        if (shouldSnapBack) {
          snapPointerReleaseTo(scrollTop);
        } else {
          snapPointerReleaseTo(finalTargetTop);
        }
      }

      pointerGesture = null;
    }
  });

  document.addEventListener("pointercancel", (event) => {
    if (pointerGesture?.pointerId === event.pointerId) {
      cancelPointerGesture();
    }
  });

  alignToHero();
}

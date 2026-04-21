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

function isReducedMotionEnabled() {
  return document.body.classList.contains("is-reduced-motion");
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

function isSettingsPreviewActive() {
  return getPageShell()?.classList.contains("is-settings-preview") || false;
}

function setSettingsDragState(isDragging) {
  getPageShell()?.classList.toggle("is-settings-dragging", isDragging);
}

function resetGesturePreview(scrollRootElement, pointerGesture, refresh) {
  if (!pointerGesture) {
    return;
  }

  if (isReducedMotionEnabled()) {
    setSettingsDragState(false);
    return;
  }

  scrollRootElement.scrollTop = pointerGesture.startScrollTop;
  document.documentElement.style.setProperty("--settings-progress", "0");
  getPageShell()?.classList.remove("is-settings-preview");
  setSettingsDragState(false);
  refresh();
}

function syncScrollVisualState(scrollRootElement, historyScreenElement, heroScreenElement, linksScreenElement) {
  const heroTop = heroScreenElement?.offsetTop || 0;
  const linksTop = linksScreenElement?.offsetTop || window.innerHeight;
  const historyTop = historyScreenElement?.offsetTop || 0;
  const scrollTop = scrollRootElement.scrollTop;
  const forwardProgress = clamp((scrollTop - heroTop) / Math.max(linksTop - heroTop, 1), 0, 1);
  const backwardProgress = clamp((heroTop - scrollTop) / Math.max(heroTop - historyTop, 1), 0, 1);
  const isLinksView = scrollTop > heroTop + ((linksTop - heroTop) * LINKS_VIEW_THRESHOLD_RATIO);
  const isHistoryView = scrollTop < heroTop - ((heroTop - historyTop) * HISTORY_VIEW_THRESHOLD_RATIO);
  const pageShell = getPageShell();
  const scrimProgress = Math.max(forwardProgress, backwardProgress);

  document.documentElement.style.setProperty("--screen-progress", forwardProgress.toFixed(4));
  document.documentElement.style.setProperty("--history-progress", backwardProgress.toFixed(4));
  document.documentElement.style.setProperty("--view-scrim-progress", scrimProgress.toFixed(4));
  pageShell?.classList.toggle("is-links-view", isLinksView);
  pageShell?.classList.toggle("is-history-view", isHistoryView);
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
    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = clamp(elapsed / TRANSITION_DURATION_MS, 0, 1);
      const easedProgress = easeOutCubic(progress);

      scrollRootElement.scrollTop = startTop + (distance * easedProgress);
      onFrame();

      if (progress < 1) {
        window.requestAnimationFrame(tick);
        return;
      }

      resolve();
    };

    window.requestAnimationFrame(tick);
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

  let isAnimating = false;
  let pointerGesture = null;
  let scrollSettleTimerId = 0;
  let wheelAccumulatedDelta = 0;
  let wheelAccumulatedDirection = 0;
  let wheelAccumulatedTimerId = 0;

  const refresh = () => {
    syncScrollVisualState(
      scrollRootElement,
      historyScreenElement,
      heroScreenElement,
      linksScreenElement
    );
  };

  const animateTo = async (targetTop) => {
    if (isAnimating) {
      return;
    }

    isAnimating = true;
    getPageShell()?.classList.add("is-screen-animating");

    try {
      await animateScrollTo(scrollRootElement, targetTop, refresh);
    } finally {
      isAnimating = false;
      getPageShell()?.classList.remove("is-screen-animating");
      refresh();
    }
  };

  const jumpToHistory = () => animateTo(historyScreenElement.offsetTop);
  const jumpToHero = () => animateTo(heroScreenElement.offsetTop);
  const jumpToLinks = () => animateTo(linksScreenElement.offsetTop);

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
    const currentTop = scrollRootElement.scrollTop;
    const nearestTop = getNearestScreenTop(currentTop, [historyTop, heroTop, linksTop]);

    if (Math.abs(currentTop - nearestTop) < 2) {
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

  const alignToHero = () => {
    scrollRootElement.scrollTop = heroScreenElement.offsetTop;
    refresh();
  };

  scrollRootElement.addEventListener("wheel", (event) => {
    const wheelTriggerDelta = getWheelTriggerDelta();
    const wheelDirectTriggerDelta = getWheelDirectTriggerDelta();

    if (isSettingsPreviewActive()) {
      event.preventDefault();
      return;
    }

    if (isAnimating) {
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

    if (deltaY > 42 && Math.abs(scrollTop - historyTop) < 36 && !touchStartedInHistoryList) {
      jumpToHero();
    }
  }, { passive: true });

  scrollRootElement.addEventListener("scroll", () => {
    refresh();
    scheduleScrollSettle();
  }, { passive: true });
  window.addEventListener("resize", alignToHero);

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
        setSettingsDragState(true);
        pageShell?.classList.add("is-settings-preview");
      } else if (
        absY >= POINTER_DIRECTION_LOCK_DELTA &&
        absY > absX * POINTER_DIRECTION_DOMINANCE_RATIO
      ) {
        pointerGesture.direction = "vertical";
      } else {
        return;
      }
    }

    if (pointerGesture.direction === "settings") {
      if (isReducedMotionEnabled()) {
        return;
      }
      const settingsProgress = clamp((-deltaX) / POINTER_SETTINGS_PREVIEW_MAX, 0, 1);
      document.documentElement.style.setProperty("--settings-progress", settingsProgress.toFixed(4));
      setSettingsDragState(true);
      pageShell?.classList.add("is-settings-preview");
      return;
    }

    const minScrollTop = historyScreenElement.offsetTop;
    const maxScrollTop = linksScreenElement.offsetTop;
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
      } else if (pointerGesture.startedFromSettingsPreview) {
        const shouldStayOpen = deltaX < POINTER_SETTINGS_TRIGGER_DELTA;
        document.documentElement.style.setProperty("--settings-progress", shouldStayOpen ? "1" : "0");
        getPageShell()?.classList.toggle("is-settings-preview", shouldStayOpen);
        setSettingsDragState(false);
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

          return scrollTop;
        })();
        const finalTargetTop = flickTargetTop !== scrollTop ? flickTargetTop : nearestTop;

        if ((!shouldConsiderSwitch && !isFlickSwipe) || finalTargetTop === scrollTop) {
          resetGesturePreview(scrollRootElement, pointerGesture, refresh);
        } else if (nearHero && finalTargetTop === linksTop) {
          jumpToLinks();
        } else if (nearHero && finalTargetTop === historyTop) {
          jumpToHistory();
        } else if (nearLinksTop && finalTargetTop === heroTop) {
          jumpToHero();
        } else if (nearHistoryTop && finalTargetTop === heroTop) {
          jumpToHero();
        } else {
          resetGesturePreview(scrollRootElement, pointerGesture, refresh);
        }
      }

      pointerGesture = null;
    }
  });

  document.addEventListener("pointercancel", (event) => {
    if (pointerGesture?.pointerId === event.pointerId) {
      resetGesturePreview(scrollRootElement, pointerGesture, refresh);
      pointerGesture = null;
      setSettingsDragState(false);
    }
  });

  alignToHero();
}

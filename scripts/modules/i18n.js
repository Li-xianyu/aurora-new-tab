const LANGUAGE_STORAGE_KEY = "uiLanguage";
const DEFAULT_LANGUAGE = "zh-CN";

const dictionaries = {
  "zh-CN": {
    pageTitle: "New Tab",
    settingsTitle: "工作台设置",
    settingsTabsAria: "设置分类",
    settingsSectionGeneral: "通用",
    settingsSectionQuickLinks: "快捷链接",
    settingsSectionBackground: "背景图设置",
    settingsLanguageLabel: "语言",
    settingsWeatherLabel: "天气模块",
    settingsReducedMotionLabel: "全局动态效果减弱",
    settingsFrequentLinksVisibleLabel: "首页常用快捷显示",
    settingsFrequentLinksVisibleAria: "首页常用快捷显示",
    settingsQuickLinksOpenModeLabel: "点击快捷链接时",
    settingsQuickLinksOpenModeAria: "快捷链接打开方式",
    settingsQuickLinksOpenModeCurrent: "本页跳转",
    settingsQuickLinksOpenModeNewTab: "新开标签页",
    settingsBackgroundSourceLabel: "背景来源",
    settingsBackgroundSourceAria: "背景图来源",
    settingsBackgroundSourceLocal: "本地图片",
    settingsBackgroundSourceBing: "Bing 每日一图",
    settingsBackgroundClearLabel: "清除本地图片缓存",
    settingsBackgroundClearAction: "清除",
    settingsDropBackgroundHint: "支持拖放图片文件以设置页面背景",
    settingsOptionOn: "开启",
    settingsOptionOff: "关闭",
    weatherAria: "当前天气",
    weatherRefreshAria: "刷新天气",
    weatherLocating: "定位中",
    weatherLoading: "天气加载中...",
    weatherCurrentLocation: "当前位置",
    weatherUnknown: "未知天气",
    weatherFeelsLike: "体感",
    weatherHumidity: "湿度",
    weatherWind: "风速",
    weatherUpdated: "更新于",
    weatherUnitSpeed: "km/h",
    weatherUpdatedFallback: "--",
    weatherJustNow: "刚刚",
    weatherMinuteAgo: "{count} 分钟前",
    weatherMinutesAgo: "{count} 分钟前",
    weatherHourAgo: "{count} 小时前",
    weatherHoursAgo: "{count} 小时前",
    weatherDayAgo: "{count} 天前",
    weatherDaysAgo: "{count} 天前",
    historyScreenAria: "浏览历史",
    historyTitle: "浏览记录",
    historyFiltersAria: "历史筛选",
    historyTabAll: "全部",
    historyTabToday: "今天",
    historyTabYesterday: "昨天",
    historyTabSearch: "查找",
    historySearchPlaceholder: "搜索标题或域名",
    historyTimeFiltersAria: "时间筛选",
    historyRangeAll: "全部时间",
    historyRangeToday: "今天",
    historyRangeYesterday: "昨天",
    historyRange7d: "7 天内",
    historyRange30d: "30 天内",
    historyRange90d: "90 天内",
    historyLoadingMore: "加载更多中...",
    historyEmptySearch: "没有找到匹配的历史记录。",
    historyEmptyDefault: "暂时没有可用的历史记录。",
    historyUnavailable: "暂时无法读取历史记录。",
    historyRecently: "刚刚",
    historyMinuteAgo: "{count} 分钟前",
    historyMinutesAgo: "{count} 分钟前",
    historyHourAgo: "{count} 小时前",
    historyHoursAgo: "{count} 小时前",
    historyDayAgo: "{count} 天前",
    historyDaysAgo: "{count} 天前",
    historyWeekAgo: "{count} 周前",
    historyWeeksAgo: "{count} 周前",
    heroAria: "搜索区域",
    clockAria: "当前时间",
    searchAria: "搜索",
    searchLabel: "搜索",
    searchTrigger: "搜索",
    searchPlaceholder: "输入后按回车",
    searchSuggestionsAria: "搜索建议",
    frequentLinksAria: "常用快捷标签",
    linksScreenAria: "快捷标签",
    linksTitle: "快捷标签",
    bookmarkDefaultGroup: "未分组",
    bookmarkDelete: "删除",
    saveDialogTitle: "保存页面",
    saveDialogSubtitle: "修改标题、链接和分组，然后保存这个快捷标签。",
    saveDialogFieldTitle: "标题",
    saveDialogFieldLink: "链接",
    saveDialogFieldGroup: "分组",
    saveDialogTitlePlaceholder: "输入标题",
    saveDialogLinkPlaceholder: "https://example.com",
    saveDialogCreateGroup: "新建分组",
    saveDialogNewGroupTip: "给这个快捷标签新建一个分组。",
    saveDialogNewGroupPlaceholder: "输入分组名称",
    saveDialogAddGroup: "确定",
    saveDialogCancel: "取消",
    saveDialogSave: "保存",
    saveDialogSaving: "保存中...",
    saveDialogSavedTo: "已保存到 {group}。",
    saveDialogLoadFailed: "加载保存面板失败。",
    saveDialogSaveFailed: "保存快捷标签失败。",
    saveDialogEmptyGroupName: "请输入有效的分组名称。",
    saveDialogDeleteGroup: "删除分组 {group}",
    saveDialogConfirmDeleteGroup: "确认删除分组 {group}",
    saveDialogDeleteGroupHint: "再次点击 删除 {group}，组内内容会移动到未分组。",
    saveDialogDeletingGroup: "正在删除分组...",
    saveDialogDeletedGroup: "已删除分组 {group}。",
    saveDialogDeleteGroupFailed: "删除分组失败。",
  },
  en: {
    pageTitle: "New Tab",
    settingsTitle: "Workspace Settings",
    settingsTabsAria: "Settings sections",
    settingsSectionGeneral: "General",
    settingsSectionQuickLinks: "Quick Links",
    settingsSectionBackground: "Background",
    settingsLanguageLabel: "Language",
    settingsWeatherLabel: "Weather widget",
    settingsReducedMotionLabel: "Reduce global motion",
    settingsFrequentLinksVisibleLabel: "Show frequent links on home",
    settingsFrequentLinksVisibleAria: "Frequent links visibility",
    settingsQuickLinksOpenModeLabel: "Open quick links",
    settingsQuickLinksOpenModeAria: "Quick link open mode",
    settingsQuickLinksOpenModeCurrent: "Current Tab",
    settingsQuickLinksOpenModeNewTab: "New Tab",
    settingsBackgroundSourceLabel: "Background source",
    settingsBackgroundSourceAria: "Background source",
    settingsBackgroundSourceLocal: "Local Image",
    settingsBackgroundSourceBing: "Bing Daily",
    settingsBackgroundClearLabel: "Clear local image cache",
    settingsBackgroundClearAction: "Clear",
    settingsDropBackgroundHint: "Drag and drop an image file to set the page background",
    settingsOptionOn: "On",
    settingsOptionOff: "Off",
    weatherAria: "Current weather",
    weatherRefreshAria: "Refresh weather",
    weatherLocating: "Locating",
    weatherLoading: "Loading weather...",
    weatherCurrentLocation: "Current Location",
    weatherUnknown: "Unknown",
    weatherFeelsLike: "Feels like",
    weatherHumidity: "Humidity",
    weatherWind: "Wind",
    weatherUpdated: "Updated",
    weatherUnitSpeed: "km/h",
    weatherUpdatedFallback: "--",
    weatherJustNow: "Just now",
    weatherMinuteAgo: "{count} min ago",
    weatherMinutesAgo: "{count} mins ago",
    weatherHourAgo: "{count} hr ago",
    weatherHoursAgo: "{count} hrs ago",
    weatherDayAgo: "{count} day ago",
    weatherDaysAgo: "{count} days ago",
    historyScreenAria: "Browsing history",
    historyTitle: "Recent History",
    historyFiltersAria: "History filters",
    historyTabAll: "All",
    historyTabToday: "Today",
    historyTabYesterday: "Yesterday",
    historyTabSearch: "Find",
    historySearchPlaceholder: "Search title or domain",
    historyTimeFiltersAria: "History time filters",
    historyRangeAll: "All time",
    historyRangeToday: "Today",
    historyRangeYesterday: "Yesterday",
    historyRange7d: "Past 7 days",
    historyRange30d: "Past 30 days",
    historyRange90d: "Past 90 days",
    historyLoadingMore: "Loading more...",
    historyEmptySearch: "No matching history items found.",
    historyEmptyDefault: "No browser history is available yet.",
    historyUnavailable: "History is unavailable right now.",
    historyRecently: "Recently",
    historyMinuteAgo: "{count} min ago",
    historyMinutesAgo: "{count} mins ago",
    historyHourAgo: "{count} hr ago",
    historyHoursAgo: "{count} hrs ago",
    historyDayAgo: "{count} day ago",
    historyDaysAgo: "{count} days ago",
    historyWeekAgo: "{count} wk ago",
    historyWeeksAgo: "{count} wks ago",
    heroAria: "Search area",
    clockAria: "Current time",
    searchAria: "Search",
    searchLabel: "Search",
    searchTrigger: "Search",
    searchPlaceholder: "Type and press Enter",
    searchSuggestionsAria: "Search suggestions",
    frequentLinksAria: "Frequently used quick tags",
    linksScreenAria: "Quick tags",
    linksTitle: "Quick Tags",
    bookmarkDefaultGroup: "Ungrouped",
    bookmarkDelete: "Delete",
    saveDialogTitle: "Save Page",
    saveDialogSubtitle: "Edit the title, link, and group before saving this shortcut.",
    saveDialogFieldTitle: "Title",
    saveDialogFieldLink: "Link",
    saveDialogFieldGroup: "Group",
    saveDialogTitlePlaceholder: "Enter a title",
    saveDialogLinkPlaceholder: "https://example.com",
    saveDialogCreateGroup: "Create group",
    saveDialogNewGroupTip: "Create a new group for this shortcut.",
    saveDialogNewGroupPlaceholder: "Enter group name",
    saveDialogAddGroup: "Add",
    saveDialogCancel: "Cancel",
    saveDialogSave: "Save",
    saveDialogSaving: "Saving...",
    saveDialogSavedTo: "Saved to {group}.",
    saveDialogLoadFailed: "Failed to load the save panel.",
    saveDialogSaveFailed: "Failed to save the shortcut.",
    saveDialogEmptyGroupName: "Please enter a valid group name.",
    saveDialogDeleteGroup: "Delete group {group}",
    saveDialogConfirmDeleteGroup: "Confirm delete group {group}",
    saveDialogDeleteGroupHint: "Click Delete again to delete {group}. Its links will move to Ungrouped.",
    saveDialogDeletingGroup: "Deleting group...",
    saveDialogDeletedGroup: "Deleted group {group}.",
    saveDialogDeleteGroupFailed: "Failed to delete the group.",
  },
};

let currentLanguage = DEFAULT_LANGUAGE;
const subscribers = new Set();

function normalizeLanguage(value) {
  return value === "en" ? "en" : DEFAULT_LANGUAGE;
}

function interpolate(template, params = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ""));
}

export function t(key, params = {}) {
  const dictionary = dictionaries[currentLanguage] || dictionaries[DEFAULT_LANGUAGE];
  const fallback = dictionaries[DEFAULT_LANGUAGE];
  return interpolate(dictionary[key] ?? fallback[key] ?? key, params);
}

export function getCurrentLanguage() {
  return currentLanguage;
}

export async function initializeI18n() {
  const result = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
  currentLanguage = normalizeLanguage(result[LANGUAGE_STORAGE_KEY]);
  document.documentElement.lang = currentLanguage === "en" ? "en" : "zh-CN";
  return currentLanguage;
}

export async function setLanguage(language) {
  const nextLanguage = normalizeLanguage(language);

  if (nextLanguage === currentLanguage) {
    return currentLanguage;
  }

  currentLanguage = nextLanguage;
  document.documentElement.lang = currentLanguage === "en" ? "en" : "zh-CN";
  await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: currentLanguage });

  subscribers.forEach((subscriber) => {
    try {
      subscriber(currentLanguage);
    } catch (error) {
      console.error("Failed to notify language change:", error);
    }
  });

  return currentLanguage;
}

export function subscribeLanguageChange(callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function translateWeatherCode(code) {
  const map = {
    0: { "zh-CN": "晴朗", en: "Clear" },
    1: { "zh-CN": "大部晴朗", en: "Mostly clear" },
    2: { "zh-CN": "多云", en: "Partly cloudy" },
    3: { "zh-CN": "阴天", en: "Overcast" },
    45: { "zh-CN": "雾", en: "Fog" },
    48: { "zh-CN": "雾凇", en: "Rime fog" },
    51: { "zh-CN": "小毛毛雨", en: "Light drizzle" },
    53: { "zh-CN": "毛毛雨", en: "Drizzle" },
    55: { "zh-CN": "强毛毛雨", en: "Dense drizzle" },
    61: { "zh-CN": "小雨", en: "Light rain" },
    63: { "zh-CN": "中雨", en: "Rain" },
    65: { "zh-CN": "大雨", en: "Heavy rain" },
    71: { "zh-CN": "小雪", en: "Light snow" },
    73: { "zh-CN": "中雪", en: "Snow" },
    75: { "zh-CN": "大雪", en: "Heavy snow" },
    77: { "zh-CN": "雪粒", en: "Snow grains" },
    80: { "zh-CN": "阵雨", en: "Showers" },
    81: { "zh-CN": "强阵雨", en: "Heavy showers" },
    82: { "zh-CN": "暴雨", en: "Violent rain" },
    95: { "zh-CN": "雷阵雨", en: "Thunderstorm" },
    96: { "zh-CN": "雷雨夹冰雹", en: "Storm with hail" },
    99: { "zh-CN": "强雷暴", en: "Severe storm" },
  };

  return map[code]?.[currentLanguage] || t("weatherUnknown");
}

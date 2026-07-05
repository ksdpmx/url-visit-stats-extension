const DEFAULT_SETTINGS = {
  stripHash: true,
  stripTrailingSlash: true,
  stripTrackingParams: true,
  trackingParams: [
    "fbclid",
    "gclid",
    "igshid",
    "mc_cid",
    "mc_eid",
    "msclkid",
    "utm_campaign",
    "utm_content",
    "utm_medium",
    "utm_source",
    "utm_term"
  ],
  keepRecentLimit: 200
};

const STATS_KEY = "stats";
const SETTINGS_KEY = "settings";
const READ_KEY = "readUrls";
const BADGE_TEXT = "\u2713";
const BADGE_BG_COLOR = "#1a7f37";
const BADGE_TEXT_COLOR = "#ffffff";
let writeQueue = Promise.resolve();

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    updateBadgeForTab(tabId, changeInfo.url || tab?.url).catch((error) =>
      console.error("URL Visit Stats: failed to update badge", error)
    );
  }

  if (changeInfo.status !== "complete" || !tab?.url) {
    return;
  }

  writeQueue = writeQueue
    .then(() => recordVisit(tab.url, tab.title || "", Date.now()))
    .catch((error) => console.error("URL Visit Stats: failed to record visit", error));
});

browser.tabs.onActivated.addListener(({ tabId }) => {
  browser.tabs
    .get(tabId)
    .then((tab) => updateBadgeForTab(tabId, tab?.url))
    .catch((error) => console.error("URL Visit Stats: failed to update badge", error));
});

refreshActiveTabBadge().catch((error) =>
  console.error("URL Visit Stats: failed to init badge", error)
);

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "getStatsForUrl") {
    return getStatsForUrl(message.url);
  }

  if (message?.type === "getTopUrls") {
    return getTopUrls(message.limit || 25);
  }

  if (message?.type === "exportStats") {
    return exportStats();
  }

  if (message?.type === "clearStats") {
    return clearStats();
  }

  if (message?.type === "getSettings") {
    return getSettings();
  }

  if (message?.type === "saveSettings") {
    return saveSettings(message.settings || {});
  }

  if (message?.type === "getReadState") {
    return isUrlRead(message.url).then((read) => ({ read }));
  }

  if (message?.type === "toggleRead") {
    return toggleRead(message.url, message.title || "");
  }

  return false;
});

async function recordVisit(rawUrl, title, visitedAt) {
  const normalized = await normalizeUrl(rawUrl);
  if (!normalized) {
    return;
  }

  const host = hostKey(rawUrl);
  const { stats: storedStats = emptyStats() } = await browser.storage.local.get(STATS_KEY);
  const stats = normalizeStatsShape(storedStats);
  const now = Date.now();

  const exactEntry = stats.exactUrls[rawUrl] || {
    count: 0,
    firstVisitAt: visitedAt,
    lastVisitAt: 0,
    title: "",
    rawUrl
  };
  exactEntry.count += 1;
  exactEntry.lastVisitAt = visitedAt || now;
  exactEntry.title = title || exactEntry.title;
  stats.exactUrls[rawUrl] = exactEntry;

  const urlEntry = stats.urls[normalized] || {
    count: 0,
    firstVisitAt: visitedAt,
    lastVisitAt: 0,
    title: "",
    rawUrl
  };
  urlEntry.count += 1;
  urlEntry.lastVisitAt = visitedAt || now;
  urlEntry.title = title || urlEntry.title;
  urlEntry.rawUrl = rawUrl || urlEntry.rawUrl;
  stats.urls[normalized] = urlEntry;

  if (host) {
    const hostEntry = stats.hosts[host] || {
      count: 0,
      firstVisitAt: visitedAt,
      lastVisitAt: 0
    };
    hostEntry.count += 1;
    hostEntry.lastVisitAt = visitedAt || now;
    stats.hosts[host] = hostEntry;
  }

  stats.recent = [
    {
      url: rawUrl,
      normalized,
      host,
      title,
      visitedAt: visitedAt || now
    },
    ...(stats.recent || [])
  ].slice(0, (await getSettings()).keepRecentLimit);
  stats.updatedAt = now;

  await browser.storage.local.set({ [STATS_KEY]: stats });
}

async function getStatsForUrl(rawUrl) {
  const normalized = await normalizeUrl(rawUrl);
  const host = hostKey(rawUrl);
  const { stats: storedStats = emptyStats() } = await browser.storage.local.get(STATS_KEY);
  const stats = normalizeStatsShape(storedStats);
  const exactEntry = stats.exactUrls?.[rawUrl] || null;
  const urlEntry = normalized ? stats.urls[normalized] : null;
  const hostEntry = host ? stats.hosts[host] : null;

  return {
    rawUrl,
    normalized,
    host,
    localExactCount: exactEntry?.count || 0,
    localNormalizedCount: urlEntry?.count || 0,
    localHostCount: hostEntry?.count || 0,
    firstVisitAt: exactEntry?.firstVisitAt || urlEntry?.firstVisitAt || null,
    lastVisitAt: exactEntry?.lastVisitAt || urlEntry?.lastVisitAt || null,
    title: exactEntry?.title || urlEntry?.title || ""
  };
}

async function getTopUrls(limit) {
  const { stats: storedStats = emptyStats() } = await browser.storage.local.get(STATS_KEY);
  const stats = normalizeStatsShape(storedStats);
  const urls = Object.entries(stats.urls)
    .map(([url, entry]) => ({ url, ...entry }))
    .sort((a, b) => b.count - a.count || b.lastVisitAt - a.lastVisitAt)
    .slice(0, limit);

  const hosts = Object.entries(stats.hosts)
    .map(([host, entry]) => ({ host, ...entry }))
    .sort((a, b) => b.count - a.count || b.lastVisitAt - a.lastVisitAt)
    .slice(0, limit);

  return {
    urls,
    hosts,
    recent: (stats.recent || []).slice(0, limit),
    updatedAt: stats.updatedAt || null
  };
}

async function exportStats() {
  const { stats = emptyStats() } = await browser.storage.local.get(STATS_KEY);
  const settings = await getSettings();
  const readUrls = await getReadMap();
  return {
    exportedAt: new Date().toISOString(),
    settings,
    stats,
    readUrls
  };
}

async function clearStats() {
  await browser.storage.local.set({ [STATS_KEY]: emptyStats() });
  return { ok: true };
}

async function getSettings() {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(result[SETTINGS_KEY] || {})
  };
}

async function saveSettings(settings) {
  const merged = {
    ...DEFAULT_SETTINGS,
    ...settings,
    trackingParams: parseTrackingParams(settings.trackingParams || DEFAULT_SETTINGS.trackingParams),
    keepRecentLimit: clampNumber(settings.keepRecentLimit, 25, 2000, DEFAULT_SETTINGS.keepRecentLimit)
  };

  await browser.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

async function getReadMap() {
  const { [READ_KEY]: readUrls = {} } = await browser.storage.local.get(READ_KEY);
  return readUrls && typeof readUrls === "object" ? readUrls : {};
}

async function isUrlRead(rawUrl) {
  const normalized = await normalizeUrl(rawUrl);
  if (!normalized) {
    return false;
  }

  const readMap = await getReadMap();
  return Boolean(readMap[normalized]);
}

async function toggleRead(rawUrl, title) {
  const normalized = await normalizeUrl(rawUrl);
  if (!normalized) {
    return { read: false, supported: false };
  }

  const readMap = await getReadMap();
  let read;
  if (readMap[normalized]) {
    delete readMap[normalized];
    read = false;
  } else {
    readMap[normalized] = { markedAt: Date.now(), rawUrl, title: title || "" };
    read = true;
  }

  await browser.storage.local.set({ [READ_KEY]: readMap });
  await refreshActiveTabBadge();
  return { read, supported: true };
}

async function updateBadgeForTab(tabId, rawUrl) {
  if (typeof tabId !== "number") {
    return;
  }

  const read = rawUrl ? await isUrlRead(rawUrl) : false;
  await browser.browserAction.setBadgeText({ tabId, text: read ? BADGE_TEXT : "" });

  if (read) {
    await browser.browserAction.setBadgeBackgroundColor({ tabId, color: BADGE_BG_COLOR });
    if (browser.browserAction.setBadgeTextColor) {
      await browser.browserAction.setBadgeTextColor({ tabId, color: BADGE_TEXT_COLOR });
    }
  }
}

async function refreshActiveTabBadge() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await updateBadgeForTab(tab.id, tab.url);
  }
}

async function normalizeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  const settings = await getSettings();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (settings.stripHash) {
    parsed.hash = "";
  }

  if (settings.stripTrackingParams) {
    const trackingParams = new Set(parseTrackingParams(settings.trackingParams));
    for (const key of [...parsed.searchParams.keys()]) {
      if (trackingParams.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
  }

  parsed.searchParams.sort();

  if (settings.stripTrailingSlash && parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

function hostKey(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

function emptyStats() {
  return {
    exactUrls: {},
    urls: {},
    hosts: {},
    recent: [],
    updatedAt: null
  };
}

function normalizeStatsShape(stats) {
  return {
    ...emptyStats(),
    ...(stats || {}),
    exactUrls: stats?.exactUrls || {},
    urls: stats?.urls || {},
    hosts: stats?.hosts || {},
    recent: stats?.recent || []
  };
}

function parseTrackingParams(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }

  return String(value)
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

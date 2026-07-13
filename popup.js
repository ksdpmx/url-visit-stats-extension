document.addEventListener("DOMContentLoaded", init);

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";

  document.getElementById("title").textContent = tab?.title || "Current page";
  document.getElementById("url").textContent = url;

  if (url) {
    const stats = await browser.runtime.sendMessage({ type: "getStatsForUrl", url });
    renderCurrentStats(stats);
    await setupReadControl(url, tab?.title || "");
  }

  const top = await browser.runtime.sendMessage({ type: "getTopUrls", limit: 10 });
  renderTopUrls(top.urls || []);
  renderTopHosts(top.hosts || []);

  document.getElementById("options").addEventListener("click", () => browser.runtime.openOptionsPage());
}

function renderCurrentStats(stats) {
  document.getElementById("exact-count").textContent = formatCount(stats.localExactCount);
  document.getElementById("normalized-count").textContent = formatCount(stats.localNormalizedCount);
  document.getElementById("host-count").textContent = formatCount(stats.localHostCount);
  document.getElementById("first-seen").textContent = formatDate(stats.firstVisitAt);
  document.getElementById("last-seen").textContent = formatDate(stats.lastVisitAt);
}

async function setupReadControl(url, title) {
  const button = document.getElementById("toggle-read");
  const { read } = await browser.runtime.sendMessage({ type: "getReadState", url });
  renderReadState(read);

  button.addEventListener("click", async () => {
    button.disabled = true;
    const result = await browser.runtime.sendMessage({ type: "toggleRead", url, title });
    if (result?.supported === false) {
      button.textContent = "Not trackable";
      document.getElementById("read-status").textContent = "";
    } else {
      renderReadState(result.read);
    }
    button.disabled = false;
  });
}

function renderReadState(read) {
  const button = document.getElementById("toggle-read");
  const status = document.getElementById("read-status");
  button.textContent = read ? "Mark as unread" : "Mark as read";
  button.classList.toggle("is-read", read);
  status.textContent = read ? "\u2705 Read" : "Unread";
}

function renderTopUrls(items) {
  const list = document.getElementById("top-urls");
  list.replaceChildren(...items.map((item) => renderItem(item.url, item.count, item.title || formatDate(item.lastVisitAt))));
}

function renderTopHosts(items) {
  const list = document.getElementById("top-hosts");
  list.replaceChildren(...items.map((item) => renderItem(item.host, item.count, formatDate(item.lastVisitAt))));
}

function renderItem(label, count, subtext) {
  const item = document.createElement("li");

  const main = document.createElement("div");
  main.className = "item-main";

  const url = document.createElement("span");
  url.className = "item-url";
  url.textContent = label;
  url.title = label;

  const counter = document.createElement("span");
  counter.className = "item-count";
  counter.textContent = formatCount(count);

  const sub = document.createElement("div");
  sub.className = "item-sub";
  sub.textContent = subtext || "";

  main.append(url, counter);
  item.append(main, sub);
  return item;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

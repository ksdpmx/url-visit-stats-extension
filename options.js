document.addEventListener("DOMContentLoaded", init);

let statusTimer;

async function init() {
  const settings = await browser.runtime.sendMessage({ type: "getSettings" });
  fillForm(settings);

  document.getElementById("settings-form").addEventListener("submit", save);
  document.getElementById("clear-stats").addEventListener("click", clearStats);
  document.getElementById("export-backup").addEventListener("click", exportBackup);
  document.getElementById("import-backup").addEventListener("click", () => {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", importBackup);
}

function fillForm(settings) {
  document.getElementById("strip-hash").checked = Boolean(settings.stripHash);
  document.getElementById("strip-trailing-slash").checked = Boolean(settings.stripTrailingSlash);
  document.getElementById("strip-tracking-params").checked = Boolean(settings.stripTrackingParams);
  document.getElementById("tracking-params").value = (settings.trackingParams || []).join("\n");
}

async function save(event) {
  event.preventDefault();
  const settings = {
    stripHash: document.getElementById("strip-hash").checked,
    stripTrailingSlash: document.getElementById("strip-trailing-slash").checked,
    stripTrackingParams: document.getElementById("strip-tracking-params").checked,
    trackingParams: document.getElementById("tracking-params").value
  };

  await browser.runtime.sendMessage({ type: "saveSettings", settings });
  showStatus("Saved");
}

async function clearStats() {
  if (!confirm("Clear local URL Visit Stats data?")) {
    return;
  }

  await browser.runtime.sendMessage({ type: "clearStats" });
  showStatus("Local stats cleared");
}

async function exportBackup() {
  try {
    const payload = await browser.runtime.sendMessage({ type: "exportStats" });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `url-visit-stats-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
    showStatus("Backup exported");
  } catch (error) {
    showStatus(error.message || "Could not export backup", true);
  }
}

async function importBackup(event) {
  const input = event.currentTarget;
  const [file] = input.files || [];
  if (!file) {
    return;
  }

  try {
    const payload = JSON.parse(await file.text());
    const summary = summarizeBackup(payload);
    const confirmed = confirm(
      `Import ${summary}?\n\nThis replaces the current local stats, read markers, and settings.`
    );
    if (!confirmed) {
      return;
    }

    const result = await browser.runtime.sendMessage({ type: "importStats", payload });
    fillForm(result.settings);
    showStatus(
      `Imported ${formatCount(result.summary.urls)} URLs and ${formatCount(result.summary.readUrls)} read markers`
    );
  } catch (error) {
    showStatus(error.message || "Could not import this backup", true);
  } finally {
    input.value = "";
  }
}

function summarizeBackup(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || !payload.stats) {
    throw new Error("This file is not a valid URL Visit Stats backup.");
  }

  const urlCount = Object.keys(payload.stats.urls || {}).length;
  const readCount = Object.keys(payload.readUrls || {}).length;
  const exportedAt = payload.exportedAt ? new Date(payload.exportedAt) : null;
  const dateLabel = exportedAt && !Number.isNaN(exportedAt.getTime())
    ? exportedAt.toLocaleString()
    : "an unknown date";
  return `${formatCount(urlCount)} URLs and ${formatCount(readCount)} read markers, exported ${dateLabel}`;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function showStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.classList.toggle("error", isError);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    status.textContent = "";
    status.classList.remove("error");
  }, isError ? 6000 : 3000);
}

document.addEventListener("DOMContentLoaded", init);

let statusTimer;
let pendingImportMode;

async function init() {
  const settings = await browser.runtime.sendMessage({ type: "getSettings" });
  fillForm(settings);

  document.getElementById("settings-form").addEventListener("submit", save);
  document.getElementById("clear-stats").addEventListener("click", clearStats);
  document.getElementById("export-backup").addEventListener("click", exportBackup);
  document.getElementById("import-merge").addEventListener("click", () => selectImportFile("merge"));
  document.getElementById("import-overwrite").addEventListener("click", () => selectImportFile("overwrite"));
  document.getElementById("import-file").addEventListener("change", importBackup);
}

function selectImportFile(mode) {
  const input = document.getElementById("import-file");
  pendingImportMode = mode;
  input.value = "";
  input.click();
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
  if (!confirm("Clear all local visit counts? Read markers and settings will be kept.")) {
    return;
  }

  await browser.runtime.sendMessage({ type: "clearStats" });
  showStatus("Visit counts cleared");
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
    const mode = pendingImportMode;
    if (!mode) {
      throw new Error("Choose an import mode before selecting a backup.");
    }

    const payload = JSON.parse(await file.text());
    const summary = summarizeBackup(payload);
    const confirmed = confirm(`Import ${summary}?\n\n${importConfirmation(mode)}`);
    if (!confirmed) {
      return;
    }

    const result = await browser.runtime.sendMessage({ type: "importStats", payload, mode });
    fillForm(result.settings);
    const action = result.mode === "merge" ? "Merged backup; now tracking" : "Imported";
    showStatus(
      `${action} ${formatCount(result.summary.urls)} URLs and ${formatCount(result.summary.readUrls)} read markers`
    );
  } catch (error) {
    showStatus(error.message || "Could not import this backup", true);
  } finally {
    input.value = "";
    pendingImportMode = undefined;
  }
}

function importConfirmation(mode) {
  if (mode === "merge") {
    return "Visit counts will be added and read markers combined. Current settings will be kept. Importing the same backup again will add its counts again.";
  }

  return "This will replace the current local stats, read markers, and settings.";
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

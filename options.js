document.addEventListener("DOMContentLoaded", init);

async function init() {
  const settings = await browser.runtime.sendMessage({ type: "getSettings" });
  fillForm(settings);

  document.getElementById("settings-form").addEventListener("submit", save);
  document.getElementById("clear-stats").addEventListener("click", clearStats);
}

function fillForm(settings) {
  document.getElementById("strip-hash").checked = Boolean(settings.stripHash);
  document.getElementById("strip-trailing-slash").checked = Boolean(settings.stripTrailingSlash);
  document.getElementById("strip-tracking-params").checked = Boolean(settings.stripTrackingParams);
  document.getElementById("tracking-params").value = (settings.trackingParams || []).join("\n");
  document.getElementById("keep-recent-limit").value = settings.keepRecentLimit || 200;
}

async function save(event) {
  event.preventDefault();
  const settings = {
    stripHash: document.getElementById("strip-hash").checked,
    stripTrailingSlash: document.getElementById("strip-trailing-slash").checked,
    stripTrackingParams: document.getElementById("strip-tracking-params").checked,
    trackingParams: document.getElementById("tracking-params").value,
    keepRecentLimit: document.getElementById("keep-recent-limit").value
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

function showStatus(message) {
  const status = document.getElementById("status");
  status.textContent = message;
  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

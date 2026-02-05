const statusEl = document.getElementById("status");
const openOptionsButton = document.getElementById("openOptions");

async function loadStatus() {
  const { apiBase, apiKey, token } = await chrome.storage.sync.get([
    "apiBase",
    "apiKey",
    "token"
  ]);

  const ready = apiBase && apiKey && token;
  statusEl.textContent = ready
    ? "Tracker is ready."
    : "Missing settings. Configure the extension.";
}

openOptionsButton.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

loadStatus();

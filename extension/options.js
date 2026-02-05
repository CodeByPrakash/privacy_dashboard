const apiBaseInput = document.getElementById("apiBase");
const apiKeyInput = document.getElementById("apiKey");
const tokenInput = document.getElementById("token");
const blockListInput = document.getElementById("blockList");
const allowListInput = document.getElementById("allowList");
const saveButton = document.getElementById("save");

async function load() {
  const { apiBase, apiKey, token, blockList, allowList } = await chrome.storage.sync.get([
    "apiBase",
    "apiKey",
    "token",
    "blockList",
    "allowList"
  ]);
  apiBaseInput.value = apiBase || "http://localhost:3000";
  apiKeyInput.value = apiKey || "";
  tokenInput.value = token || "";
  blockListInput.value = (blockList || []).join("\n");
  allowListInput.value = (allowList || []).join("\n");
}

function normalizeList(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

saveButton.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    apiBase: apiBaseInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    token: tokenInput.value.trim(),
    blockList: normalizeList(blockListInput.value),
    allowList: normalizeList(allowListInput.value)
  });

  chrome.runtime.sendMessage({ type: "sync-rules" });
  alert("Saved");
});

load();

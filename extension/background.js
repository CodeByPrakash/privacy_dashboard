const DEFAULT_API_BASE = "http://localhost:3000";

async function getConfig() {
  const { apiBase, apiKey, token, allowList, blockList } = await chrome.storage.sync.get([
    "apiBase",
    "apiKey",
    "token",
    "allowList",
    "blockList"
  ]);
  return {
    apiBase: apiBase || DEFAULT_API_BASE,
    apiKey: apiKey || "",
    token: token || "",
    allowList: allowList || [],
    blockList: blockList || []
  };
}

function toUrlFilter(entry) {
  if (entry.startsWith("http://") || entry.startsWith("https://")) {
    return `|${entry}`;
  }
  return `||${entry}^`;
}

async function applyRules({ adminBlocked = [], allowList = [], blockList = [] }) {
  const rules = [];
  let ruleId = 1;

  const defaultAllow = ["localhost", "127.0.0.1"];

  for (const entry of adminBlocked) {
    rules.push({
      id: ruleId++,
      priority: 3,
      action: { type: "block" },
      condition: { urlFilter: toUrlFilter(entry), resourceTypes: ["main_frame", "sub_frame"] }
    });
  }

  for (const entry of allowList) {
    rules.push({
      id: ruleId++,
      priority: 2,
      action: { type: "allow" },
      condition: { urlFilter: toUrlFilter(entry), resourceTypes: ["main_frame", "sub_frame"] }
    });
  }

  for (const entry of defaultAllow) {
    rules.push({
      id: ruleId++,
      priority: 4,
      action: { type: "allow" },
      condition: { urlFilter: toUrlFilter(entry), resourceTypes: ["main_frame", "sub_frame"] }
    });
  }

  for (const entry of blockList) {
    rules.push({
      id: ruleId++,
      priority: 1,
      action: { type: "block" },
      condition: { urlFilter: toUrlFilter(entry), resourceTypes: ["main_frame", "sub_frame"] }
    });
  }

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRules.map((rule) => rule.id),
    addRules: rules
  });
}

async function syncAdminBlocked() {
  const { apiBase, apiKey, allowList, blockList } = await getConfig();
  if (!apiKey) {
    await applyRules({ adminBlocked: [], allowList, blockList });
    return;
  }

  const response = await fetch(`${apiBase}/api/web-filter/blocked`, {
    headers: { "x-extension-key": apiKey }
  }).catch(() => null);

  if (!response || !response.ok) {
    await applyRules({ adminBlocked: [], allowList, blockList });
    return;
  }

  const data = await response.json();
  await applyRules({ adminBlocked: data.blocked || [], allowList, blockList });
}

async function logUrl(url) {
  const { apiBase, apiKey, token } = await getConfig();
  if (!apiKey || !token) {
    return;
  }

  await fetch(`${apiBase}/api/activity/log-extension`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-extension-key": apiKey
    },
    body: JSON.stringify({ url, token })
  }).catch(() => {});
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && tab.url.startsWith("http")) {
    logUrl(tab.url);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("syncBlocked", { periodInMinutes: 5 });
  syncAdminBlocked();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("syncBlocked", { periodInMinutes: 5 });
  syncAdminBlocked();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncBlocked") {
    syncAdminBlocked();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "sync-rules") {
    syncAdminBlocked().then(() => sendResponse({ status: "ok" }));
    return true;
  }
  return false;
});

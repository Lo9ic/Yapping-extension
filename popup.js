const DEFAULT_PROMPT = "";
const PROVIDER_KEY_FIELDS = {
  groq: { key: "groqApiKey", label: "Groq API Key", placeholder: "gsk_..." },
  openai: { key: "openaiApiKey", label: "OpenAI API Key", placeholder: "sk-..." },
  gemini: { key: "geminiApiKey", label: "Gemini API Key", placeholder: "AIza..." },
  grok: { key: "grokApiKey", label: "Grok API Key", placeholder: "xai-..." },
};

function $(id) {
  return document.getElementById(id);
}

function showStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.style.color = isError ? "#f45d22" : "#1da1f2";
}

function loadSettings() {
  chrome.storage.sync.get(["provider", "groqApiKey", "openaiApiKey", "geminiApiKey", "grokApiKey", "replyPrompt", "showEngagementScore", "groqModel"], (data) => {
    const provider = data.provider || "groq";
    $("provider").value = provider;
    const meta = PROVIDER_KEY_FIELDS[provider];
    $("apiKey").value = data[meta.key] || "";
    $("prompt").value = data.replyPrompt ?? DEFAULT_PROMPT;

    // Load Groq model
    const groqModel = data.groqModel || "openai/gpt-oss-120b";
    $("groqModel").value = groqModel;

    // Load engagement score toggle
    const showEngagementScore = data.showEngagementScore !== undefined ? data.showEngagementScore : true;
    $("showEngagementScore").checked = showEngagementScore;
    $("toggleLabel").textContent = showEngagementScore ? "On" : "Off";

    $("showEngagementScore").checked = showEngagementScore;
    $("toggleLabel").textContent = showEngagementScore ? "On" : "Off";

    updateKeyLabel(provider);
    toggleGroqModelField(provider);
  });
}

function saveSettings() {
  const provider = $("provider").value;
  const apiKey = $("apiKey").value.trim();
  const replyPrompt = $("prompt").value.trim();
  const showEngagementScore = $("showEngagementScore").checked;
  const groqModel = $("groqModel").value;

  chrome.storage.sync.get(["groqApiKey", "openaiApiKey", "geminiApiKey", "grokApiKey"], (data) => {
    const payload = {
      provider,
      replyPrompt,
      showEngagementScore,
      groqModel,
      groqApiKey: data.groqApiKey || "",
      openaiApiKey: data.openaiApiKey || "",
      geminiApiKey: data.geminiApiKey || "",
      grokApiKey: data.grokApiKey || "",
    };
    const meta = PROVIDER_KEY_FIELDS[provider];
    payload[meta.key] = apiKey;

    chrome.storage.sync.set(payload, () => {
      showStatus("Saved.");
      // Notify content scripts of setting change
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.url && (tab.url.includes("twitter.com") || tab.url.includes("x.com"))) {
            chrome.tabs.sendMessage(tab.id, {
              type: "toggleEngagementScore",
              enabled: showEngagementScore
            }).catch(() => { }); // Ignore errors if content script not ready
          }
        });
      });
    });
  });
}

function openOptions() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else if (chrome.runtime.id) {
    window.open(`chrome-extension://${chrome.runtime.id}/options.html`);
  } else {
    showStatus("Could not open options page", true);
  }
}

function updateKeyLabel(provider) {
  const meta = PROVIDER_KEY_FIELDS[provider];
  $("apiKey").placeholder = meta.placeholder;
  $("apiKey").previousElementSibling.textContent = meta.label;
  $("keyHint").textContent = `Stored locally via chrome.storage for ${meta.label.split(" ")[0]}.`;
}

function toggleGroqModelField(provider) {
  const groqModelField = $("groqModelField");
  if (provider === "groq") {
    groqModelField.style.display = "block";
  } else {
    groqModelField.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  $("save").addEventListener("click", saveSettings);
  $("open-options").addEventListener("click", openOptions);
  $("provider").addEventListener("change", () => {
    const provider = $("provider").value;
    updateKeyLabel(provider);
    toggleGroqModelField(provider);
    chrome.storage.sync.get(Object.values(PROVIDER_KEY_FIELDS).map((m) => m.key), (data) => {
      const meta = PROVIDER_KEY_FIELDS[provider];
      $("apiKey").value = data[meta.key] || "";
    });
  });

  // Handle engagement score toggle
  $("showEngagementScore").addEventListener("change", (e) => {
    $("toggleLabel").textContent = e.target.checked ? "On" : "Off";
    saveSettings(); // Auto-save when toggled
  });
});

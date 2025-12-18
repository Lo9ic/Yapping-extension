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

function showStatus(message) {
  const status = $("status");
  status.textContent = message;
  status.style.visibility = "visible";
  setTimeout(() => (status.style.visibility = "hidden"), 2000);
}

function loadSettings() {
  chrome.storage.sync.get(["provider", "groqApiKey", "openaiApiKey", "geminiApiKey", "grokApiKey", "replyPrompt", "groqModel"], (data) => {
    const provider = data.provider || "groq";
    $("provider").value = provider;
    const keyField = PROVIDER_KEY_FIELDS[provider];
    $("apiKey").value = data[keyField.key] || "";
    $("prompt").value = data.replyPrompt ?? DEFAULT_PROMPT;
    $("readImages").checked = data.readImages !== false; // Default to true

    // Load Groq model
    const groqModel = data.groqModel || "openai/gpt-oss-120b";
    $("groqModel").value = groqModel;

    updateKeyLabel(provider);
    toggleGroqModelField(provider);
  });
}

function saveSettings() {
  const provider = $("provider").value;
  const apiKey = $("apiKey").value.trim();
  const replyPrompt = $("prompt").value.trim();
  const groqModel = $("groqModel").value;
  const readImages = $("readImages").checked;

  chrome.storage.sync.get(["groqApiKey", "openaiApiKey", "geminiApiKey", "grokApiKey"], (data) => {
    const payload = {
      provider,
      replyPrompt,
      readImages,
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
    });
  });
}

function resetPrompt() {
  $("prompt").value = DEFAULT_PROMPT;
  showStatus("Prompt reset.");
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
  $("provider").addEventListener("change", () => {
    const provider = $("provider").value;
    updateKeyLabel(provider);
    toggleGroqModelField(provider);
    chrome.storage.sync.get(Object.values(PROVIDER_KEY_FIELDS).map((m) => m.key), (data) => {
      const meta = PROVIDER_KEY_FIELDS[provider];
      $("apiKey").value = data[meta.key] || "";
    });
  });
  $("save").addEventListener("click", saveSettings);
  $("reset").addEventListener("click", resetPrompt);
});

const DEFAULT_PROMPT = `Act as a regular Crypto Twitter user. Write a very short reply to the provided tweet. One short sentence only. You must reply in the exact same language as the tweet, and use the tweet’s tone and style. Keep it positive and casual. No emojis, hashtags, or quotation marks. Always start your reply with a lowercase letter. Never capitalize the first character. Do not use English unless the tweet is in English.`;
const PROVIDER_KEY_FIELDS = {
  groq: { key: "groqApiKey", label: "Groq API Key", placeholder: "gsk_..." },
  openai: { key: "openaiApiKey", label: "OpenAI API Key", placeholder: "sk-..." },
  gemini: { key: "geminiApiKey", label: "Gemini API Key", placeholder: "AIza..." },
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
  chrome.storage.sync.get(["provider", "groqApiKey", "openaiApiKey", "geminiApiKey", "replyPrompt"], (data) => {
    const provider = data.provider || "groq";
    $("provider").value = provider;
    const keyField = PROVIDER_KEY_FIELDS[provider];
    $("apiKey").value = data[keyField.key] || "";
    $("prompt").value = data.replyPrompt || DEFAULT_PROMPT;
    updateKeyLabel(provider);
  });
}

function saveSettings() {
  const provider = $("provider").value;
  const apiKey = $("apiKey").value.trim();
  const replyPrompt = $("prompt").value.trim() || DEFAULT_PROMPT;

  chrome.storage.sync.get(["groqApiKey", "openaiApiKey", "geminiApiKey"], (data) => {
    const payload = {
      provider,
      replyPrompt,
      groqApiKey: data.groqApiKey || "",
      openaiApiKey: data.openaiApiKey || "",
      geminiApiKey: data.geminiApiKey || "",
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

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  $("provider").addEventListener("change", () => {
    const provider = $("provider").value;
    updateKeyLabel(provider);
    chrome.storage.sync.get(Object.values(PROVIDER_KEY_FIELDS).map((m) => m.key), (data) => {
      const meta = PROVIDER_KEY_FIELDS[provider];
      $("apiKey").value = data[meta.key] || "";
    });
  });
  $("save").addEventListener("click", saveSettings);
  $("reset").addEventListener("click", resetPrompt);
});

// ==UserScript==
// @name         Auto Yapping by Lo9ic
// @version      2.0.0
// @description  Adds a simple button to generate AI replies on Twitter
// @match        https://twitter.com/*
// @match        https://x.com/*
// @match        https://pro.x.com/*
// @grant        none
// ==/UserScript==

const DEFAULT_PROMPT = "";

const settingsCache = {
  provider: "groq",
  groqApiKey: "",
  openaiApiKey: "",
  geminiApiKey: "",
  grokApiKey: "",
  prompt: DEFAULT_PROMPT,
  loaded: false,
};

function loadSettings() {
  if (settingsCache.loaded) return Promise.resolve(settingsCache);

  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      settingsCache.loaded = true;
      return resolve(settingsCache);
    }

    chrome.storage.sync.get(["provider", "groqApiKey", "openaiApiKey", "geminiApiKey", "grokApiKey", "replyPrompt"], (data) => {
      settingsCache.provider = data.provider || "groq";
      settingsCache.groqApiKey = data.groqApiKey || "";
      settingsCache.openaiApiKey = data.openaiApiKey || "";
      settingsCache.geminiApiKey = data.geminiApiKey || "";
      settingsCache.grokApiKey = data.grokApiKey || "";
      settingsCache.prompt = data.replyPrompt ?? DEFAULT_PROMPT;
      settingsCache.loaded = true;
      resolve(settingsCache);
    });
  });
}

function getProviderConfig(settings) {
  const provider = settings.provider || "groq";
  if (provider === "openai") {
    return {
      provider,
      apiKey: settings.openaiApiKey || "",
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      isGemini: false,
    };
  }
  if (provider === "gemini") {
    return {
      provider,
      apiKey: settings.geminiApiKey || "",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      model: "gemini-2.0-flash",
      isGemini: true,
    };
  }
  if (provider === "grok") {
    return {
      provider,
      apiKey: settings.grokApiKey || "",
      url: "https://api.x.ai/v1/chat/completions",
      model: "grok-4-1-fast-reasoning",
      isGemini: false,
    };
  }
  return {
    provider: "groq",
    apiKey: settings.groqApiKey || "",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant",
    isGemini: false,
  };
}

function createOrGetFloatingWindow() {
  let win = document.getElementById("ai-floating-replies-window");
  if (win) return win;

  win = document.createElement("div");
  win.id = "ai-floating-replies-window";
  Object.assign(win.style, {
    position: "absolute",
    backgroundColor: "#15202b",
    border: "1px solid #38444d",
    borderRadius: "8px",
    padding: "10px",
    color: "white",
    fontSize: "14px",
    userSelect: "text",
    display: "none",
    flexDirection: "column",
    gap: "6px",
    maxWidth: "400px",
    boxShadow: "0 0 10px rgba(29, 161, 242, 0.9)",
    zIndex: 99999,
  });

  document.body.appendChild(win);
  return win;
}

function insertButtonIntoReplyBoxes() {
  // Find all reply boxes on the page
  const replyBoxes = document.querySelectorAll('div[contenteditable="true"][data-testid="tweetTextarea_0"]');

  replyBoxes.forEach((box) => {
    const container = box.parentElement;
    if (!container || container.querySelector(".ai-reply-button")) return;

    // Create our AI reply button as a div element
    const aiReplyButton = document.createElement("div");
    aiReplyButton.className = "ai-reply-button";
    aiReplyButton.innerText = "AI Reply";
    aiReplyButton.title = "Generate reply with Auto Yapping";
    aiReplyButton.setAttribute('data-translate', 'no'); // Prevent translation
    aiReplyButton.setAttribute('role', 'button'); // Make it behave like a button
    aiReplyButton.style.cursor = 'pointer'; // Add cursor pointer

    // Style the button to match Twitter's design - make it more visible
    Object.assign(aiReplyButton.style, {
      backgroundColor: "#1DA1F2",
      border: "1px solid #1DA1F2", // Add border to make it more visible
      color: "white",
      padding: "1px 2px",
      borderRadius: "20px",
      fontSize: "10px",
      fontWeight: "bold", // Make text bold
      fontFamily: "TwitterChirp, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif",
      position: "absolute",
      bottom: "0px",
      right: "10px",
      zIndex: 1000,
      transition: "background-color 0.2s",
      // Ensure button is not translated by browser
      "data-translate": "no",
      "lang": "en",
    });

    // Add hover effect
    aiReplyButton.addEventListener("mouseenter", () => {
      aiReplyButton.style.backgroundColor = "#1a8cd8";
    });

    aiReplyButton.addEventListener("mouseleave", () => {
      aiReplyButton.style.backgroundColor = "#1DA1F2";
    });

    aiReplyButton.addEventListener("click", async (e) => {
      e.stopPropagation();
      await generateText(box, container);
    });

    // Add the button directly to the container
    container.appendChild(aiReplyButton);
  });
}

async function generateText(box, container) {
  const floatingWin = createOrGetFloatingWindow();

  // Hide the floating window - we don't want to show it
  floatingWin.style.display = "none";
  floatingWin.innerHTML = "";

  try {
    const settings = await loadSettings();
    const providerConfig = getProviderConfig(settings);
    const tweetText = getTweetTextFromDOM(box);
    if (!tweetText) throw new Error("Could not get tweet text.");

    if (!providerConfig.apiKey) {
      floatingWin.innerHTML = "";
      const msg = document.createElement("div");
      msg.textContent = `Set your ${providerConfig.provider} API key in the extension options to generate replies.`;
      msg.style.marginBottom = "8px";
      msg.style.maxWidth = "360px";
      const btn = document.createElement("button");
      btn.textContent = "Open Settings";
      Object.assign(btn.style, {
        backgroundColor: "#1da1f2",
        border: "none",
        borderRadius: "6px",
        padding: "8px",
        cursor: "pointer",
        color: "white",
        textAlign: "center",
        fontSize: "14px",
        width: "100%",
      });
      btn.addEventListener("click", () => {
        if (chrome?.runtime?.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else if (chrome?.runtime?.id) {
          window.open(`chrome-extension://${chrome.runtime.id}/options.html`);
        } else {
          window.open("chrome://extensions");
        }
      });
      floatingWin.appendChild(msg);
      floatingWin.appendChild(btn);
      return;
    }

    const userPrompt = settings.prompt || "";
    const prompt = `${userPrompt}

tweet:
${tweetText}`;

    // Generate random seed for variety (Groq/OpenAI only)
    const seed = Math.floor(Math.random() * 1000000);
    console.log("GenerateText Seed:", seed, "Provider:", providerConfig.provider);

    let replyText = "";
    if (providerConfig.isGemini) {
      const response = await fetch(`${providerConfig.url}?key=${providerConfig.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `System: ${userPrompt}\n\nUser:\n${prompt}` }
              ]
            }
          ]
        }),
      });

      console.log("GenerateText Gemini status:", response.status);
      const data = await response.json();
      console.log("GenerateText Gemini raw:", JSON.stringify(data).slice(0, 500));
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} - ${data.error?.message || 'No additional details'}`);
      replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      const response = await fetch(providerConfig.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: providerConfig.model,
          messages: [
            { role: "system", content: userPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: 200,
          temperature: 0.9,
          top_p: 1,
          seed: seed,
        }),
      });

      console.log("GenerateText Response status:", response.status);
      const data = await response.json();
      console.log("GenerateText Raw response:", data.choices?.[0]?.message?.content || "No content");
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} - ${data.error?.message || 'No additional details'}`);
      replyText = data.choices?.[0]?.message?.content;
    }

    if (!replyText) {
      floatingWin.innerHTML = "❌ Could not get response from model.";
      return;
    }

    // Directly insert the reply without showing preview
    insertTextProperly(box, replyText.trim());
    floatingWin.style.display = "none";
    floatingWin.innerHTML = "";
    box.focus();
  } catch (err) {
    floatingWin.innerHTML = `❌ Error generating reply: ${err.message}`;
    console.error("GenerateText error:", err);
  }
}

function insertTextProperly(el, text) {
  if (!el) {
    console.error("insertTextProperly: Element is undefined");
    return;
  }

  // Focus the element first
  el.focus();

  // Select all existing content
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);

  // Use execCommand to insert text - this maintains editability better
  try {
    // First, try using execCommand which works well with contenteditable
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      throw new Error("execCommand failed");
    }

    // Trigger input event for React
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: 'insertText'
    });
    el.dispatchEvent(inputEvent);

    // Try to trigger React's onChange handler
    triggerReactChange(el);

    // Place cursor at the end
    setTimeout(() => {
      el.focus();
      const sel = window.getSelection();
      const rng = document.createRange();
      rng.selectNodeContents(el);
      rng.collapse(false);
      sel.removeAllRanges();
      sel.addRange(rng);
    }, 10);

  } catch (e) {
    console.error("execCommand insertion failed, trying alternative:", e);

    // Alternative method: Set textContent and trigger events
    try {
      el.textContent = text;

      // Trigger comprehensive events
      const events = [
        new Event('focus', { bubbles: true }),
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: text,
          inputType: 'insertText'
        }),
        new Event('change', { bubbles: true }),
        new KeyboardEvent('keyup', { bubbles: true })
      ];

      events.forEach(event => el.dispatchEvent(event));

      // Try to trigger React's onChange handler
      triggerReactChange(el);

      // Place cursor at the end
      setTimeout(() => {
        el.focus();
        const sel = window.getSelection();
        const rng = document.createRange();
        rng.selectNodeContents(el);
        rng.collapse(false);
        sel.removeAllRanges();
        sel.addRange(rng);
      }, 10);

    } catch (err) {
      console.error("Alternative insertion method failed:", err);
      fallbackInsertion(el, text);
    }
  }
}

function triggerReactChange(el) {
  try {
    // Try multiple possible React internal keys
    const reactKeys = [
      '__reactFiber$',
      '__reactInternalInstance$',
      '__reactFiber',
      '__reactInternalInstance'
    ];

    let reactKey = null;
    for (const key of reactKeys) {
      const foundKey = Object.keys(el).find(k => k.startsWith(key));
      if (foundKey) {
        reactKey = foundKey;
        break;
      }
    }

    if (reactKey) {
      const fiber = el[reactKey];
      let onChangeHandler = null;

      // Try to find the onChange handler in different places
      if (fiber && fiber.memoizedProps && fiber.memoizedProps.onChange) {
        onChangeHandler = fiber.memoizedProps.onChange;
      } else if (fiber && fiber.return && fiber.return.memoizedProps && fiber.return.memoizedProps.onChange) {
        onChangeHandler = fiber.return.memoizedProps.onChange;
      } else if (fiber && fiber.stateNode && fiber.stateNode.props && fiber.stateNode.props.onChange) {
        onChangeHandler = fiber.stateNode.props.onChange;
      }

      if (onChangeHandler && typeof onChangeHandler === 'function') {
        // Create a synthetic event that mimics React's event
        const syntheticEvent = {
          target: el,
          currentTarget: el,
          type: 'change',
          bubbles: true,
          cancelable: true,
          nativeEvent: new Event('change', { bubbles: true })
        };
        onChangeHandler(syntheticEvent);
      }
    }
  } catch (e) {
    console.log("React state update failed:", e);
  }
}

function fallbackInsertion(el, text) {
  // Last resort: try the clipboard method
  navigator.clipboard.writeText(text).then(() => {
    el.focus();
    document.execCommand('paste');

    // Trigger events
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: 'insertFromPaste'
    });
    el.dispatchEvent(inputEvent);

    const changeEvent = new Event('change', { bubbles: true });
    el.dispatchEvent(changeEvent);

    triggerReactChange(el);
  }).catch(err => {
    console.error("All insertion methods failed:", err);
  });
}

function extractTweetTextFromContainer(container) {
  const TWEET_TEXT_SELECTORS = [
    'div[data-testid="tweetText"]',
    'div[lang]',
    '[data-testid="tweetText"] span',
    'div[lang] span'
  ];

  for (const selector of TWEET_TEXT_SELECTORS) {
    const elements = container.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.innerText.trim();
      if (text && text.length > 5) return text;
    }
  }
  return "";
}

function getTweetTextFromDOM(replyBox) {
  console.log("getTweetTextFromDOM: Starting with replyBox:", replyBox);

  // Try multiple approaches to find the tweet text
  let tweetText = "";

  // Method 1: Look for the tweet in the same article as the reply box
  const article = replyBox.closest("article");
  if (article) {
    tweetText = extractTweetTextFromContainer(article);
    if (tweetText) console.log("getTweetTextFromDOM: Found tweet text within article:", tweetText);
  }

  // Method 2: If not found in article, try looking in the dialog
  if (!tweetText) {
    const dialog = replyBox.closest('[role="dialog"]');
    if (dialog) {
      tweetText = extractTweetTextFromContainer(dialog);
      if (tweetText) console.log("getTweetTextFromDOM: Found tweet text in dialog:", tweetText);
    }
  }

  // Method 3: Try to find the tweet by looking up the DOM tree
  if (!tweetText) {
    let parent = replyBox.parentElement;
    while (parent && parent !== document.body) {
      tweetText = extractTweetTextFromContainer(parent);
      if (tweetText) {
        console.log("getTweetTextFromDOM: Found tweet text by traversing up:", tweetText);
        break;
      }
      parent = parent.parentElement;
    }
  }

  // Method 4: Last resort - try to find any element with substantial text near the reply box
  if (!tweetText) {
    const nearbyElements = document.querySelectorAll('div[data-testid="tweetText"], article[data-testid="tweet"]');
    for (const el of nearbyElements) {
      const text = extractTweetTextFromContainer(el) || el.innerText.trim();
      if (text && text.length > 5) {
        tweetText = text;
        console.log("getTweetTextFromDOM: Found tweet text as last resort:", tweetText);
        break;
      }
    }
  }

  console.log("getTweetTextFromDOM: Final tweet text:", tweetText);
  return tweetText;
}

document.addEventListener("click", (e) => {
  const floatingWin = document.getElementById("ai-floating-replies-window");
  if (floatingWin && !floatingWin.contains(e.target)) {
    floatingWin.style.display = "none";
    floatingWin.innerHTML = "";
  }
});

// Re-insert buttons every 3 seconds
setInterval(() => {
  insertButtonIntoReplyBoxes();
}, 3000);

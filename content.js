// ==UserScript==
// @name         Auto Yapping by Lo9ic
// @version      2.0.0
// @description  Adds a simple button to generate AI replies on Twitter
// @match        https://twitter.com/*
// @match        https://x.com/*
// @match        https://pro.x.com/*
// @grant        none
// ==/UserScript==

console.log('🚀 Auto Yapping Extension Loaded - Content Script Active');

const DEFAULT_PROMPT = "";

const settingsCache = {
  provider: "groq",
  groqApiKey: "",
  openaiApiKey: "",
  geminiApiKey: "",
  grokApiKey: "",
  replyPrompt: DEFAULT_PROMPT,
  showEngagementScore: true,
  readImages: true,
  groqModel: "openai/gpt-oss-120b",
  loaded: false,
};

function loadSettings() {
  if (settingsCache.loaded) return Promise.resolve(settingsCache);

  return new Promise((resolve) => {
    if (!chrome?.storage?.sync) {
      settingsCache.loaded = true;
      return resolve(settingsCache);
    }

    chrome.storage.sync.get(["provider", "groqApiKey", "openaiApiKey", "geminiApiKey", "grokApiKey", "replyPrompt", "showEngagementScore", "groqModel"], (data) => {
      settingsCache.provider = data.provider || "groq";
      settingsCache.groqApiKey = data.groqApiKey || "";
      settingsCache.openaiApiKey = data.openaiApiKey || "";
      settingsCache.geminiApiKey = data.geminiApiKey || "";
      settingsCache.grokApiKey = data.grokApiKey || "";
      settingsCache.grokApiKey = data.grokApiKey || "";
      settingsCache.prompt = data.replyPrompt ?? DEFAULT_PROMPT;
      settingsCache.grokApiKey = data.grokApiKey || "";
      settingsCache.prompt = data.replyPrompt ?? DEFAULT_PROMPT;
      settingsCache.showEngagementScore = data.showEngagementScore !== undefined ? data.showEngagementScore : true;
      settingsCache.groqModel = data.groqModel || "openai/gpt-oss-120b";
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
      isVision: true, // GPT-4o-mini supports vision
    };
  }
  if (provider === "gemini") {
    return {
      provider,
      apiKey: settings.geminiApiKey || "",
      url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      model: "gemini-2.0-flash",
      isGemini: true,
      isVision: true, // Gemini 2.0 Flash supports vision
    };
  }
  if (provider === "grok") {
    return {
      provider,
      apiKey: settings.grokApiKey || "",
      url: "https://api.x.ai/v1/chat/completions",
      model: "grok-4-1-fast-reasoning",
      isGemini: false,
      isVision: false, // Currently configured as text/reasoning
    };
  }

  // Detect if this is a reasoning model
  const groqModel = settings.groqModel || "openai/gpt-oss-120b";
  const isReasoningModel = groqModel.includes("reasoning") ||
    groqModel.includes("o1") ||
    groqModel.includes("o3") ||
    groqModel.includes("deepseek-reasoner");

  // Detect if this is a vision model (Groq Llama 4 Scout/Maverick or OpenAI GPT-4o)
  const isVisionModel =
    groqModel.includes("scout") ||
    groqModel.includes("maverick") ||
    groqModel.includes("gpt-4o") ||
    groqModel.includes("vision");

  return {
    provider: "groq",
    apiKey: settings.groqApiKey || "",
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: groqModel,
    isGemini: false,
    isReasoning: isReasoningModel,
    isVision: isVisionModel,
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

// Image extraction helpers
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.split(',')[1];
        resolve({
          base64: base64String,
          mimeType: blob.type
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}

function extractImagesFromContainer(container) {
  const images = [];
  // Look for tweet photos
  const photoElements = container.querySelectorAll('div[data-testid="tweetPhoto"] img');
  photoElements.forEach(img => {
    if (img.src) {
      images.push({
        url: img.src
      });
    }
  });

  // Look for video posters (better than nothing)
  if (images.length === 0) {
    const videoPosters = container.querySelectorAll('video[poster]');
    videoPosters.forEach(video => {
      if (video.poster) {
        images.push({
          url: video.poster
        });
      }
    });
  }

  // Deduplicate based on URL
  const uniqueImages = [];
  const seenUrls = new Set();

  for (const img of images) {
    if (!seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      uniqueImages.push(img);
    }
  }

  return uniqueImages;
}

async function generateText(box, container) {
  const floatingWin = createOrGetFloatingWindow();

  // Hide the floating window - we don't want to show it
  floatingWin.style.display = "none";
  floatingWin.innerHTML = "";

  try {
    const settings = await loadSettings();
    const providerConfig = getProviderConfig(settings);

    // Get tweet content (text + images)
    const tweetContentData = getTweetTextFromDOM(box);
    const tweetText = tweetContentData.text;

    // Only use images if provider supports vision
    const requestImages = providerConfig.isVision ? (tweetContentData.images || []) : [];

    if (!tweetText && requestImages.length === 0) throw new Error("Could not get tweet content.");

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
    let finalPromptText = `tweet:\n${tweetText}`;
    if (requestImages.length > 0) {
      finalPromptText += `\n\n[Attached ${requestImages.length} image(s)]`;
    }

    // Generate random seed for variety (Groq/OpenAI only)
    const seed = Math.floor(Math.random() * 1000000);
    console.log("GenerateText Seed:", seed, "Provider:", providerConfig.provider);

    let replyText = "";

    // Fetch images if we have them and the provider supports them (or we just send them anyway and hope)
    // We assume Gemini and OpenAI based endpoints can handle vision if structured correctly.
    // Base64 conversion
    const imageDatas = [];
    if (requestImages.length > 0) {
      console.log(`Fetching ${requestImages.length} images...`);
      for (const imgObj of requestImages) {
        const data = await fetchImageAsBase64(imgObj.url);
        if (data) imageDatas.push(data);
      }
    }

    if (providerConfig.isGemini) {
      const parts = [{ text: `System: ${userPrompt}\n\nUser:\n${finalPromptText}` }];

      // Add images for Gemini
      imageDatas.forEach(img => {
        parts.push({
          inline_data: {
            mime_type: img.mimeType,
            data: img.base64
          }
        });
      });

      const response = await fetch(`${providerConfig.url}?key=${providerConfig.apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: parts
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
      // For OpenAI/Groq

      let messages;

      if (imageDatas.length > 0 && !providerConfig.isReasoning) {
        // Multimodal request structure (OpenAI Vision compatible)
        const content = [
          { type: "text", text: finalPromptText }
        ];

        imageDatas.forEach(img => {
          content.push({
            type: "image_url",
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64}`
            }
          });
        });

        messages = [
          { role: "system", content: userPrompt },
          { role: "user", content: content }
        ];
      } else {
        // Standard text-only request
        // For reasoning models, combine system and user into single user message
        messages = providerConfig.isReasoning ?
          [{
            role: "user",
            content: `${userPrompt}\n\n${finalPromptText}`
          }] :
          [
            { role: "system", content: userPrompt },
            { role: "user", content: finalPromptText },
          ];
      }

      // Build request body
      const requestBody = {
        model: providerConfig.model,
        messages: messages,
        max_tokens: 200,
        temperature: 0.9,
        top_p: 1,
        seed: seed,
      };

      // Add reasoning_effort for reasoning models
      if (providerConfig.isReasoning) {
        requestBody.reasoning_effort = "medium"; // Options: low, medium, high
      }

      const response = await fetch(providerConfig.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("GenerateText Response status:", response.status);
      const data = await response.json();
      console.log("GenerateText Raw response:", data.choices?.[0]?.message?.content || "No content");
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} - ${data.error?.message || 'No additional details'}`);
      replyText = data.choices?.[0]?.message?.content;

      // For reasoning models, extract final answer (remove thinking/reasoning tags)
      if (providerConfig.isReasoning && replyText) {
        replyText = replyText
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
          .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '')
          .replace(/^(Thinking:|Reasoning:)[\s\S]*?(?=\n\n)/gim, '')
          .trim();
        console.log("Extracted final answer from reasoning model");
      }
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

  try {
    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    selection.removeAllRanges();
    selection.addRange(range);

    // Use execCommand which properly enables send button
    const success = document.execCommand('insertText', false, text);

    if (!success) {
      throw new Error("execCommand failed");
    }

    // Immediately dismiss autocomplete by simulating Escape key
    setTimeout(() => {
      // Press Escape to close autocomplete dropdown
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        code: 'Escape',
        which: 27,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(escapeEvent);
      el.dispatchEvent(escapeEvent);

      // Also try to hide dropdown directly
      const dropdowns = document.querySelectorAll('[data-testid="typeaheadDropdown"], [role="listbox"]');
      dropdowns.forEach(dropdown => {
        dropdown.remove(); // Remove it completely
      });
    }, 50);

    // Place cursor at end
    setTimeout(() => {
      el.focus();
      const sel = window.getSelection();
      const rng = document.createRange();
      rng.selectNodeContents(el);
      rng.collapse(false);
      sel.removeAllRanges();
      sel.addRange(rng);
    }, 100);

  } catch (err) {
    console.error("Text insertion failed:", err);
    // Fallback
    el.textContent = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.focus();
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

  let text = "";
  for (const selector of TWEET_TEXT_SELECTORS) {
    const elements = container.querySelectorAll(selector);
    for (const el of elements) {
      const t = el.innerText.trim();
      if (t && t.length > 5) {
        text = t;
        break;
      }
    }
    if (text) break;
  }

  // Extract images
  const images = extractImagesFromContainer(container);

  return {
    text: text,
    images: images
  };
}

function getTweetTextFromDOM(replyBox) {
  console.log("getTweetTextFromDOM: Starting with replyBox:", replyBox);

  // Try multiple approaches to find the tweet text
  let tweetData = { text: "", images: [] };

  // Helper to merge data
  const mergeData = (newData) => {
    if (newData.text && !tweetData.text) tweetData.text = newData.text;
    if (newData.images && newData.images.length > 0) {
      // Merge unique images by URL
      const existingUrls = new Set(tweetData.images.map(i => i.url));
      for (const img of newData.images) {
        if (!existingUrls.has(img.url)) {
          tweetData.images.push(img);
          existingUrls.add(img.url);
        }
      }
    }
  };

  // Method 1: Look for the tweet in the same article as the reply box
  const article = replyBox.closest("article");
  if (article) {
    const data = extractTweetTextFromContainer(article);
    mergeData(data);
    if (tweetData.text) console.log("getTweetTextFromDOM: Found tweet text within article:", tweetData.text);
  }

  // Method 2: If not found in article, try looking in the dialog
  if (!tweetData.text) {
    const dialog = replyBox.closest('[role="dialog"]');
    if (dialog) {
      const data = extractTweetTextFromContainer(dialog);
      mergeData(data);
      if (tweetData.text) console.log("getTweetTextFromDOM: Found tweet text in dialog:", tweetData.text);
    }
  }

  // Method 3: Try to find the tweet by looking up the DOM tree
  if (!tweetData.text) {
    let parent = replyBox.parentElement;
    while (parent && parent !== document.body) {
      const data = extractTweetTextFromContainer(parent);
      if (data.text) {
        mergeData(data);
        console.log("getTweetTextFromDOM: Found tweet text by traversing up:", tweetData.text);
        break;
      }
      parent = parent.parentElement;
    }
  }

  // Method 4: Last resort - try to find any element with substantial text near the reply box
  if (!tweetData.text) {
    const nearbyElements = document.querySelectorAll('div[data-testid="tweetText"], article[data-testid="tweet"]');
    for (const el of nearbyElements) {
      const data = extractTweetTextFromContainer(el);
      // Fallback for text only if container extraction failed to get text directly but el has innerText
      if (!data.text && el.innerText.trim().length > 5) {
        data.text = el.innerText.trim();
      }

      if (data.text && data.text.length > 5) {
        mergeData(data);
        console.log("getTweetTextFromDOM: Found tweet text as last resort:", tweetData.text);
        break;
      }
    }
  }

  console.log("getTweetTextFromDOM: Final tweet data:", tweetData);
  return tweetData;
}

// ===== ENGAGEMENT SCORE SYSTEM =====

// Parse formatted numbers like "1.2K", "3.5M", "3 rb" (Indonesian) to actual numbers
function parseFormattedNumber(text) {
  if (!text || typeof text !== 'string') return 0;

  text = text.trim();

  // Handle Indonesian "rb" (ribu = thousand) and "jt" (juta = million)
  // Also handle English K, M, B
  const multipliers = {
    'RB': 1000,      // Indonesian: ribu (thousand)
    'JT': 1000000,   // Indonesian: juta (million)
    'K': 1000,       // English: thousand
    'M': 1000000,    // English: million
    'B': 1000000000  // English: billion
  };

  // Match patterns like "3.5K", "3 rb", "3.981" (with period as separator)
  const match = text.match(/^([\d.,]+)\s*([a-zA-Z]+)?$/i);

  if (!match) return parseInt(text.replace(/[.,]/g, '')) || 0;

  let numberPart = match[1];
  const suffix = match[2] ? match[2].toUpperCase() : '';

  // Remove commas (used as thousand separators in English)
  numberPart = numberPart.replace(/,/g, '');

  // Check if period is used as thousand separator (Indonesian/European format)
  // Examples: "3.981" = 3981, "1.234.567" = 1234567
  // vs decimal: "3.5" = 3.5
  const periodCount = (numberPart.match(/\./g) || []).length;

  if (periodCount > 1) {
    // Multiple periods = thousand separators
    numberPart = numberPart.replace(/\./g, '');
  } else if (periodCount === 1) {
    // Single period - check if it's a separator or decimal
    const parts = numberPart.split('.');
    if (parts[1] && parts[1].length === 3) {
      // Format like "3.981" (thousand separator)
      numberPart = numberPart.replace('.', '');
    }
    // Otherwise it's a decimal like "3.5" - keep the period
  }

  const number = parseFloat(numberPart);
  const multiplier = multipliers[suffix] || 1;

  return number * multiplier; // Return precise number, don't floor
}

// Extract engagement metrics from a tweet article element
function extractTweetMetrics(article) {
  const metrics = {
    comments: 0,
    reposts: 0,
    likes: 0,
    views: 0,
    timestamp: null,
    hoursAgo: 0
  };

  try {
    // Find engagement buttons group
    const engagementGroup = article.querySelector('[role="group"]');
    if (!engagementGroup) {
      console.log('⚠️ No engagement group found in tweet');
      return metrics;
    }

    console.log('✅ Found engagement group');

    // Extract metrics using button position (language-agnostic)
    // Twitter's button order is consistent: Reply, Repost, Like, View/Share
    const buttons = engagementGroup.querySelectorAll('[role="button"]');
    console.log(`📊 Found ${buttons.length} engagement buttons`);

    buttons.forEach((button, index) => {
      const ariaLabel = button.getAttribute('aria-label') || '';
      console.log(`  Button ${index}: "${ariaLabel}"`);

      // Extract the first number from the aria-label (works in any language)
      const match = ariaLabel.match(/^(\d+[\d,KMB.]*)/i);

      if (match) {
        const value = parseFormattedNumber(match[1]);

        // Twitter's button order is always: Reply, Repost, Like, View/Share
        switch (index) {
          case 0: // Reply button
            metrics.comments = value;
            console.log(`    → Replies: ${metrics.comments}`);
            break;
          case 1: // Repost button
            metrics.reposts = value;
            console.log(`    → Reposts: ${metrics.reposts}`);
            break;
          case 2: // Like button
            metrics.likes = value;
            console.log(`    → Likes: ${metrics.likes}`);
            break;
          case 3: // View count (if present)
            // Some tweets show view count here
            metrics.views = value;
            console.log(`    → Views: ${metrics.views}`);
            break;
        }
      }
    });
    // Enhanced view count detection - LANGUAGE AGNOSTIC
    // No text matching, only DOM structure-based detection
    if (!metrics.views || metrics.views === 0) {
      console.log('🔍 Trying language-agnostic view count detection...');

      // Strategy 1: Analytics link (most reliable)
      const analyticsLink = article.querySelector('a[href*="/analytics"]');
      if (analyticsLink) {
        const viewText = analyticsLink.textContent || '';
        console.log(`  Strategy 1 (analytics link): "${viewText}"`);
        const viewMatch = viewText.match(/([\d.,]+)\s*([a-zA-Z]+)?/i);
        if (viewMatch) {
          const fullNumber = viewMatch[0].trim();
          metrics.views = parseFormattedNumber(fullNumber);
          console.log(`    → Views found: ${metrics.views}`);
        }
      }

      // Strategy 2: Transition containers (fallback)
      if (!metrics.views || metrics.views === 0) {
        const transitionContainers = article.querySelectorAll('[data-testid="app-text-transition-container"]');
        for (const container of transitionContainers) {
          const viewText = container.textContent || '';
          console.log(`  Strategy 2 (transition container): "${viewText}"`);

          // Extract number pattern
          const viewMatch = viewText.match(/([\d.,]+)\s*([a-zA-Z]+)?/i);
          if (viewMatch) {
            const fullNumber = viewMatch[0].trim();
            const possibleViews = parseFormattedNumber(fullNumber);

            // Heuristic: View counts are usually much higher than other metrics
            // Skip if the number looks too similar to likes/reposts (likely not views)
            if (possibleViews > metrics.likes * 2 || possibleViews > 1000) {
              metrics.views = possibleViews;
              console.log(`    → Views found: ${metrics.views}`);
              break;
            }
          }
        }
      }

      // Strategy 3: Search near engagement buttons (last resort)
      if (!metrics.views || metrics.views === 0) {
        // Look for numbers that appear after the engagement buttons
        const allLinks = article.querySelectorAll('a');
        for (const link of allLinks) {
          const href = link.getAttribute('href') || '';
          // Skip navigation links, only check potential analytics/view links
          if (href.includes('/status/') || href.includes('/analytics')) {
            const text = link.textContent || '';
            const numberMatch = text.match(/([\d.,]+)\s*([a-zA-Z]+)?/i);
            if (numberMatch) {
              const fullNumber = numberMatch[0].trim();
              const possibleViews = parseFormattedNumber(fullNumber);

              // Only accept if it's larger than engagement metrics
              if (possibleViews > Math.max(metrics.likes, metrics.reposts, metrics.comments)) {
                metrics.views = possibleViews;
                console.log(`  Strategy 3 (link search): "${text}" → Views: ${metrics.views}`);
                break;
              }
            }
          }
        }
      }
    }

    // Extract timestamp - exclude quoted tweets
    // Quoted tweets are typically in a div with specific attributes
    let timeElement = null;
    const allTimeElements = article.querySelectorAll('time');

    for (const time of allTimeElements) {
      // Check if this time element is inside a quoted tweet
      // Quoted tweets usually have a specific parent structure
      const isInQuotedTweet = time.closest('[role="link"]')?.querySelector('[data-testid="tweetText"]');

      if (!isInQuotedTweet) {
        // This is the main tweet's timestamp
        timeElement = time;
        break;
      }
    }

    // Fallback: if we didn't find one, use the last time element (main tweet is usually last)
    if (!timeElement && allTimeElements.length > 0) {
      timeElement = allTimeElements[allTimeElements.length - 1];
    }

    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        metrics.timestamp = new Date(datetime);
        const now = new Date();
        metrics.hoursAgo = (now - metrics.timestamp) / (1000 * 60 * 60);
        console.log(`⏰ Tweet age: ${metrics.hoursAgo.toFixed(1)} hours`);
      }
    }
  } catch (error) {
    console.error('❌ Error extracting tweet metrics:', error);
  }

  console.log('📈 Final metrics:', metrics);
  return metrics;
}

// Calculate engagement score based on the specified algorithm
function calculateEngagementScore(metrics) {
  const { comments, reposts, likes, views, hoursAgo } = metrics;

  // 1. Base Engagement Metrics (Logarithmic Scale)
  const commentScore = 3 * Math.log(comments + 1);
  const repostScore = 2.5 * Math.log(reposts + 1);
  const likeScore = 2 * Math.log(likes + 1);
  const viewScore = 1.5 * Math.log(views / 100 + 1);

  // 2. Time Decay Factor
  const timeFactor = 1 + Math.exp(-hoursAgo / 2);

  // 3. Engagement Velocity
  const velocity = (comments + reposts + likes) / (hoursAgo + 0.1);
  const velocityScore = 5 * Math.log(velocity + 1);

  // 4. Engagement Quality Ratio
  const totalEngagement = comments + reposts + likes;
  const qualityRatio = totalEngagement > 0 ? (comments + reposts) / totalEngagement : 0;
  const qualityScore = 10 * qualityRatio;

  // 5. Final Score
  const rawScore = commentScore + repostScore + likeScore + viewScore;
  const finalScore = Math.min(100, rawScore * timeFactor + velocityScore + qualityScore);

  return {
    score: Math.ceil(Math.max(1, finalScore)), // Always round up
    breakdown: {
      commentScore,
      repostScore,
      likeScore,
      viewScore,
      timeFactor,
      velocityScore,
      qualityScore,
      rawScore
    }
  };
}

// Get score badge emoji and color based on score
function getScoreBadgeStyle(score) {
  if (score >= 80) {
    return { emoji: '🔥', color: '#ef4444', borderColor: '#ef4444', label: 'Viral' };
  } else if (score >= 50) {
    return { emoji: '⚡', color: '#f97316', borderColor: '#f97316', label: 'Potential' };
  } else {
    return { emoji: '💤', color: '#6b7280', borderColor: '#6b7280', label: 'Low Engagement' };
  }
}

// Format time ago string
function formatTimeAgo(hoursAgo) {
  if (hoursAgo < 1) {
    const minutes = Math.floor(hoursAgo * 60);
    return `${minutes}m ago`;
  } else if (hoursAgo < 24) {
    return `${Math.floor(hoursAgo)}h ago`;
  } else {
    const days = Math.floor(hoursAgo / 24);
    return `${days}d ago`;
  }
}

// Create score badge element
function createScoreBadge(score, metrics) {
  const style = getScoreBadgeStyle(score);

  const badge = document.createElement('div');
  badge.className = 'engagement-score-badge';
  badge.setAttribute('data-score', score);

  Object.assign(badge.style, {
    position: 'absolute',
    top: '8px', // Back to top
    right: '12px', // Right side with padding
    backgroundColor: style.color, // Full color background
    border: 'none', // No border
    borderRadius: '12px',
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'white',
    zIndex: 10,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: `0 2px 8px rgba(0,0,0,0.3)`
  });

  badge.innerHTML = `<span>${style.emoji}</span><span>${score}</span>`;

  // Add hover effect - brighten on hover
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.08)';
    badge.style.boxShadow = `0 4px 16px ${style.color}99`;
    badge.style.filter = 'brightness(1.15)';
  });

  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
    badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    badge.style.filter = 'brightness(1)';
  });

  // Create and attach tooltip
  const tooltip = createTooltip(metrics, score, style);
  badge.appendChild(tooltip);

  badge.addEventListener('mouseenter', () => {
    tooltip.style.display = 'block';
  });

  badge.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });

  return badge;
}

// Create detailed tooltip
function createTooltip(metrics, score, style) {
  const tooltip = document.createElement('div');
  tooltip.className = 'engagement-score-tooltip';

  Object.assign(tooltip.style, {
    display: 'none',
    position: 'absolute',
    top: '100%',
    right: '0',
    marginTop: '8px',
    backgroundColor: '#15202b',
    border: '1px solid #38444d',
    borderRadius: '8px',
    padding: '12px',
    minWidth: '200px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    fontSize: '12px',
    color: '#e6ecf0',
    zIndex: 100,
    whiteSpace: 'nowrap'
  });

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Format view count with comma separators for precision
  const formatViews = (num) => {
    return Math.round(num).toLocaleString('en-US');
  };

  const timeAgo = formatTimeAgo(metrics.hoursAgo);

  tooltip.innerHTML = `
    <div style="margin-bottom:8px;font-weight:bold;color:${style.color};">
      ${style.emoji} ${style.label} (${score})
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div>💬 Replies: ${formatNumber(metrics.comments)}</div>
      <div>🔄 Reposts: ${formatNumber(metrics.reposts)}</div>
      <div>❤️ Likes: ${formatNumber(metrics.likes)}</div>
      <div>👀 Views: ${formatViews(metrics.views)}</div>
      <div style="margin-top:4px;padding-top:4px;border-top:1px solid #38444d;">
        ⏰ ${timeAgo}
      </div>
      <div style="margin-top:4px;padding-top:4px;border-top:1px solid #38444d;font-style:italic;color:#8899a6;">
        ${score >= 80 ? '💡 High engagement! Great opportunity' :
      score >= 50 ? '💡 Worth considering for engagement' :
        '💡 Consider if worth engaging'}
      </div>
    </div>
  `;

  return tooltip;
}

// Apply visual border to tweet
function applyVisualIndicators(article, score) {
  // Borders and visual effects disabled per user request
  // Only the badge shows the engagement score
  return;
}

// Process a single tweet article for engagement scoring
function processTweetForEngagement(article) {
  // Skip if already processed
  if (article.hasAttribute('data-engagement-processed')) return;
  article.setAttribute('data-engagement-processed', 'true');

  console.log('Processing tweet for engagement score...');

  // Extract metrics
  const metrics = extractTweetMetrics(article);

  console.log('Extracted metrics:', metrics);

  // Don't skip tweets - even low/zero engagement tweets should get a score
  // The algorithm will naturally give them a low score

  // Calculate score
  const { score, breakdown } = calculateEngagementScore(metrics);

  // Store score on element
  article.setAttribute('data-engagement-score', score);

  // Create and add badge
  const badge = createScoreBadge(score, metrics);

  // Ensure article has relative or absolute positioning for badge placement
  const currentPosition = window.getComputedStyle(article).position;
  if (currentPosition === 'static') {
    article.style.position = 'relative';
  }

  // Add padding to top of article to make space for the badge
  // This prevents the badge from overlapping with the three-dot menu or other buttons
  const currentPaddingTop = window.getComputedStyle(article).paddingTop;
  const currentPadding = parseInt(currentPaddingTop) || 0;
  article.style.paddingTop = `${Math.max(currentPadding, 40)}px`; // Ensure at least 40px space

  // Append badge directly to article
  article.appendChild(badge);

  console.log(`Added engagement badge to tweet with score: ${score}`);

  // Apply visual indicators
  applyVisualIndicators(article, score);

  console.log(`Engagement score for tweet: ${score}`, metrics, breakdown);
}

// Apply engagement scores to all tweets on page
function applyEngagementScoresToAllTweets() {
  const settings = settingsCache;

  // Skip if feature is disabled
  if (!settings.showEngagementScore) {
    console.log('Engagement scores disabled in settings');
    return;
  }

  // Find all tweet articles
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');

  console.log(`Found ${tweets.length} tweets to process`);

  tweets.forEach(tweet => {
    processTweetForEngagement(tweet);
  });
}

// Toggle engagement scores visibility
function toggleEngagementScores(enabled) {
  settingsCache.showEngagementScore = enabled;

  const badges = document.querySelectorAll('.engagement-score-badge');
  const processedTweets = document.querySelectorAll('[data-engagement-processed]');

  if (enabled) {
    // Show badges
    badges.forEach(badge => {
      badge.style.display = 'flex';
    });

    // Restore borders
    processedTweets.forEach(tweet => {
      const score = parseInt(tweet.getAttribute('data-engagement-score'));
      if (score) {
        applyVisualIndicators(tweet, score);
      }
    });

    // Process any new tweets
    applyEngagementScoresToAllTweets();
  } else {
    // Hide badges
    badges.forEach(badge => {
      badge.style.display = 'none';
    });

    // Remove borders
    processedTweets.forEach(tweet => {
      const originalBorder = tweet.getAttribute('data-original-border') || '';
      tweet.style.border = originalBorder;
      tweet.style.boxShadow = '';
    });
  }
}

// Listen for messages from popup
if (chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'toggleEngagementScore') {
      toggleEngagementScores(message.enabled);
      sendResponse({ success: true });
    }
  });
}

document.addEventListener("click", (e) => {
  const floatingWin = document.getElementById("ai-floating-replies-window");
  if (floatingWin && !floatingWin.contains(e.target)) {
    floatingWin.style.display = "none";
    floatingWin.innerHTML = "";
  }
});

// Initialize: Load settings and start processing
console.log('📊 Initializing Engagement Score System...');

loadSettings().then(() => {
  console.log('✅ Settings loaded:', settingsCache);
  console.log('🎯 Engagement scores enabled:', settingsCache.showEngagementScore);

  // Apply engagement scores initially
  console.log('🔍 Applying initial engagement scores...');
  applyEngagementScoresToAllTweets();

  // Set up MutationObserver for dynamically loaded tweets
  const observer = new MutationObserver((mutations) => {
    if (settingsCache.showEngagementScore) {
      applyEngagementScoresToAllTweets();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('👀 MutationObserver set up for dynamic tweets');
}).catch((error) => {
  console.error('❌ Failed to initialize engagement scores:', error);
});

// Re-insert buttons every 3 seconds
setInterval(() => {
  insertButtonIntoReplyBoxes();
}, 3000);

// Re-apply engagement scores every 5 seconds for new tweets
setInterval(() => {
  if (settingsCache.showEngagementScore) {
    applyEngagementScoresToAllTweets();
  }
}, 5000);

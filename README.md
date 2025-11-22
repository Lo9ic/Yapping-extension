# Auto Yapping by Lo9ic

Browser extension for Twitter/X that adds an AI reply button to tweet reply boxes. Generates short, in-language replies using your chosen LLM provider.

## Features
- Reply button injected into Twitter/X reply boxes with floating preview and one-click insert.
- Provider switcher with per-provider keys: Groq (llama-3.1-8b-instant), OpenAI (gpt-4o-mini), Gemini (1.5-flash).
- Custom prompt (blank by default) stored locally via `chrome.storage.sync`.
- Options page and toolbar popup to manage provider, API keys, and prompt.

## Setup (Chrome/Edge)
1) Download/clone this folder.  
2) `chrome://extensions` → enable Developer Mode → Load unpacked → select the folder.  
3) Pin the extension icon if desired.

## Configure
1) Click the toolbar icon or open the extension’s Options.  
2) Choose a provider.  
3) Enter the provider’s API key.  
4) (Optional) Add your prompt; leave blank to send none.  
5) Save.

## Usage
1) Open a tweet, click into the reply box.  
2) Click “AI Reply.”  
3) The floating window shows the generated reply; click Insert or wait for auto-insert.

## Notes
- Data is sent only to the selected provider’s API; no storage beyond your browser’s `chrome.storage.sync`.  
- If no API key is set, you’ll be prompted to open settings before generating.  
- This repo is linked to `https://github.com/Lo9ic/Yapping-extension`.

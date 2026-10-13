# IncoScord AI v2

A small Node.js web app with OpenAI Responses API chat, web search, vision input, image generation, and optional Sora video generation.

## Run locally
1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
3. Set the variables in your shell/hosting dashboard (Node does not load `.env` automatically without a dotenv package).
   - macOS/Linux: `export OPENAI_API_KEY="your-key"`
   - Windows PowerShell: `$env:OPENAI_API_KEY="your-key"`
4. Run `npm start` and open `http://localhost:3000`.
5. In Settings, use endpoint `/api/chat`, model `gpt-5`, and save. Leave the API key field empty; the server reads the secret from its environment.

## Features
- Task modes for research, study/tutoring, writing, coding, summarizing, planning, and general chat.
- Search-first control: use required web search for each answer, or let the model choose when search is needed. Search is available in server mode either way.
- Analyze images, sampled video frames, and text/code files (`.txt`, `.md`, `.csv`, `.json`, common source files and logs). Text documents are capped at 50,000 characters per file; PDFs and office documents are not parsed by this build.
- Export all chats and memory as a JSON backup, export the active chat as text, or erase local chats, settings, and memory. API keys are excluded from the backup.
- `/api/chat`: Responses API + web_search tool. With search-first enabled, web search is required; with it disabled, the model can choose whether to search.
- Photos and sampled video frames can be sent from the existing chat composer to a vision-capable model. Browser frame sampling is visual-only; audio is not analyzed.
- `/api/image`: image generation via the Responses API image_generation tool.
- `/api/video`: creates an asynchronous video job (default model `sora-2`); `/api/video/{id}` checks status. Availability depends on API account/model access.
- Browser voice chat: click **Voice chat**, grant microphone access, speak a question, and the reply is spoken aloud before listening again. Assistant messages also have **Read aloud**. It uses browser Web Speech APIs, so speech-recognition support varies by browser and voice services may be handled by the browser/provider rather than this server. HTTPS (or localhost) is required for microphone access.
- Long-term memory is user-editable and stored in this browser's localStorage. It is injected as context, not used to train or update model weights.
- Chats are stored locally in this browser.

## Privacy and limits
- Chats, preferences, task mode, and memory are stored in this browser's localStorage. They do not sync across devices. The JSON backup excludes API keys. Erasing local data does not delete information already received by an AI provider.
- Text/code document uploads are passed to the model in the request and capped at 50,000 characters per file. Video processing samples a handful of frames and does not analyze audio. PDF/Word parsing is not included.
- Voice recognition and spoken playback use browser APIs. Voice audio is not sent to the IncoScord `/api/chat` endpoint by this feature, but the browser speech-recognition service may process it under the browser/provider's own policies.

## Important limits / deployment
- The app cannot promise literally unlimited answers or guaranteed truth. The model/provider still has safety and capability limits; web search reduces but does not eliminate errors.
- This backend has no user accounts, rate limiting, or database. Do not expose it publicly as-is. Before public deployment, add authentication, rate limiting, per-user quotas, CSRF protections as appropriate, and a secure persistent database.
- API usage can incur charges. Check your OpenAI Platform billing and model access.
- Never put an API key in `index.html`, a public GitHub repo, or a client-side setting on a public site.
- Memory is local to one browser/device unless you build a backend database. It does not automatically fine-tune the model. Fine-tuning is a separate workflow requiring prepared examples and supported models.

## Publish as a live website (Render)

This repository includes `render.yaml` for a one-click Blueprint deployment:

1. Upload this project folder to a GitHub repository.
2. Sign in to Render and choose **New → Blueprint**, then connect that repository.
3. When prompted, add `OPENAI_API_KEY` as a secret environment variable in Render. Never put it in `index.html` or commit it to GitHub.
4. Deploy. Render will provide a public HTTPS URL; HTTPS is needed for browser microphone access.
5. Open the URL and use Settings with endpoint `/api/chat`. Leave the browser API key blank; the server uses its environment secret.

**Before sharing publicly:** this starter app does not include user accounts or per-user quotas. Anyone who can access it may be able to use your configured API key through the app and create usage charges. Add authentication and rate limiting, or restrict access, before publishing it widely. Hosting plans and free-tier limits can change; check the host's current terms.

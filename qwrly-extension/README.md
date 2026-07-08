# QWRLY — Cyber Threat Shield

A Chrome extension (Manifest V3) that scans Gmail, links, QR codes, and
forwarded SMS for phishing/malware, with one-tap complaint filing and a
Retell AI voice-based incident report flow.

## Load the extension

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (the one containing `manifest.json`)
5. On first install, an onboarding/sign-in tab opens automatically

## Run the backend

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The extension talks to `http://localhost:8000` by default — change this in
the extension's **Settings** tab if you deploy the backend elsewhere (e.g.
an ngrok URL, needed for Twilio/Retell webhooks to reach your machine).

## Wiring up the real integrations

| Feature | What you need to do |
|---|---|
| **Gmail scanning** | In Google Cloud Console, create an OAuth client (type: Chrome Extension), enable the Gmail API, add yourself as a test user, then paste the client ID into `manifest.json`'s `oauth2.client_id`. |
| **Link/QR reputation** | Set `SAFE_BROWSING_API_KEY` and/or `VIRUSTOTAL_API_KEY` as environment variables before starting the backend. Without them, the backend falls back to heuristics (suspicious TLDs, shorteners, raw IPs). |
| **Twilio SMS** | Buy a Twilio number, point its "A message comes in" webhook at `https://<your-backend>/twilio/sms-webhook`, and enter the number in Settings so it displays in the dashboard. |
| **Retell AI voice calls** | Set `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_FROM_NUMBER` env vars. In the Retell dashboard, point your agent's webhook at `https://<your-backend>/retell/webhook` so post-call analysis gets filed as a complaint automatically. |

If the backend isn't reachable, the dashboard's Retell panel falls back to
a clearly-labeled demo script so the flow is still explainable live.

## Folder structure

```
manifest.json
icons/              — QWRLY logo, generated at 16/32/48/128px
popup/              — toolbar popup (quick scan + complaint button)
content/            — injected into mail.google.com: link scanning + floating report button
background/         — service worker: scans, OAuth, alarms, notifications
dashboard/          — full dashboard (Overview, Gmail, SMS, Sandbox, Retell, Complaints, Settings)
onboarding/         — first-run sign-in screen
backend/            — FastAPI skeleton implementing every endpoint the extension calls
```

## Known limitations (by design, not oversight)

- Browsers cannot read a phone's native SMS — the SMS feature works via
  **Twilio number forwarding**, not by reading the user's real inbox.
- Gmail's sensitive scope requires either test-user mode (fine for a demo)
  or a full Google security review to go public.
- Retell AI calls are a paid service and need a provisioned phone number.

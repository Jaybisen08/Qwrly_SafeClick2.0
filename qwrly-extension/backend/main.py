"""
QWRLY backend — FastAPI skeleton wired to the endpoints the extension calls.

Run:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Environment variables (set these for the real integrations to work — the
app runs fine without them but falls back to heuristics / demo mode):
    SAFE_BROWSING_API_KEY   - Google Safe Browsing API key
    VIRUSTOTAL_API_KEY      - VirusTotal API key
    RETELL_API_KEY          - Retell AI API key
    RETELL_AGENT_ID         - default Retell agent to use for calls
    RETELL_FROM_NUMBER      - the Retell-provisioned outbound caller ID
    TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN - only needed if you validate
                                              Twilio's webhook signature
"""

import os
import re
import sqlite3
from datetime import datetime
from typing import Optional

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="QWRLY backend")

# The extension runs from a chrome-extension:// origin — CORS must allow it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "qwrly.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT,
            description TEXT,
            artifact TEXT,
            occurred_at TEXT,
            status TEXT DEFAULT 'under_review',
            created_at TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            source TEXT,
            verdict TEXT,
            reason TEXT,
            created_at TEXT
        )
    """)
    conn.commit()
    conn.close()


init_db()

SUSPICIOUS_TLDS = {".xyz", ".top", ".info", ".click", ".gq", ".tk"}
URL_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd"}


# ----------------------------------------------------------------------
# URL / QR scanning
# ----------------------------------------------------------------------
class ScanRequest(BaseModel):
    url: str
    source: Optional[str] = "unknown"


async def check_safe_browsing(url: str) -> Optional[str]:
    api_key = os.environ.get("SAFE_BROWSING_API_KEY")
    if not api_key:
        return None
    endpoint = f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={api_key}"
    payload = {
        "client": {"clientId": "qwrly", "clientVersion": "1.0.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.post(endpoint, json=payload)
        data = resp.json()
        if data.get("matches"):
            return f"Google Safe Browsing: {data['matches'][0]['threatType']}"
    return None


async def check_virustotal(url: str) -> Optional[str]:
    api_key = os.environ.get("VIRUSTOTAL_API_KEY")
    if not api_key:
        return None
    import base64
    url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
    endpoint = f"https://www.virustotal.com/api/v3/urls/{url_id}"
    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.get(endpoint, headers={"x-apikey": api_key})
        if resp.status_code == 200:
            stats = resp.json()["data"]["attributes"]["last_analysis_stats"]
            if stats.get("malicious", 0) > 0:
                return f"VirusTotal: {stats['malicious']} engines flagged this URL"
    return None


def heuristic_check(url: str) -> Optional[str]:
    lowered = url.lower()
    for tld in SUSPICIOUS_TLDS:
        if lowered.rstrip("/").endswith(tld) or f"{tld}/" in lowered:
            return f"Suspicious top-level domain ({tld})"
    domain_match = re.search(r"https?://([^/]+)", lowered)
    if domain_match and domain_match.group(1) in URL_SHORTENERS:
        return "URL shortener — destination is hidden"
    if re.search(r"https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}", lowered):
        return "Raw IP address used instead of a domain name"
    return None


@app.post("/scan-url")
async def scan_url(req: ScanRequest):
    reason = await check_safe_browsing(req.url)
    if not reason:
        reason = await check_virustotal(req.url)
    if not reason:
        reason = heuristic_check(req.url)

    verdict = "malicious" if reason else "clean"

    conn = get_db()
    conn.execute(
        "INSERT INTO scans (url, source, verdict, reason, created_at) VALUES (?, ?, ?, ?, ?)",
        (req.url, req.source, verdict, reason, datetime.utcnow().isoformat()),
    )
    conn.commit()
    conn.close()

    return {"verdict": verdict, "reason": reason}


# ----------------------------------------------------------------------
# Complaints
# ----------------------------------------------------------------------
class ComplaintRequest(BaseModel):
    source: str
    description: str
    artifact: Optional[str] = None
    occurred_at: Optional[str] = None


@app.post("/complaints")
async def file_complaint(req: ComplaintRequest):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO complaints (source, description, artifact, occurred_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (req.source, req.description, req.artifact, req.occurred_at, datetime.utcnow().isoformat()),
    )
    conn.commit()
    complaint_id = cur.lastrowid
    conn.close()
    return {"id": complaint_id, "status": "under_review"}


@app.get("/complaints")
async def list_complaints():
    conn = get_db()
    rows = conn.execute("SELECT * FROM complaints ORDER BY id DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]


# ----------------------------------------------------------------------
# Twilio SMS webhook — Twilio POSTs form-encoded data, not JSON
# ----------------------------------------------------------------------
@app.post("/twilio/sms-webhook")
async def twilio_sms_webhook(request: Request):
    form = await request.form()
    from_number = form.get("From", "unknown")
    body = form.get("Body", "")

    urls = re.findall(r"https?://[^\s]+", body)
    results = []
    for url in urls:
        reason = heuristic_check(url) or await check_safe_browsing(url) or await check_virustotal(url)
        results.append({"url": url, "verdict": "malicious" if reason else "clean", "reason": reason})

    return {"from": from_number, "body": body, "scanned_links": results}


# ----------------------------------------------------------------------
# Gmail polling — stub. Swap in a real Gmail API call using the OAuth
# token the extension retrieved via chrome.identity, or set up Gmail
# push notifications via Pub/Sub for a live feed instead of polling.
# ----------------------------------------------------------------------
@app.post("/gmail/poll")
async def gmail_poll():
    return {"status": "ok", "new_messages_scanned": 0}


# ----------------------------------------------------------------------
# Retell AI — start an outbound call, and receive the post-call webhook
# ----------------------------------------------------------------------
class RetellCallRequest(BaseModel):
    agent_id: Optional[str] = None
    phone_number: Optional[str] = None


@app.post("/retell/start-call")
async def retell_start_call(req: RetellCallRequest):
    api_key = os.environ.get("RETELL_API_KEY")
    agent_id = req.agent_id or os.environ.get("RETELL_AGENT_ID")
    from_number = os.environ.get("RETELL_FROM_NUMBER")

    if not api_key or not agent_id or not req.phone_number:
        return {
            "status": "not_configured",
            "detail": "Set RETELL_API_KEY / RETELL_AGENT_ID env vars and a phone number in Settings to place a real call.",
        }

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            "https://api.retellai.com/v2/create-phone-call",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "from_number": from_number,
                "to_number": req.phone_number,
                "override_agent_id": agent_id,
            },
        )
        if resp.status_code >= 300:
            return {"status": "error", "detail": resp.text}
        return {"status": "calling", "call": resp.json()}


@app.post("/retell/webhook")
async def retell_webhook(request: Request):
    """Retell posts call events here, including post-call analysis once the
    call ends. Configure this URL (via ngrok in development) in the Retell
    dashboard's webhook settings."""
    payload = await request.json()

    if payload.get("event") == "call_analyzed":
        analysis = payload.get("call", {}).get("call_analysis", {}).get("custom_analysis_data", {})
        conn = get_db()
        conn.execute(
            "INSERT INTO complaints (source, description, artifact, occurred_at, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                "voice_report",
                analysis.get("incident_type", "Reported via voice call"),
                analysis.get("artifact"),
                analysis.get("occurred_at"),
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
        conn.close()

    return {"received": True}

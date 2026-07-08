# 🛡️ QWRLY – AI Powered Cyber Threat Detection & Reporting System

<p align="center">
  <img src="icons/icon128.png" alt="QWRLY Logo" width="120">
</p>

<p align="center">
  <b>Real-Time AI Powered Protection Against Phishing, Malicious QR Codes, Fraudulent SMS, and Cyber Scam Reporting.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge">
  <img src="https://img.shields.io/badge/Platform-Chrome_Extension-blue?style=for-the-badge">
  <img src="https://img.shields.io/badge/Backend-FastAPI-green?style=for-the-badge">
  <img src="https://img.shields.io/badge/License-MIT-orange?style=for-the-badge">
</p>

---

# 📌 Overview

QWRLY is an AI-powered cyber security platform developed for **Safe Click Hackathon 2.0** to help users detect and report cyber fraud in real time.

The platform combines a Chrome Extension, AI-powered threat analysis, phishing detection, QR code verification, SMS monitoring, voice-based cyber complaint reporting, and an intelligent dashboard into a single security ecosystem.

QWRLY empowers users to identify malicious websites, suspicious QR codes, phishing emails, fraudulent SMS messages, and cyber scams before they become victims.

---

# 🚀 Key Features

### 🔗 AI URL Scanner
- Detects phishing and malicious URLs
- Google Safe Browsing Integration
- VirusTotal Integration
- Intelligent heuristic analysis

---

### 📱 QR Code Security
- Scan QR codes before opening
- Detect hidden malicious links
- Prevent QR phishing attacks

---

### 📧 Gmail Threat Scanner
- Detect suspicious emails
- Identify phishing attempts
- Secure Gmail integration

---

### 📲 SMS Protection
- Analyze forwarded SMS
- Detect scam messages
- Suspicious link extraction

---

### 🎙️ AI Voice Complaint Assistant
- Voice-guided cyber incident reporting
- Automated complaint registration
- Structured incident collection

---

### 📊 Threat Operations Dashboard
- Live threat monitoring
- Complaint management
- Scan history
- Backend status
- Security analytics

---

# 🏗️ System Architecture

```
Chrome Extension
        │
        ▼
Background Service Worker
        │
        ▼
FastAPI Backend
        │
 ┌──────┼──────────┐
 ▼      ▼          ▼
Google  VirusTotal Retell AI
Safe
Browsing
```

---

# 🛠️ Tech Stack

## Frontend
- HTML5
- CSS3
- JavaScript (ES6)

## Backend
- FastAPI
- Python
- SQLite (Development)
- REST API

## APIs & Services
- Google Safe Browsing API
- VirusTotal API
- Gmail API
- Retell AI
- Twilio
- Chrome Extension APIs

## Deployment
- Vercel
- GitHub

---

# 📂 Project Structure

```
QWRLY/
│
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── qwrly.db
│   └── vercel.json
│
├── background/
│   └── background.js
│
├── content/
│   ├── content.js
│   └── content.css
│
├── dashboard/
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.js
│
├── popup/
│
├── onboarding/
│
├── icons/
│
├── manifest.json
│
└── README.md
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/Jaybisen08/Qwrly_SafeClick2.0.git
```

```
cd Qwrly_SafeClick2.0
```

---

## Backend Setup

```
cd backend
```

Install dependencies

```bash
pip install -r requirements.txt
```

Run FastAPI

```bash
uvicorn main:app --reload
```

---

## Chrome Extension Setup

1. Open Chrome

2. Go to

```
chrome://extensions/
```

3. Enable

```
Developer Mode
```

4. Click

```
Load Unpacked
```

5. Select the project folder

---

# 🔑 Environment Variables

Create a `.env` file inside the backend directory.

```
SAFE_BROWSING_API_KEY=

VIRUSTOTAL_API_KEY=

RETELL_API_KEY=

RETELL_AGENT_ID=

RETELL_FROM_NUMBER=
```

---

# 🌐 API Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| GET | / | Backend Status |
| POST | /scan-url | Scan URL |
| POST | /complaints | Register Complaint |
| GET | /complaints | Complaint List |
| POST | /gmail/poll | Gmail Scanner |
| POST | /retell/start-call | Start AI Call |
| POST | /retell/webhook | Retell Webhook |
| POST | /twilio/sms-webhook | SMS Webhook |

---

# 📷 Screenshots

### Dashboard

_Add dashboard screenshot here_

---

### Chrome Extension

_Add popup screenshot here_

---

### Threat Detection

_Add scanning screenshot here_

---

# 🔒 Security Features

- Phishing Detection
- Malicious URL Detection
- QR Code Verification
- Gmail Threat Detection
- SMS Scam Detection
- Voice-Based Complaint Reporting
- Secure API Communication
- Chrome Extension Sandbox

---

# 🎯 Future Scope

- AI-powered Email Summarization
- Browser-wide Threat Protection
- Android Application
- Multi-language Voice Assistant
- Government Cyber Crime Portal Integration
- Real-Time Threat Intelligence Dashboard

---

# 👨‍💻 Team

### Himanshu Verma
**Team Leader**

📞 +91 9682382562

📧 himuverma154@gmail.com

---

### Jay Bisen
**Full Stack Developer**

📞 +91 8827745686

📧 jaybisen2006@gmail.com

---

# 🏆 Hackathon

**Safe Click Hackathon 2.0**

Theme:
**AI-Powered QR Code & Phishing Detection**

---

# 📄 License

This project is developed for educational and hackathon purposes.

---

# ⭐ Support

If you found this project useful, consider giving it a ⭐ on GitHub.

---

<p align="center">

Made with ❤️ by **Team Trojans**

**Building a Safer Digital Future**

</p>

# CampusGuard — Zero-Login AI-Powered Campus Facility & Incident Reporting System

> Reactive web application implementing the complete technical specification from the **"Technical Report and Data Design Specification: Zero-Login AI-Powered Campus Facility & Incident Reporting System"**.

---

## 🏗️ Architecture & Features Implemented

### 1. Zero-Login & Frictionless Multi-Channel Intake (§1.0 – §2.3)
- **Zero Registration Barrier:** Submissions decoupled from identity. No PRNs, no institutional emails, no password forms.
- **Universal Accessibility Design (§2.2):** Icon-driven navigation for plumbing, electrical, sanitation, structural, safety, and general categories.
- **Push-to-Talk Voice Ingestion (§2.1):** One-touch voice note recording with simulated Speech-to-Text (Whisper STT) transcription for custodial and non-tech support staff (*aayas*).
- **Camera-First Visual Intake (§2.1):** Direct media upload with simulated **Edge EXIF Scrubbing** (stripping camera model, GPS coordinates, and timestamps) before storage.
- **PostGIS Geofencing Validation (§2.3):** Validates point-in-polygon boundary (`ST_Contains`) to block off-site spam while permitting campus-internal reports.
- **Title IX & Statutory Non-Blocking Disclaimer (§7.3):** Prominent legal boundary banner advising users on informal reporting vs formal Title IX / Public Safety filings.

### 2. Automated AI Triage & Multi-Factor Priority Matrix (§3.0 – §3.3)
- **Computer Vision (CV) Node:** Detects visual defect objects (`ceiling_fan`, `electrical_spark`, `water_leak`, `pipe_burst`), tags hazards, and assigns model confidence scores.
- **Natural Language Processing (NLP) Node:** Keyphrase extraction, linguistic sentiment, and urgency scoring ($0.00 - 1.00$).
- **Threat & Emergency Bypass:** Automatically flags life safety, physical threats, and structural failures to trigger immediate bypass to Campus Security.
- **Multi-Factor SLA Response Queue:**
  - **Critical / Emergency:** $< 15$ Minutes (Security / Emergency Response)
  - **High Infrastructure:** $< 2$ Hours (Dept Facilities Lead, CR, IT/AV)
  - **Medium General:** $< 12$ Hours (Custodial & Maintenance Crew)
  - **Low Routine:** $< 48$ Hours (General Campus Operations)

### 3. Class Representative (CR) Verification Lifecycle (§4.0 – §4.2)
- **Targeted Local Routing:** Routes classroom-specific issues to local Class Representatives.
- **One-Tap Inspection Modal:** Allows CRs to mark an incident as **Verified & Escalated**, **Needs Information**, or **Rejected / Spam** with physical inspection notes.

### 4. Cryptographic Anonymity & Bidirectional Dialogue (§4.3, §7.1)
- **HMAC-SHA256 Session Tokens:** Generated dynamically upon submission to allow anonymous submitters to track tickets and receive updates without storing IP addresses.
- **Tokenized Messaging Gateway:** Allows bidirectional clarification chat between submitter, Class Representative, and facilities administration without identity leakage.

### 5. Spatial GIS Campus Map & Analytics (§6.0 – §6.3)
- **Interactive SVG GIS Campus Map:** 2D interactive layout showing campus building geometry (Eng Block A, Eng Block B, Science Block, Library, Admin Complex).
- **Heatmap Density Overlay:** Visualizes recurring infrastructure failures and defect density clusters (e.g., Eng Block B electrical defects).
- **KPI Monitoring:** Real-time SLA tracking, Mean Time to Resolution (MTTR), and AI triage accuracy metrics.

---

## 🚀 Getting Started

```bash
cd campus-guard

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```


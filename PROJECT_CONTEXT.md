# PROJECT_CONTEXT.md — CampusPulse

> **Permanent Project Reference & Context**  
> *Project Name:* **CampusPulse**  
> *Tagline:* Zero-Login AI Campus Facility & Incident Reporting System  
> *Root Repository:* `/Users/sharath/Projects/bootcamp`  
> *Application Path:* `/Users/sharath/Projects/bootcamp/campus-guard`  
> *GitHub Remote:* `https://github.com/sharath3221/campus-issue-reporter.git`  
> *Last Verified:* 2026-11-04  

---

## 1. Project Overview & Objectives

**CampusPulse** is an enterprise-grade, mobile-first web application engineered for university and college campuses. It delivers instantaneous, zero-barrier reporting for campus infrastructure defects, water leakages, classroom equipment failures, sanitation hazards, and departmental maintenance issues.

### Core Objectives:
1. **Zero Registration Barrier:** Decouple incident submission completely from user identity. No student PRNs, institutional emails, logins, passwords, or OTPs required for submitting reports.
2. **Autonomous AI Computer Vision & Defect Verification:** Integrated multi-tier verification engine ([`src/lib/defectVerification.ts`](campus-guard/src/lib/defectVerification.ts)) leveraging browser biometric `FaceDetector` APIs, Google Gemini 2.5 Flash, and Supabase Edge Functions. Strictly rejects selfies, blurry photos, and plain undamaged walls.
3. **Direct Executive Pipeline:** Eliminate administrative bottlenecks by routing reports directly from public intake into an executive management portal and maintenance queue for one-click work order dispatch.
4. **Physical Spot QR Generator Studio:** Built-in generator allowing administrators to create and print physical QR placards for any building, floor, room, or fixture.
5. **Dynamic Spatial Campus Blueprint:** Multi-floor architecture supporting arbitrary building floors (Floor 1, Floor 2, Floor 3, etc.) with customizable rooms and floor station QR intake routes.

---

## 2. Problem Statement & Target Users

### Problem Statement:
Legacy campus reporting portals demand mandatory student credentials, causing high drop-off rates and psychological hesitation (fear of administrative retaliation or social stigma). Furthermore, non-literate custodial staff and students who notice defects first need a fast, visual, camera-first intake that strictly prevents spam, selfies, or false reports.

### Target Users:
1. **Students & Faculty:** Report classroom defects (sparking fans, broken projectors, broken furniture) immediately by scanning spot QR codes on desks or walls.
2. **Support Staff & Floor Visitors:** Report washroom leakages, overflowing bins, and broken taps using visual category selectors and live camera uploads.
3. **College Principal & Governing Management:** Oversee live spatial floor maps, track campus-wide health, inspect AI-prioritized queues, and audit resolution metrics.
4. **Maintenance Operations Directorate:** Dispatch jobs instantly via WhatsApp/SMS to on-duty plumbers, electricians, janitors, and carpenters.
5. **Field Maintenance Technicians:** Access the mobile-first `/maintenance` portal to inspect assigned jobs, view Before defect photos, and snap live camera After proof photos to resolve work orders.

---

## 3. Strict Project Constraints

| Constraint | Enforcement Rule | Rationale |
| :--- | :--- | :--- |
| **STRICT CONSTRAINT 1: Zero CR Layer** | All Class Representative (CR) triage, approval gates, and intermediate verifications are **strictly removed**. | Eliminates human bottlenecks and biases; routes reports directly: $\text{User} \rightarrow \text{AI Engine} \rightarrow \text{Admin Portal}$. |
| **STRICT CONSTRAINT 2: Clean Public Reporter** | Route `/report` must contain **ZERO** administrative details, no staff contact directories, no internal ticket queues, and no management dashboards. | Guarantees a clutter-free, privacy-first interface optimized for rapid 5-second submissions. |
| **STRICT CONSTRAINT 3: Separate Admin Portal** | Administrative operations are strictly gated behind `/admin/login` and `/admin/dashboard`. | Enforces executive access control for College Principal, Management Trustees, and Operations Heads. |
| **STRICT CONSTRAINT 4: Mandatory Defect Genuineness** | Non-genuine photos (selfies, human faces, blurry shots, plain undamaged walls, category mismatches) are **blocked** from submission. | Protects maintenance teams from junk tickets and false alarms. |

---

## 4. Technology Stack & Cloud Infrastructure

### Frontend Application (`campus-guard/`)
- **Framework:** React 18.3 with TypeScript 5.6
- **Build Tool / Bundler:** Vite 6 (ESM production bundling with `@/` resolve alias)
- **Routing:** React Router DOM v6 (`react-router-dom`)
- **Iconography:** Lucide React (`lucide-react`)
- **Animation:** Framer Motion (`framer-motion`) & Canvas Confetti (`canvas-confetti`)
- **Camera & Hardware Release:** Native WebRTC `navigator.mediaDevices.getUserMedia` with instant hardware track release on snapshot/unmount (turns off green webcam light).
- **Biometric Detection:** Client-side native `FaceDetector` API for instant (~10ms) hardware-level face/selfie rejection.
- **QR Engine:** `qrcode` high-resolution canvas & SVG generator with printable placard formatting.

### AI Defect Verification Engine (`campus-guard/src/lib/defectVerification.ts`)
- **Tier 1:** Native Browser `FaceDetector` API (Biometric hardware guard).
- **Tier 2:** Google Gemini 2.5 Flash Vision Multimodal Client (`gemini-2.5-flash`).
- **Tier 3:** Supabase Edge Function Proxy (`analyze-defect`).
- **Tier 4:** Autonomous Local Pixel Analysis Engine (Luminance, edge gradient, skin chrominance).

### Backend & Cloud Layer (Supabase)
- **Project Ref:** `fxpjftdtfsbsthucvdpm` (`https://fxpjftdtfsbsthucvdpm.supabase.co`)
- **Database:** PostgreSQL 15+ with Row-Level Security (RLS) policies allowing anonymous public inserts and admin controls.
- **Authentication:** Supabase Auth for Google OAuth and institutional password sign-in (strict authentication; no demo accounts or bypasses).
- **Storage:** Public S3-compatible bucket `incident-media` for camera defect photos and maintenance repair proof photos.
- **Realtime:** Supabase Realtime WebSocket replication for live updates across `incident_tickets` and `campus_locations`.
- **Edge Functions (`supabase/functions/`):**
  - `analyze-defect`: Server-side Gemini 2.5 Flash Multimodal Vision Proxy (keeps `GEMINI_API_KEY` hidden).
  - `dispatch-alert`: Automated WhatsApp Cloud API / Twilio SMS work order dispatcher.

---

## 5. Key Application Routes

| Path | Purpose | Access Control |
| :--- | :--- | :--- |
| `/report` | Public Zero-Login Incident Intake | Public (No login) |
| `/floor-report` | Public Floor Station QR Intake with Dynamic Room Selector | Public (No login) |
| `/maintenance` | Dedicated Maintenance Staff Portal (Before/After photos) | Technicians / Public link from WhatsApp |
| `/admin/login` | Secure Executive Admin Login (Google SSO & Supabase Password) | Administrators |
| `/admin/dashboard` | Executive Command Center (Map, Feed, QR Studio) | Authenticated Admin Session |

---

## 6. Development Conventions

1. **Localhost First:** Never pass `--host` to Vite unless the user specifically asks for phone network testing.
2. **Production Cleanliness:** Never leave demo quick-login accounts, sample testing links, or mock ticket shortcuts in production code.
3. **Database Idempotency:** All SQL migrations must use `DROP POLICY IF EXISTS`, `DO $$` publication blocks, and `ON CONFLICT DO NOTHING`.
4. **Git Security:** `.env` and sensitive API keys must remain strictly in `.gitignore` and never be committed to Git.

# CampusPulse 🛡️
> **Zero-Login AI Campus Facility & Incident Reporting System**

CampusPulse is an enterprise-grade, mobile-first facility incident reporting system designed for university campuses. It eliminates the friction of traditional reporting portals by decoupling incident submission from user identity, and automates defect triage and verification using Google Gemini 2.5 Flash Multimodal Vision, client-side biometric hardware guards, and Supabase.

---

## 🌟 Key Highlights

* **Zero-Login Public Intake (`/report` & `/floor-report`):** No student PRNs, institutional emails, or passwords required. Scan a spot QR code, tap a pictographic category, snap a photo, and submit in 5 seconds.
* **Direct Executive Pipeline (NO CR LAYER):** Reports bypass all student representative triage and route directly to the Executive Admin Portal and maintenance queue.
* **Complete AI Defect Verification Engine (`src/lib/defectVerification.ts`):**
  * **Biometric Hardware Face Guard:** Native browser `FaceDetector` API checks camera frames in ~10ms to immediately reject selfies and personal portraits.
  * **Strict Selfie & Background Wall Prohibition:** Prevents AI from inspecting room walls behind human portraits; rejects generic painted walls without active physical damage.
  * **Category-Defect Mismatch Filter:** Blocks reports where the category is Furniture, Electrical, or Water Supply but the photo only depicts an ordinary wall or background.
  * **No-Defect / Blurry Image Enforcement:** Strictly blocks submission and displays clear user feedback if an image has `#no_detectable_defects`, `#image_unclear`, or lacks physical damage.
  * **Multimodal Fallback Hierarchy:** Direct Gemini 2.5 Flash ➔ Supabase Edge Function Proxy (`analyze-defect`) ➔ Autonomous Local Pixel Analysis Engine.
* **Dynamic Multi-Floor Architecture Studio:** Admin Blueprint Studio supports adding arbitrary floors (Floor 1, Floor 2, Floor 3, etc.) per building with independent room maps and floor station QR codes.
* **Instant Camera Hardware Release:** Complete camera stream cleanup immediately turns off the device camera indicator light upon photo snapshot or viewfinder close.
* **Smart Duplicate Clustering:** Intelligently clusters repeat reports at the same campus spot, increments the `+N` count, and elevates priority without creating ticket clutter.
* **Live Spatial Campus Floor Map:** Interactive campus blueprint with floor selectors and color-coded status pins (🔴 Urgent, 🟡 Dispatched, 🟢 Resolved).
* **Dedicated Maintenance Staff Portal (`/maintenance`):** Field technicians view assigned work orders, compare Before vs After defect photos, and upload live camera repair proofs.
* **Admin Spot QR Generator Studio:** Built-in studio to generate, preview, download (PNG), and print physical QR placards for any building, floor, room, or fixture.
* **Supabase Cloud Infrastructure:** PostgreSQL 15+ database with Row-Level Security, Supabase Auth (Google OAuth & Passkey), Storage bucket (`incident-media`), and Realtime WebSockets.

---

## 🚀 Application Routes

| Route | Purpose | Target User |
| :--- | :--- | :--- |
| `/report` | Zero-Login Spot QR Incident Intake & Live Status Badge | Students, Faculty, Staff |
| `/floor-report` | Floor Station QR Intake with Dynamic Room Selector | Students, Floor Visitors |
| `/maintenance` | Work Order Management & Fixed Proof Photo Upload | Maintenance Technicians (Plumbing, Electrical, etc.) |
| `/admin/login` | Executive Authentication (Google Sign-In & Supabase) | Principal, Management, Operations Head |
| `/admin/dashboard` | Command Center (GIS Floor Map, Incident Feed, QR Studio) | Campus Leadership & Facility Heads |

---

## 🔬 AI Defect Verification & Classification System

> 📘 **Detailed Architectural Reference:** For the complete mathematical formulas, tag taxonomy, and scoring scenarios, see [**`REPORT_CLASSIFICATION.md`**](REPORT_CLASSIFICATION.md).

The verification pipeline in [`src/lib/defectVerification.ts`](campus-guard/src/lib/defectVerification.ts) runs four sequential verification layers before any incident is accepted:

1. **Layer 1: Biometric Hardware Face Guard (`detectHumanFaceClientSide`)**  
   Evaluates native hardware `FaceDetector` in ~10ms. If a human face or selfie is detected, the report is instantly rejected:
   > *"Photo contains a selfie or human face. Campus facility defect reports must show only the physical facility defect, without people."*

2. **Layer 2: Direct Google Gemini 2.5 Flash Multimodal Vision**  
   Evaluates the photo with strict prompt constraints prohibiting background inspection behind people, enforcing wall damage criteria, and outputting structured JSON (`is_genuine`, `rejection_reason`, `defect_tags`, `severity_score`, `summary`).

3. **Layer 3: Supabase Server-Side Edge Proxy (`supabase/functions/analyze-defect`)**  
   Fallback endpoint keeping API keys secure on Supabase Deno runtime, with identical hardened selfie and background wall verification rules.

4. **Layer 4: Category Alignment & Genuineness Validator (`validateGenuineness`)**  
   Scans 25+ person patterns, 30+ no-defect/blurry patterns, and prevents cross-category false positives (e.g., plain painted wall submitted under Furniture or Plumbing). Blocks submission with an explicit alert card.

---

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript 5.6, Vite 6, React Router DOM v6, Lucide React, Framer Motion
* **Backend & Cloud:** Supabase (PostgreSQL, Supabase Auth, Storage, Realtime)
* **Serverless Edge Functions:** Deno runtime (`analyze-defect` and `dispatch-alert`)
* **AI Vision Engine:** Google Gemini 2.5 Flash Multimodal Vision + Browser Biometric API
* **QR Generation:** `qrcode` engine for printable placards

---

## 💻 Local Development Setup

### 1. Clone the repository
```bash
git clone https://github.com/sharath3221/campus-issue-reporter.git
cd campus-issue-reporter/campus-guard
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in `campus-guard/`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 4. Run Development Server (Localhost)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Database Setup (Supabase)

1. Open your **Supabase SQL Editor**.
2. Run the migration script in `supabase_schema.sql`.
3. In **Storage**, ensure the public bucket `incident-media` is created.
4. (Optional) Deploy Edge Functions:
   ```bash
   npx supabase functions deploy analyze-defect --project-ref your-project-ref
   npx supabase functions deploy dispatch-alert --project-ref your-project-ref
   ```

---

## 📄 License
MIT License. Built for modern university campus infrastructure.

# CampusPulse 🛡️
> **Zero-Login AI Campus Facility & Incident Reporting System**

CampusPulse is an enterprise-grade, mobile-first facility incident reporting system designed for university campuses. It eliminates the friction of traditional reporting portals by decoupling incident submission from user identity, empowering non-literate custodial workers (*aayas*) through tactile audio-guided pictograms, and automating defect triage using Google Gemini 2.5 Flash Multimodal Vision and Supabase.

---

## 🌟 Key Highlights

* **Zero-Login Public Intake:** No student PRNs, institutional emails, or passwords required. Scan a spot QR code, tap a pictographic category, snap a photo, and submit in 5 seconds.
* **Direct Executive Pipeline (NO CR LAYER):** Reports bypass all student representative triage and route directly to the Executive Admin Portal.
* **Universal Accessibility (*Aayas*):** High-contrast pictographic cards with native Web Speech API audio announcements.
* **Autonomous AI Vision Inspection:** Analyzes photos using Google Gemini 2.5 Flash via a secure server-side Supabase Edge Function to extract defect tags, severity scores, and diagnoses.
* **Instant Camera Hardware Release:** Complete camera track cleanup immediately turns off the device camera indicator light upon capture.
* **Smart Duplicate Clustering:** Intelligently clusters repeat reports at the same campus spot, increments the `+N` count, and elevates priority without creating ticket clutter.
* **Live Spatial Campus Floor Map:** Interactive SVG campus map with floor selectors (Floors 1, 2, 3) and color-coded status pins (🔴 Urgent, 🟡 Dispatched, 🟢 Resolved).
* **Dedicated Maintenance Staff Portal (`/maintenance`):** Field technicians view work orders, compare Before vs After defect photos, and upload live camera repair proofs.
* **Admin Spot QR Generator Studio:** Built-in studio to generate, preview, download (PNG), and print physical QR placards for any building, floor, room, or fixture.
* **Supabase Powered:** PostgreSQL 15+ database with Row-Level Security, Supabase Auth (Google OAuth + Passkey), Storage bucket (`incident-media`), Realtime WebSockets, and Edge Functions.

---

## 🚀 Application Routes

| Route | Purpose | Target User |
| :--- | :--- | :--- |
| `/report` | Zero-Login Incident Intake & Live Spot Status Badge | Students, Faculty, Custodial Staff |
| `/maintenance` | Work Order Management & Fixed Proof Photo Upload | Maintenance Technicians (Plumbing, Electrical, etc.) |
| `/admin/login` | Executive Authentication (Google Sign-In & Passkey) | Principal, Management, Operations Head |
| `/admin/dashboard` | Command Center (GIS Floor Map, Incident Feed, QR Studio) | Campus Leadership |

---

## 🛠️ Tech Stack

* **Frontend:** React 18, TypeScript, Vite 6, React Router DOM v6, Lucide React
* **Backend & Cloud:** Supabase (PostgreSQL, Supabase Auth, Storage, Realtime)
* **Serverless Edge Functions:** Deno runtime (`analyze-defect` and `dispatch-alert`)
* **AI Vision Engine:** Google Gemini 2.5 Flash Multimodal Vision
* **Voice & Audio:** Web Speech API (`window.speechSynthesis`)
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

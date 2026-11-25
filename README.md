# AirAware 🌬️
> **Secure GenAI-Powered Smog & Clean Air Resilience Platform for Families and Communities**

AirAware transforms complex, passive Air Quality Index (AQI) readings into proactive, hyper-personalized daily schedules, low-cost indoor purification hacks, low-exposure commutes, and community environmental impact tracking.

---

## 🔒 Architecture & Security Implementation

AirAware utilizes a **Backend Proxy Architecture** powered by **Vercel Serverless Functions**:
- **Zero Frontend Key Exposure**: The browser never sees or stores the `GEMINI_API_KEY`.
- **Serverless API Gateway**:
  - `POST /api/assistant`: Validates incoming questions, injects live ambient telemetry + household context, and queries Google Gemini.
  - `POST /api/recommendations`: Generates structured JSON daily resilience routines conforming to strict response schemas.
- **Security Hardening**:
  - In-memory sliding window IP rate limiting (30 requests/min per IP).
  - Strict payload validation (max 64 KB, 1,000 character message limit, sanitized member demographics).
  - Upstream request timeouts (15s) and exponential backoff retry logic.
  - Transparent error handling with clearly demarcated offline fallback heuristics.

---

## 🌟 Core Modules

1. **Live Air Quality Dashboard**:
   - Semi-circular radial gauge reflecting the Indian National Air Quality Index (NAQI) and US-EPA AQI.
   - Breakdown of primary pollutants ($PM_{2.5}$, $PM_{10}$, $NO_2$, $SO_2$, $CO$, $O_3$) against WHO 2021 air quality thresholds.
   - 24-Hour Diurnal Forecast with Recharts, highlighting morning thermal inversion spikes (6:00–9:30 AM) and afternoon mixing windows.

2. **Personalized AI Pollution Assistant**:
   - Communicates exclusively through `/api/assistant`.
   - Context-grounded recommendations combining real-time environmental data with household demographics and health vulnerabilities.
   - Contextual quick-prompts for child protection, DIY purifiers, commute times, and elder care.

3. **Daily Routine & Inversion Optimizer**:
   - Hourly schedule recommendations based on atmospheric boundary layer dynamics.
   - Natural ventilation guidance (identifies safe cross-ventilation periods vs. required window lock-downs).
   - Member-specific protection protocols for asthmatic children, seniors, and active commuters.
   - Provenance badges clearly identifying live Gemini responses vs. offline calibrated engine fallbacks.

4. **Indoor Air Quality Hacks**:
   - Step-by-step Corsi-Rosenthal DIY Box-Fan HEPA Purifier assembly guide (reduces PM2.5 by 75% for under ₹2,000 / $25).
   - Protocols for wet-mopping (preventing dust re-suspension), kitchen exhaust timing, and doorway draft sealing.
   - One-click habit logging to the Environmental Impact Tracker.

5. **Sustainable Transportation Comparator**:
   - Calculates **Personal Inhaled Particulate Dosage** ($\mu\text{g } PM_{2.5}$) based on minute ventilation rates ($V_E$) across modes (Metro, AC Bus, Carpool, 2-Wheeler, Walking).
   - Calculates **Carbon Footprint** ($g\text{ CO}_2$) to encourage public transit and carpooling.

6. **Environmental Impact Tracker**:
   - Tracks $CO_2$ avoided, toxic particulates prevented from inhalation, clean air sanctuary hours, and active streaks.
   - Neighborhood collective impact aggregator celebrating community-wide emission reductions.

7. **Household Profiles & Vulnerability Mapping**:
   - Manages family members, age brackets, and respiratory conditions (Asthma, COPD, Cardiovascular, Pregnancy, Elderly).
   - Customizes home parameters (purifier ownership, cooking exhaust, window draft seal quality).

---

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Visualizations**: Recharts
- **Backend API Gateway**: Vercel Serverless Functions (`/api/assistant.ts`, `/api/recommendations.ts`)
- **AI Engine**: Google Gemini API (`gemini-3.8-flash`) via secure backend proxy
- **Environmental Telemetry**: Open-Meteo Air Quality API + India CPCB / NAQI Station Standards
- **Hosting & CI/CD**: Vercel

---

## 🚀 Environment Setup & Deployment

### 1. Environment Variables Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your Google AI Studio API key in `.env`:
```ini
# Server-side environment variable (NEVER exposed to frontend bundle)
GEMINI_API_KEY=AIzaSyYourActualGoogleKeyHere
GEMINI_MODEL=gemini-3.8-flash
```

> [!NOTE]
> `.env` and `.env.local` are explicitly excluded from Git via `.gitignore`.

### 2. Local Development
```bash
# Install dependencies
npm install

# Run the local development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173). The local Vite dev middleware automatically proxies `/api/*` requests directly to the TypeScript serverless handlers in `/api/` using server-side environment variables.

### 3. Production Deployment to Vercel
1. Push your repository to GitHub or GitLab.
2. Import the project into your [Vercel Dashboard](https://vercel.com).
3. In **Project Settings > Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Google AI Studio key (`AIzaSy...`)
   - `GEMINI_MODEL`: `gemini-3.8-flash`
4. Click **Deploy**. Vercel will automatically compile the React frontend and deploy `/api/assistant.ts` and `/api/recommendations.ts` as serverless functions.

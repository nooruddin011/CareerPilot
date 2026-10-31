# CareerPilot

**A career intelligence workspace for planning your next move.** CareerPilot helps users compare their experience with job requirements, plan focused learning, practise interviews, and keep job-search activity in one place.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=googlegemini)](https://ai.google.dev/)

## What it does

- **Career profile and resume review:** Paste resume text or upload a PDF/DOCX for structured Gemini analysis. Review and edit extracted education, experience, skills, achievements, and projects before saving.
- **Job analysis and skill gaps:** Save job descriptions you provide, optionally with their source URL and company, then compare their requirements with your profile. The skill map shows matched, improving, and missing skills with priorities and evidence.
- **Learning plans:** Generate a week-by-week roadmap using the target role, identified gaps, study hours, and preparation duration. Review the proposal before applying it; track task completion locally.
- **Portfolio planning:** Get role-related project recommendations and track project progress.
- **Interview practice:** Generate role-focused technical, behavioural, or mixed questions, submit written answers, and review scored feedback and saved practice history.
- **Progress and applications:** Track milestones, applications, and outcomes. Career analytics summarizes recorded activity and can request Gemini recommendations.
- **Career agent:** Use conversational requests with saved profile and progress context. The agent presents important changes for review and confirmation before applying them.
- **Demo workspace:** The app opens with sample records so the workflow is easy to explore. Sample data is labelled; use **Start with my profile** to clear it and begin a personal workspace.

CareerPilot analyses the job descriptions entered by the user; it does not fetch postings from the web. Gemini features require a configured API key and available model quota. AI errors are shown instead of being replaced with fabricated analysis.

## Technology

| Area | Implementation |
| --- | --- |
| Application | Next.js App Router 15, React 19, TypeScript |
| Styling | Tailwind CSS configuration with shared application styles |
| Visualisations and icons | Recharts, Lucide React |
| AI | Google Gemini through the official `@google/genai` SDK, called from server routes |
| Resume parsing | `pdf-parse` for PDF and `mammoth` for DOCX |
| Persistence | Browser `localStorage` (`careerpilot-v1`) |

There is no configured cloud database or account system. Workspace data stays in the current browser. Resume files are parsed server-side for the analysis request and are not stored as uploaded files by the app.

## Prerequisites

- Node.js compatible with the installed Next.js version (Node.js 20 or newer recommended).
- npm.
- A Google Gemini API key for AI features. You can explore the labelled sample workspace without making AI requests.

## Run locally

```bash
npm ci
```

Create a local environment file from the checked-in template:

**PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your Gemini credentials:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
```

Keep `.env.local` private. It is excluded by `.gitignore`; `.env.example` contains placeholders and remains eligible for Git. The server reads the key through `process.env`; it is not intended for browser code.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). After changing environment variables, restart the server.

## Build and run for production

```bash
npm run build
npm run start
```

Deploy to a Node.js-compatible Next.js host. Configure `GEMINI_API_KEY` and, optionally, `GEMINI_MODEL` in the host’s server-side environment settings; do not publish the key as a client-side variable.

## Project structure

```text
app/
  api/ai/          Gemini-backed resume, job, roadmap, project, interview, and analysis actions
  api/agent/       Contextual career-agent interpretation and proposed actions
  api/resume/      PDF/DOCX intake and resume analysis
  page.tsx         CareerPilot workspace and connected sections
  *.css            Shared and page-level visual styles
lib/
  ai.ts            Gemini client, prompts, and structured AI services
  agent-actions.ts Validation/application of confirmed agent actions
  rate-limit.ts    In-memory API request limits
.env.example       Safe environment-variable template
```

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build and run Next.js TypeScript checks |
| `npm run start` | Serve a completed production build |
| `npm run lint` | Currently invokes `next lint`; this project does not include an ESLint configuration, so Next.js may prompt to set one up |

No Python source or Python dependencies are used, so a `requirements.txt` is not needed.

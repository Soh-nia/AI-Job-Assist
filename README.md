# ApplyAI — AI-Powered Job Application Assistant

> Paste a job description and your experience. Get tailored CV bullet points and a compelling cover letter in seconds.

![ApplyAI Screenshot](screenshot.png)

## What it does

ApplyAI uses Claude to analyse a job description alongside your experience and generates:

- **6–8 ATS-optimised CV bullet points** — action verb + task + quantified impact, using the exact keywords from the job posting
- **A full cover letter** — 3 paragraphs, company-specific, human-sounding

Both generate sequentially with live streaming so you see the output as it's written.

## Tech stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Anthropic Claude API (`claude-sonnet-4-5`)
- Deployed on Vercel

## Getting started

```bash
# Clone
git clone https://github.com/Soh-nia/AI-Job-Assist.git
cd apply-ai

# Install
npm install

# Set up your API key
cp .env.example .env.local
# Add your Anthropic API key to .env.local

# Run
npm run dev
```

## Environment variables

```
VITE_ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your key at [console.anthropic.com](https://console.anthropic.com).

## Prompt engineering

This app uses two distinct system prompts:

**CV Bullets prompt** — instructs Claude to follow the Action Verb + Task + Impact formula, mirror job description keywords for ATS optimisation, and quantify results wherever possible.

**Cover Letter prompt** — instructs Claude to open with a company-specific hook, connect 2–3 experiences directly to role requirements, and keep it to 3 short paragraphs.

## Deployment

```bash
# Build
npm run build

# Deploy to Vercel
vercel --prod
```

Set `VITE_ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables.

## Security note

This app calls the Anthropic API directly from the browser. Your API key is stored in Vercel's environment and injected at build time via `import.meta.env`. For a production multi-user app, move API calls to a backend server.

## Planned features

- [ ] Multiple job description comparison
- [ ] Save applications history
- [ ] Export to PDF/Word
- [ ] ATS keyword match score

## License

MIT

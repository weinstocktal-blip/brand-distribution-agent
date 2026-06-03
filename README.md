# Brand Distribution Agent

A web app that researches fashion brands using AI + web search and returns structured distribution data ready to paste into the Brand Incubation Tracker.

## Deploy to Vercel (same workflow as your Brand Intelligence Tool)

### 1. Create a GitHub repo
- Go to github.com → New Repository
- Name it `brand-distribution-agent`
- Push this folder to the repo:
  ```
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin https://github.com/YOUR_USERNAME/brand-distribution-agent.git
  git push -u origin main
  ```

### 2. Deploy on Vercel
- Go to vercel.com → Add New Project
- Import the GitHub repo
- Before deploying, add your environment variable:
  - Go to Settings → Environment Variables
  - Name: `ANTHROPIC_API_KEY`
  - Value: your API key from console.anthropic.com
- Click Deploy

### 3. Use it
- Open your Vercel URL (e.g. `brand-distribution-agent.vercel.app`)
- Type a brand name, hit Look Up
- Click "Copy for Excel" and paste into your tracker starting at the Year Founded cell

## Local Development

```
npm install
cp .env.example .env.local
# Edit .env.local with your API key
npm run dev
```

Open http://localhost:3000

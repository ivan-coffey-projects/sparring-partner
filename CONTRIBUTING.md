# Contributing

This repository is the source for a self-hosted product. Changes should stay
small, tested, and aligned with the safeguards in the README.

## Development setup

```bash
npm ci
cp .env.example .env
npm run seed
npm run dev
```

Open `http://localhost:3000`. The seed creates local-only accounts:

- Trainer: `coach@1x.example` / `coach-demo-1`
- Representative: `rep@1x.example` / `rep-demo-1`

Set `SP_MOCK_LLM=1` in `.env` to run without provider credentials.

## Before you open a pull request

```bash
npm test
npm run lint
npm run build
```

- Hidden-information, patience, engagement, concession, and citation behaviour belongs in `src/engine/`, not in provider prompts.
- When conversation-engine behaviour changes, add or update a focused test.
- Do not commit `.env`, databases, build artifacts, or generated output.
- Do not add a live-outreach path. This product simulates conversations only.

## Pull requests

Use the pull-request template. Describe the behaviour change, the tests you ran,
and anything a reviewer should verify in the UI.

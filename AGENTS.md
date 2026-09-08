# AGENTS — sparring-partner

Sparring Partner is a self-hosted sales-training simulator. Trainers create
prospects, methodologies, scorecards, and drills; representatives practice
calls and written conversations against those scenarios.

## Project structure

- Deterministic conversation rules belong in `src/engine/`.
- Provider integration and response generation belong in `src/llm/`.
- Application routes and server actions belong in `src/app/`.
- Reusable interface components belong in `src/components/`.
- Channel evidence and scoring rationale belong in `docs/research/`.

## Development rules

- Keep hidden-information, patience, engagement, concession, and citation
  decisions in code rather than provider instructions.
- Do not commit `.env`, `.env.bench`, databases, build artifacts, benchmark
  results, screenshots, or other generated output.
- Update or add a focused test when conversation-engine behaviour changes.
- Run `npm test`, `npm run lint`, and `npm run build` before release.
- This product simulates sales conversations; it must never contact real leads.

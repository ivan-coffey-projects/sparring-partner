# Testing audit

Handoff for anyone testing or deploying the local Sparring Partner build. Do
not print, copy, or commit `.env`, `.env.bench`, session cookies, or API keys.

Last updated 2026-08-25.

## Current working state

- The local test server is expected at `http://localhost:3000` and must listen
  on both IPv4 and IPv6. Firefox resolves `localhost` to `::1` on this machine.
- The login page loads without a redirect loop and has email-only sign-in while
  `SP_PASSWORDLESS_LOGIN=1` is set. This is local-test-only behaviour.
- The SQLite test database contains 3 users, 5 prospects, 6 methodologies, 6
  scorecards, 5 drills, and 6 calls.
- ElevenLabs is configured for prospect TTS and Scribe microphone tokens.
- The live model gateway responded successfully to its authenticated model-list
  check. ElevenLabs TTS and Scribe-token checks both returned HTTP 200.

## Important configuration distinction

The checked-in-safe local `.env` remains in mock mode (`SP_MOCK_LLM=1`). The
test server used for real-provider runs is launched with the private
`.env.bench` model-provider values layered over `.env`, so it runs with
`SP_MOCK_LLM=0` and all three LLM roles set to `openai-compatible`.

Do not copy the benchmark credential into a tracked file. If the server must
be restarted for a real-provider test, preserve the same environment layering:

```bash
set -a
source .env
source .env.bench
set +a
export SP_DATABASE_PATH="$PWD/data/sparring.db"
export SP_PASSWORDLESS_LOGIN=1
export SP_PROSPECT_TTS_PROVIDER=elevenlabs
npm run dev -- --hostname ::
```

This command is for the local test server only. Do not use passwordless login
or the benchmark credential for a deployment.

## Fixed failures

1. `localhost` failed in Firefox because the server listened only on IPv4.
   Start it with `--hostname ::`.
2. `/login` and `/setup` looped because their user-count decision was
   statically generated against inconsistent relative SQLite paths. Both routes
   now force dynamic rendering; the local `.env` uses an absolute database path.
3. Local passwordless mode now applies to the first-trainer setup page as well
   as normal login. It creates a random internal password hash because the
   database schema requires one.
4. **A failed model-gateway call left a call or thread in torn state.** Both
   turn pipelines persisted the rep's line before calling the prospect model
   and updated `calls` only afterwards, so a gateway failure stranded a rep
   turn with no reply and left `calls.patience` disagreeing with the analysis
   record in the transcript. A retry then appended a duplicate rep line and
   recomputed patience from the stale value. Both pipelines now stage their
   writes and commit the whole turn in a single transaction once the prospect
   line exists. Covered by `tests/turn-durability.test.ts`.
5. **The Docker image had never built.** Two stacked defects: `npm ci` failed
   because `package-lock.json` is resolved by npm 12 while `node:22-alpine`
   ships npm 10.9.8, which builds a different tree from it; and once that was
   pinned, `better-sqlite3` failed to compile because the slim base image has
   no Python/make/g++ and there is no prebuilt musl binary. The Dockerfile now
   installs the toolchain and pins npm, and `package.json` declares
   `engines.npm >= 12`.

6. **A locked fact could be ground open by repeated manipulation.** `trust`-type
   unlock rules only checked a cumulative score, and that score drifts upward
   from any question — so a rep who never demonstrated understanding could
   still cross the threshold by repeating false-premise, authority-claim, and
   sympathy-appeal probes. Whether such moves cost trust depended on the LLM
   analyzer reporting high `pressure`, which is the sort of decision
   `AGENTS.md` requires to live in code. `applyUnlockTurn` now requires at
   least one landed reflection before any `trust`-type rule can fire. Found by
   the H1 probe harness; see `docs/research/voice-channel.md`.

## Verification already completed

- `npm test` — 133 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `docker compose config --quiet` — passed.
- `docker build` — passed, and the running image serves its stylesheet
  (`/_next/static/css/…` returns 200, `text/css`, ~82 KB). An earlier note
  claimed the standalone output omitted static CSS; that applied to a
  hand-run standalone server, **not** to the image, whose Dockerfile does copy
  `.next/static`. First run redirects `/` → `/login` → `/setup` with no loop.
- Redirect path — `/` finishes at the login page after one redirect.
- Visual check — login page has an Email field, no Password field, and working
  styling. Previewer candidate: `3a41af7924dc4e9bb76a3e3ca1731d22`
  (“Working passwordless login”).

## Remaining test work

Needs a human at the machine:

1. Sign in with an existing local test user, open a live-call drill, and verify
   one complete representative turn: model reply, prospect audio, and debrief.
2. Verify microphone transcription in a real browser with microphone
   permission.
3. Before deployment, disable `SP_PASSWORDLESS_LOGIN`, configure an approved
   non-benchmark model credential, and run the production image.

Gateway-failure behaviour (previously item 3 here) is now covered by automated
tests rather than a manual pass. The live call surfaces a retry action on the
error toast; the async thread rolls its optimistic message back into the
composer. Both are safe because the server writes nothing on a failed turn.

## Open gaps

- The voice channel has no entry in `src/engine/channels.ts`. SMS, email, and
  the DM channels each have a research-cited `EngagementConfig`; live call has
  none. See `docs/research/voice-channel.md` — H1 has now run on both arms
  (cascaded 0 leaks by construction; speech-to-speech 12/20 runs leaked);
  H6 still awaits the annotation pass.

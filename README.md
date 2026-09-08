# Sparring Partner

Sparring Partner is a self-hosted sales-training gym. It is not a CRM, not a
dialer, and it never contacts real leads.

Trainers encode how they actually sell: hidden facts a prospect will not
volunteer, concession limits a buyer cannot exceed, and a numbered methodology
the grader is allowed to cite. Representatives run drills on five channels —
live call, SMS, email, Instagram DMs, and LinkedIn DMs — then receive a
debrief that must quote both the playbook and the transcript.

## About

| | |
| --- | --- |
| **Audience** | Enablement leads, sales managers, and representatives who need high-volume practice without burning a live pipeline |
| **Channels** | Live call, SMS, email, Instagram DMs, LinkedIn DMs |
| **Hosting** | Self-hosted. SQLite on disk, provider keys in the environment, Docker Compose or local Node |
| **Status** | 0.1.0 — usable for internal training; see [CHANGELOG](CHANGELOG.md) |
| **License** | Proprietary. [All rights reserved](LICENSE) |

The simulation combines provider-backed responses with deterministic rules so
a model cannot invent a discount, leak a locked fact, or coach from a point
the methodology does not contain.

## Core safeguards

| Safeguard | Implementation | Behaviour |
| --- | --- | --- |
| Hidden information | `src/llm/prospect.ts` | Locked facts are excluded from the prospect context until the representative earns them through accurate reflection or trust. |
| Patience | `src/engine/patience.ts` | Code applies penalties and recovery rules. A call ends when patience reaches zero. |
| Written engagement | `src/engine/engagement.ts` | Message quality, follow-up timing, and channel rules determine whether a prospect replies, remains silent, or opts out. |
| Concession limits | `src/engine/concessions.ts` | Code validates every requested commitment against trainer-defined limits before it reaches the representative. |
| Citation validation | `src/engine/citations.ts` | Coaching points must cite a numbered methodology entry and a verbatim excerpt from the conversation. Unsupported points are rejected. |

Channel parameters and seeded playbooks are supported by the evidence notes in
[`docs/`](docs/README.md). Source comments in `src/engine/channels.ts` link each
parameter to the relevant section.

## Docker quick start

```bash
git clone https://github.com/ivan-coffey-projects/sparring-partner.git
cd sparring-partner
cp .env.example .env
# Set SP_SESSION_SECRET and configure a provider, or use SP_MOCK_LLM=1.
docker compose up --build
```

Open `http://localhost:3000`. The setup screen creates the first trainer
account. Application data is stored in the `sparring-data` Docker volume at
`/data/sparring.db`.

## Local development

```bash
npm ci
cp .env.example .env
npm run seed
npm run dev
```

The development seed creates these local-only accounts:

- Trainer: `coach@sparring.local` / `coach-demo-1`
- Representative: `rep@sparring.local` / `rep-demo-1`

It also creates channel playbooks and sample drills. Run
`npm run seed:channels` to add those records to an existing development
database without replacing current data.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the test and pull-request workflow.

## Provider configuration

Configuration is environment-based; provider credentials are not stored in
the database. See [`.env.example`](.env.example) for all supported variables.
The three provider roles can be configured independently:

- `SP_PROSPECT_*` generates the buyer's responses.
- `SP_ANALYZER_*` classifies each representative turn against the hidden facts.
- `SP_GRADER_*` evaluates completed conversations against the scorecard.

Supported providers are `openai`, `anthropic`, `openai-compatible`, and
`mock`. Set `SP_MOCK_LLM=1` to run deterministic scripted scenarios without
provider credentials.

Live-call speech is optional. By default, the prospect speaks through the
internal Kokoro service at `SP_KOKORO_TTS_BASE_URL`; select its voice with
`SP_KOKORO_TTS_VOICE`. The browser sends only an engine-approved prospect line
to that service. It never receives the hidden file and never decides patience,
unlocks, or concessions.

Set `ELEVENLABS_API_KEY` to add microphone input through Scribe v2 Realtime.
The browser gets a single-use token; the permanent key stays on the server. Set
`SP_PROSPECT_TTS_PROVIDER=elevenlabs` only when prospect audio should also use
ElevenLabs instead of Kokoro.

## Processing flow

1. Code calculates message metrics, including word count and question count.
2. The analyzer classifies the representative's latest move.
3. The patience or engagement engine updates the conversation state.
4. The unlock engine exposes only the facts earned during the turn.
5. The prospect receives the permitted context and generates a response.
6. Code validates requested concessions and blocks unauthorized commitments.
7. The grader evaluates the completed conversation; the citation gate removes unsupported coaching points.

Written channels use the same sequence with channel-specific metrics and a
simulated clock. The engagement engine decides whether a reply occurs before
the prospect provider is called.

For voice calls, Scribe turns microphone audio into the representative's text
before step 1 when ElevenLabs is configured. After step 6, the selected speech
provider converts only the persisted prospect reply to audio. Raw audio is not
stored by Sparring Partner.

## Verification

```bash
npm test
npm run lint
npm run build
```

The embedded database migrations run when the application starts. For a
self-hosted upgrade, pull the latest revision and rebuild the container.

## Security

- Never commit `.env`, database, build, or output files.
- Use a unique `SP_SESSION_SECRET` in every deployment.
- Keep provider credentials in the deployment environment or a secret store.
- Treat the seeded accounts as development data only.
- Report vulnerabilities privately — see [SECURITY.md](SECURITY.md).

## License

Copyright (c) 2026 Neonoodles. All rights reserved. See [LICENSE](LICENSE).

# Documentation

Channel parameters and seeded playbooks are grounded in the notes below.
Engine constants in `src/engine/channels.ts` cite the matching section.

| Note | What it supports |
| --- | --- |
| [Scoring metrics](research/scoring-metrics.md) | Call and written scorecard dimensions, reviewer rubrics |
| [Email channel](research/email-channel.md) | Reply probability, follow-up timing, opener and length rules |
| [SMS channel](research/sms-channel.md) | Consent, cadence, opt-out, and message-length behaviour |
| [Social DM channel](research/social-dm-channel.md) | Instagram and LinkedIn DM engagement and pitch limits |
| [Voice channel](research/voice-channel.md) | Pre-registered test plan for the live-call voice pipeline (no constants yet); H1 cascaded arm has results |
| [H6 annotation protocol](research/h6-annotation-protocol.md) | Instructions for the human annotator pass behind the speech metrics |

Start with the [README](../README.md) for product overview and deployment.
See [CONTRIBUTING](../CONTRIBUTING.md) for local development and
[SECURITY](../SECURITY.md) for reporting vulnerabilities.

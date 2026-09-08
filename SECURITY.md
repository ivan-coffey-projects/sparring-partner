# Security

Sparring Partner is a self-hosted training simulator. It must never contact
real leads, send messages to live inboxes, or store provider credentials in
the database.

## Report a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/ivan-coffey-projects/sparring-partner/security/advisories/new)
for this repository. Do not open a public issue for a security report.

Please include:

- The affected version or commit
- A clear description of the issue and its impact
- Steps to reproduce, or a proof of concept that does not expose live credentials

We will acknowledge the report and work on a fix before any public disclosure.

## Deployment checklist

- Generate a unique `SP_SESSION_SECRET` for every environment.
- Keep provider API keys in the deployment environment or a secret store, not in git.
- Treat seeded accounts (`coach@1x.example`, `rep@1x.example`) as development data only.
- Restrict network access to the host; this application is not a public SaaS.
- Back up `/data/sparring.db` (or `SP_DATABASE_PATH`) with the same care you give any personnel file.

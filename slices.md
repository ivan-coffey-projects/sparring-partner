# Slices — sparring-partner

A slice is one independently testable change: it lands on its own branch, its own
merge request, and it can be merged or abandoned without waiting on any other slice.
If a line below cannot be verified on its own, it is not a slice yet — split it.

## Convention

- One GitLab issue per slice, on `boiler-room/sparring-partner` (project id 126).
- Branch `slice/N-<name>`, taken from `main`, one git worktree per slice.
- `scripts/verify-slice.sh N` before every push. It writes `verify-slice-N.json`,
  which is the evidence a reviewer reads instead of the builder's claim.
- Never commit to `main`.

## Slices

1. `whatsapp-inbound` — add `dm_whatsapp` as an `AsyncChannel` with its own
   `EngagementConfig` in `src/engine/channels.ts`, grounded in a new
   `docs/research/whatsapp-channel.md`, covered by `src/engine/engagement.test.ts`.
2. `messenger-inbound` — add `dm_messenger` the same way, citing the WhatsApp
   evidence where the platforms genuinely overlap and its own where they do not.
3. `speed-to-lead` — a sim-clock scenario that scores the rep's time to first
   reply against an inbound lead, using the existing `src/sim/` clock and wait.

Slices 1–3 are the banked next work. They are also the three slices the Section A
shadow run uses to find out whether the report-only gates are worth being blocked by.

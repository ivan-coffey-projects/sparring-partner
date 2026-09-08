#!/bin/sh
# verify-slice.sh — run the AGENTS.md gate and write the evidence file.
#
#   scripts/verify-slice.sh <slice-number>
#
# Runs `npm run lint`, `npm test` and `npm run build`, then writes
# verify-slice-<N>.json: per check its name, the exact command, exit code,
# duration, and — only when it failed — the tail of its output.
# Exits non-zero if any check failed, so CI and a human get the same verdict.
#
# POSIX sh on purpose: this runs on the unit-1 runner inside node:22-alpine,
# whose /bin/sh is BusyBox ash. No bashisms. JSON is assembled by node, which
# that image always has — python3 only exists there because .gitlab-ci.yml's
# before_script installs it, and this script must not depend on that.

set -u

SLICE="${1:-}"
if [ -z "$SLICE" ]; then
  echo "usage: $0 <slice-number>" >&2
  exit 2
fi
case "$SLICE" in
  *[!0-9]*) echo "error: slice must be a number, got '$SLICE'" >&2; exit 2 ;;
esac

cd "$(dirname "$0")/.." || exit 2
OUT="verify-slice-$SLICE.json"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT INT TERM
: > "$WORK/results"

now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }

# run_check <name> <command...>
run_check() {
  name=$1
  shift
  log="$WORK/$name.log"
  echo "--- $name: $* ---"
  start=$(now_ms)
  "$@" > "$log" 2>&1
  rc=$?
  end=$(now_ms)
  # Echo the output so a human watching the terminal or the job log sees it live.
  cat "$log"
  printf '%s\t%s\t%s\t%s\t%s\n' "$name" "$rc" "$start" "$end" "$*" >> "$WORK/results"
  if [ "$rc" -eq 0 ]; then echo "--- $name: ok ---"; else echo "--- $name: FAILED (exit $rc) ---"; fi
  return 0
}

run_check lint  npm run lint
run_check test  npm test
run_check build npm run build

cat > "$WORK/emit.js" <<'JS'
const fs = require("fs");
const { execFileSync } = require("child_process");

const [, , slice, work, out] = process.argv;

// Bounded on purpose: a failing `npm run build` can emit megabytes, and an
// evidence file nobody can open is not evidence.
const MAX_LINES = 200;
const MAX_CHARS = 20000;

function tail(file) {
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
  const lines = text.split("\n");
  let cut = lines.length > MAX_LINES;
  let kept = cut ? lines.slice(-MAX_LINES) : lines;
  let body = kept.join("\n");
  if (body.length > MAX_CHARS) {
    body = body.slice(-MAX_CHARS);
    cut = true;
  }
  return cut ? `[truncated to the last ${MAX_LINES} lines / ${MAX_CHARS} chars]\n${body}` : body;
}

function git(...args) {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const checks = fs
  .readFileSync(`${work}/results`, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [name, rc, start, end, command] = line.split("\t");
    const code = Number(rc);
    const check = {
      name,
      command,
      exit_code: code,
      passed: code === 0,
      duration_ms: Number(end) - Number(start),
    };
    if (code !== 0) check.output = tail(`${work}/${name}.log`);
    return check;
  });

const report = {
  slice: Number(slice),
  passed: checks.every((c) => c.passed),
  generated_at: new Date().toISOString(),
  // node:22-alpine ships no git binary — GitLab clones with a separate helper
  // image — so git() returns null in CI and the environment is the only source
  // of identity. Evidence that cannot be tied to a commit is not evidence.
  commit: process.env.CI_COMMIT_SHA || git("rev-parse", "HEAD"),
  branch: process.env.CI_COMMIT_REF_NAME || git("rev-parse", "--abbrev-ref", "HEAD"),
  checks,
};

fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
process.exit(report.passed ? 0 : 1);
JS

node "$WORK/emit.js" "$SLICE" "$WORK" "$OUT"
rc=$?

if [ "$rc" -eq 0 ]; then
  echo "verify-slice $SLICE: PASS -> $OUT"
else
  echo "verify-slice $SLICE: FAIL -> $OUT" >&2
fi
exit "$rc"

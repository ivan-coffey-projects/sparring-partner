import type { PatienceDelta } from "@/engine/types";

export interface TimelinePoint {
  turnIdx: number;
  patience: number;
  deltas: PatienceDelta[];
}

const REASON_LABELS: Record<PatienceDelta["reason"], string> = {
  monologue: "Monologue",
  early_pitch: "Pitched too early",
  blunt_question: "Blunt question",
  stacked_questions: "Stacked questions",
  pressure: "Pressure",
  accurate_reflection: "Accurate reflection",
  open_question: "Open question",
  wall_of_text: "Wall of text",
  pitch_first_touch: "Pitched in the opener",
  no_question: "No question, no ask",
  multi_cta: "Too many asks",
  spam_signals: "Spam signals",
  self_focused: "All about you",
  guilt_trip: "Guilt-trip bump",
  too_soon_follow_up: "Followed up too soon",
  no_new_value: "Nothing new added",
  relevant_personalization: "Load-bearing personalization",
  clear_cta: "One clear ask",
  patient_follow_up: "Patient follow-up",
};

/**
 * Server-rendered SVG sparkline of patience across the call, annotated with
 * the moments that cost (or restored) it.
 */
export function PatienceTimeline({
  initial,
  points,
}: {
  initial: number;
  points: TimelinePoint[];
}) {
  const values = [initial, ...points.map((p) => p.patience)];
  const width = 640;
  const height = 120;
  const padX = 12;
  const padY = 12;
  const stepX =
    values.length > 1 ? (width - padX * 2) / (values.length - 1) : 0;
  const y = (v: number) => padY + (height - padY * 2) * (1 - v / 100);
  const x = (i: number) => padX + i * stepX;

  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(" ");

  const worstMoments = points
    .map((p) => {
      const drop = p.deltas
        .filter((d) => d.amount < 0)
        .reduce((acc, d) => acc + d.amount, 0);
      return { ...p, drop };
    })
    .filter((p) => p.drop < 0)
    .sort((a, b) => a.drop - b.drop)
    .slice(0, 3);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Patience over the call"
      >
        <line
          x1={padX}
          y1={y(0)}
          x2={width - padX}
          y2={y(0)}
          className="stroke-border"
          strokeDasharray="4 4"
        />
        <path
          d={path}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.map((v, i) => {
          const point = i === 0 ? null : points[i - 1];
          const dropped = point?.deltas.some((d) => d.amount < 0) ?? false;
          const gained = point?.deltas.some((d) => d.amount > 0) ?? false;
          return (
            <circle
              key={i}
              cx={x(i)}
              cy={y(v)}
              r={3.5}
              className={
                v <= 0
                  ? "fill-red-600"
                  : dropped && !gained
                    ? "fill-red-500"
                    : gained && !dropped
                      ? "fill-emerald-500"
                      : "fill-muted-foreground"
              }
            />
          );
        })}
      </svg>
      {worstMoments.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {worstMoments.map((moment) => (
            <li key={moment.turnIdx} className="flex items-center gap-2 text-xs">
              <span className="font-mono text-red-500">
                {moment.drop.toFixed(0)}
              </span>
              <span className="text-muted-foreground">
                {moment.deltas
                  .filter((d) => d.amount < 0)
                  .map((d) => REASON_LABELS[d.reason])
                  .join(" + ")}
              </span>
              <a
                href={`#turn-${moment.turnIdx}`}
                className="text-primary underline-offset-2 hover:underline"
              >
                turn {moment.turnIdx}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

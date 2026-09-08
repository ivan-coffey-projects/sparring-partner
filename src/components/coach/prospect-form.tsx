"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  saveProspectAction,
  type ProspectPayload,
} from "@/app/coach/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FactDraft = ProspectPayload["facts"][number];

const NEW_FACT: FactDraft = {
  id: null,
  label: "",
  topic: "",
  truth: "",
  politeLie: "",
  unlockRule: { type: "reflection", topic: "", minAccuracy: 0.7 },
};

export function ProspectForm({ initial }: { initial: ProspectPayload }) {
  const [draft, setDraft] = useState<ProspectPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(update: Partial<ProspectPayload>) {
    setDraft((d) => ({ ...d, ...update }));
  }
  function patchPatience(
    update: Partial<ProspectPayload["patienceConfig"]>,
  ) {
    setDraft((d) => ({
      ...d,
      patienceConfig: { ...d.patienceConfig, ...update },
    }));
  }
  function patchCaps(update: Partial<ProspectPayload["concessionCaps"]>) {
    setDraft((d) => ({
      ...d,
      concessionCaps: { ...d.concessionCaps, ...update },
    }));
  }
  function patchFact(index: number, update: Partial<FactDraft>) {
    setDraft((d) => ({
      ...d,
      facts: d.facts.map((fact, i) =>
        i === index ? { ...fact, ...update } : fact,
      ),
    }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      // Reflection rules follow their fact's topic key.
      const normalized: ProspectPayload = {
        ...draft,
        facts: draft.facts.map((fact) => ({
          ...fact,
          unlockRule:
            fact.unlockRule.type === "reflection"
              ? { ...fact.unlockRule, topic: fact.topic }
              : fact.unlockRule,
        })),
      };
      const result = await saveProspectAction(normalized);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-8">
      {/* ── Identity ────────────────────────────────────────────── */}
      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Dana Whitfield"
          />
        </Field>
        <Field label="Job title">
          <Input
            value={draft.jobTitle}
            onChange={(e) => patch({ jobTitle: e.target.value })}
            placeholder="VP of Operations"
          />
        </Field>
        <Field label="Company">
          <Input
            value={draft.company}
            onChange={(e) => patch({ company: e.target.value })}
            placeholder="Corvid Freight"
          />
        </Field>
        <Field label="Opening line">
          <Input
            value={draft.openingLine}
            onChange={(e) => patch({ openingLine: e.target.value })}
            placeholder="This is Dana. What's this about?"
          />
        </Field>
        <Field label="Persona" className="sm:col-span-2">
          <Textarea
            rows={4}
            value={draft.persona}
            onChange={(e) => patch({ persona: e.target.value })}
            placeholder="How they talk, what warms them up, what shuts them down…"
          />
        </Field>
        <Field
          label="Deal context (trainer-only, never enters the call)"
          className="sm:col-span-2"
        >
          <Textarea
            rows={2}
            value={draft.dealContext}
            onChange={(e) => patch({ dealContext: e.target.value })}
            placeholder="The real deal this prospect is modeled on."
          />
        </Field>
      </section>

      {/* ── Hidden file ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              The hidden file
            </h2>
            <p className="text-xs text-muted-foreground">
              Truths the prospect only reveals when earned. Until then, the
              polite lie is all the model ever sees.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              patch({ facts: [...draft.facts, { ...NEW_FACT }] })
            }
          >
            <Plus data-slot="icon" /> Add fact
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {draft.facts.map((fact, i) => (
            <div key={i} className="rounded-xl border bg-card p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Label">
                  <Input
                    value={fact.label}
                    onChange={(e) => patchFact(i, { label: e.target.value })}
                    placeholder="The actual budget"
                  />
                </Field>
                <Field label="Topic key (what reflections are matched against)">
                  <Input
                    value={fact.topic}
                    onChange={(e) => patchFact(i, { topic: e.target.value })}
                    placeholder="budget"
                  />
                </Field>
                <Field label="The truth (revealed only when earned)">
                  <Textarea
                    rows={3}
                    value={fact.truth}
                    onChange={(e) => patchFact(i, { truth: e.target.value })}
                  />
                </Field>
                <Field label="The polite lie (the script until then)">
                  <Textarea
                    rows={3}
                    value={fact.politeLie}
                    onChange={(e) =>
                      patchFact(i, { politeLie: e.target.value })
                    }
                  />
                </Field>
                <Field label="Unlocks via">
                  <Select
                    value={fact.unlockRule.type}
                    onValueChange={(value) =>
                      patchFact(i, {
                        unlockRule:
                          value === "reflection"
                            ? {
                                type: "reflection",
                                topic: fact.topic,
                                minAccuracy: 0.7,
                              }
                            : { type: "trust", minTrust: 15 },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reflection">
                        Accurate reflection on this topic
                      </SelectItem>
                      <SelectItem value="trust">
                        Cumulative trust threshold
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {fact.unlockRule.type === "reflection" ? (
                  <Field
                    label={`Minimum reflection accuracy: ${fact.unlockRule.minAccuracy.toFixed(2)}`}
                  >
                    <input
                      type="range"
                      min={0.5}
                      max={0.95}
                      step={0.05}
                      value={fact.unlockRule.minAccuracy}
                      onChange={(e) =>
                        patchFact(i, {
                          unlockRule: {
                            type: "reflection",
                            topic: fact.topic,
                            minAccuracy: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-primary"
                    />
                  </Field>
                ) : (
                  <Field label={`Trust required: ${fact.unlockRule.minTrust}`}>
                    <input
                      type="range"
                      min={5}
                      max={40}
                      step={1}
                      value={fact.unlockRule.minTrust}
                      onChange={(e) =>
                        patchFact(i, {
                          unlockRule: {
                            type: "trust",
                            minTrust: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-primary"
                    />
                  </Field>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={draft.facts.length <= 1}
                  onClick={() =>
                    patch({ facts: draft.facts.filter((_, j) => j !== i) })
                  }
                >
                  <Trash2 data-slot="icon" /> Remove fact
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Patience ────────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">Patience</h2>
        <p className="text-xs text-muted-foreground">
          A number that runs down in code. When it hits zero, they hang up.
        </p>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <SliderField
            label="Starting patience"
            value={draft.patienceConfig.initial}
            min={20}
            max={100}
            onChange={(v) => patchPatience({ initial: v })}
          />
          <SliderField
            label="Monologue threshold (words per turn)"
            value={draft.patienceConfig.monologueWordThreshold}
            min={40}
            max={200}
            onChange={(v) => patchPatience({ monologueWordThreshold: v })}
          />
          <SliderField
            label="Penalty per word over"
            value={draft.patienceConfig.monologuePenaltyPerWord}
            min={0}
            max={1}
            step={0.05}
            onChange={(v) => patchPatience({ monologuePenaltyPerWord: v })}
          />
          <SliderField
            label="Early-pitch penalty"
            value={draft.patienceConfig.earlyPitchPenalty}
            min={0}
            max={30}
            onChange={(v) => patchPatience({ earlyPitchPenalty: v })}
          />
          <SliderField
            label="Discovery gate (facts before a pitch is earned)"
            value={draft.patienceConfig.discoveryGate}
            min={0}
            max={5}
            onChange={(v) => patchPatience({ discoveryGate: v })}
          />
          <SliderField
            label="Blunt-question penalty"
            value={draft.patienceConfig.bluntQuestionPenalty}
            min={0}
            max={25}
            onChange={(v) => patchPatience({ bluntQuestionPenalty: v })}
          />
          <SliderField
            label="Reflection regen"
            value={draft.patienceConfig.reflectionRegen}
            min={0}
            max={15}
            onChange={(v) => patchPatience({ reflectionRegen: v })}
          />
          <SliderField
            label="Open-question regen"
            value={draft.patienceConfig.openQuestionRegen}
            min={0}
            max={10}
            onChange={(v) => patchPatience({ openQuestionRegen: v })}
          />
        </div>
      </section>

      {/* ── Concession caps ─────────────────────────────────────── */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold tracking-tight">
          Concession caps
        </h2>
        <p className="text-xs text-muted-foreground">
          Code-enforced limits prevent the prospect from making unauthorized
          commitments.
        </p>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <SliderField
            label="Facts required for a meeting"
            value={draft.concessionCaps.meetingRequiresFactsUnlocked}
            min={0}
            max={6}
            onChange={(v) => patchCaps({ meetingRequiresFactsUnlocked: v })}
          />
          <SliderField
            label="Patience required for a meeting"
            value={draft.concessionCaps.meetingRequiresPatienceAtLeast}
            min={0}
            max={80}
            onChange={(v) => patchCaps({ meetingRequiresPatienceAtLeast: v })}
          />
          <ToggleField
            label="Intro to the real signer possible"
            checked={draft.concessionCaps.allowIntro}
            onChange={(v) => patchCaps({ allowIntro: v })}
          />
          <SliderField
            label="Facts required for an intro"
            value={draft.concessionCaps.introRequiresFactsUnlocked}
            min={0}
            max={6}
            onChange={(v) => patchCaps({ introRequiresFactsUnlocked: v })}
          />
          <ToggleField
            label="Pilot possible on this call"
            checked={draft.concessionCaps.allowPilot}
            onChange={(v) => patchCaps({ allowPilot: v })}
          />
          <SliderField
            label="Max pilot budget ($)"
            value={draft.concessionCaps.maxPilotBudget}
            min={0}
            max={100000}
            step={1000}
            onChange={(v) => patchCaps({ maxPilotBudget: v })}
          />
          <ToggleField
            label="Timeline change possible"
            checked={draft.concessionCaps.allowTimelineChange}
            onChange={(v) => patchCaps({ allowTimelineChange: v })}
          />
          <SliderField
            label="Max total commitments per call"
            value={draft.concessionCaps.maxConcessionsTotal}
            min={0}
            max={4}
            onChange={(v) => patchCaps({ maxConcessionsTotal: v })}
          />
        </div>
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 pb-10">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save prospect"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

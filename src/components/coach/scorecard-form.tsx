"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  saveScorecardAction,
  type ScorecardPayload,
} from "@/app/coach/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface MethodologyOption {
  id: string;
  name: string;
  entries: Array<{ id: string; number: string; title: string }>;
}

type CriterionDraft = ScorecardPayload["criteria"][number];

export function ScorecardForm({
  initial,
  methodologies,
}: {
  initial: ScorecardPayload;
  methodologies: MethodologyOption[];
}) {
  const [draft, setDraft] = useState<ScorecardPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const methodology = methodologies.find((m) => m.id === draft.methodologyId);

  function patchCriterion(index: number, update: Partial<CriterionDraft>) {
    setDraft((d) => ({
      ...d,
      criteria: d.criteria.map((criterion, i) =>
        i === index ? { ...criterion, ...update } : criterion,
      ),
    }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveScorecardAction(draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Name
          </Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Discovery Call Scorecard"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Methodology
          </Label>
          <Select
            value={draft.methodologyId || undefined}
            onValueChange={(value) =>
              setDraft((d) => ({
                ...d,
                methodologyId: value,
                criteria: d.criteria.map((c) => ({
                  ...c,
                  methodologyEntryIds: [],
                })),
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a methodology" />
            </SelectTrigger>
            <SelectContent>
              {methodologies.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Criteria</h2>
            <p className="text-xs text-muted-foreground">
              Each criterion must cite the methodology entries it grades
              against.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                criteria: [
                  ...d.criteria,
                  {
                    id: null,
                    label: "",
                    description: "",
                    weight: 1,
                    methodologyEntryIds: [],
                  },
                ],
              }))
            }
          >
            <Plus data-slot="icon" /> Add criterion
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {draft.criteria.map((criterion, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px_auto]">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Label
                  </Label>
                  <Input
                    value={criterion.label}
                    onChange={(e) =>
                      patchCriterion(i, { label: e.target.value })
                    }
                    placeholder="Discovery before pitch"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Description
                  </Label>
                  <Input
                    value={criterion.description}
                    onChange={(e) =>
                      patchCriterion(i, { description: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Weight
                  </Label>
                  <Input
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={criterion.weight}
                    onChange={(e) =>
                      patchCriterion(i, { weight: Number(e.target.value) })
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6 text-destructive"
                  disabled={draft.criteria.length <= 1}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      criteria: d.criteria.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 data-slot="icon" />
                </Button>
              </div>
              <div className="mt-3">
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Grades against
                </Label>
                {methodology ? (
                  <div className="flex flex-wrap gap-1.5">
                    {methodology.entries.map((entry) => {
                      const selected = criterion.methodologyEntryIds.includes(
                        entry.id,
                      );
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() =>
                            patchCriterion(i, {
                              methodologyEntryIds: selected
                                ? criterion.methodologyEntryIds.filter(
                                    (id) => id !== entry.id,
                                  )
                                : [...criterion.methodologyEntryIds, entry.id],
                            })
                          }
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs transition-colors",
                            selected
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40",
                          )}
                        >
                          <span className="font-mono">{entry.number}</span>{" "}
                          {entry.title}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Pick a methodology first.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end pb-10">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save scorecard"}
        </Button>
      </div>
    </div>
  );
}

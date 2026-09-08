import { describe, expect, it } from "vitest";
import { ArtifactParseError, parseArtifact } from "@/review/parse";

describe("parseArtifact", () => {
  it("maps rep aliases to rep and everyone else to prospect", () => {
    const { turns, labels } = parseArtifact(
      [
        "Rep: Hey Dana, quick question about routing.",
        "Dana: Who is this?",
        "Me: Jamie from Atlas — we met at Fleet Ops.",
        "Them: Oh right. What's up?",
      ].join("\n"),
    );
    expect(turns.map((t) => t.speaker)).toEqual([
      "rep",
      "prospect",
      "rep",
      "prospect",
    ]);
    expect(labels["Dana"]).toBe("prospect");
  });

  it("keeps continuation lines inside the same message, verbatim", () => {
    const raw = [
      "Me: First paragraph of the email.",
      "Second paragraph, no label.",
      "Them: Short reply.",
    ].join("\n");
    const { turns } = parseArtifact(raw);
    expect(turns).toHaveLength(2);
    expect(turns[0].text).toContain("First paragraph");
    expect(turns[0].text).toContain("Second paragraph");
  });

  it("turns bracketed lines into system annotations", () => {
    const { turns } = parseArtifact(
      ["Me: Hello?", "[2 days later]", "Me: Following up."].join("\n"),
    );
    expect(turns[1]).toMatchObject({ speaker: "system", text: "[2 days later]" });
    expect(turns.map((t) => t.idx)).toEqual([0, 1, 2]);
  });

  it("keeps Subject: lines inside the rep message", () => {
    const { turns } = parseArtifact(
      ["Subject: quick question", "Me: Saw the Q3 filing — worth a look?"].join(
        "\n",
      ),
    );
    expect(turns).toHaveLength(1);
    expect(turns[0].speaker).toBe("rep");
    expect(turns[0].text).toContain("Subject: quick question");
  });

  it("assumes an unlabeled artifact opens with the rep", () => {
    const { turns } = parseArtifact("Hey — quick question about your routing.");
    expect(turns[0].speaker).toBe("rep");
  });

  it("rejects empty pastes and prospect-only artifacts", () => {
    expect(() => parseArtifact("   \n\n  ")).toThrow(ArtifactParseError);
    expect(() =>
      parseArtifact("Them: hello\nThem: anyone there?"),
    ).toThrow(ArtifactParseError);
  });
});

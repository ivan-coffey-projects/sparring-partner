import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { reviews } from "@/db/schema";
import { gradeReview, deriveArtifactEvents } from "@/review/grade-review";
import { parseArtifact } from "@/review/parse";
import { newId } from "@/lib/ids";
import { insertFixture } from "./fixtures";

const RAMBLE =
  "So the way our platform works is that we take all of your routing data and we run it through our proprietary optimization engine which has been trained on millions of loads across every major lane in the country and what that means for you is that you get better utilization and fewer empty miles and our customers typically see improvements within the first thirty days and honestly the onboarding is really smooth too because we have a dedicated customer success team that walks you through every step of the process and I really think if you just give us a chance you will see the difference almost immediately.";

function createReview(rawText: string, channel: "call" | "sms") {
  const fixture = insertFixture();
  const { turns } = parseArtifact(rawText);
  const id = newId();
  db.insert(reviews)
    .values({
      id,
      userId: fixture.repId,
      channel,
      stage: "cold",
      title: "Test review",
      rawText,
      turns,
      scorecardId: fixture.scorecardId,
      status: "pending",
      createdAt: Date.now(),
    })
    .run();
  return id;
}

describe("review grading (mock models)", () => {
  it("grades a real call transcript with citable, gated coaching", async () => {
    const raw = [
      `Me: ${RAMBLE}`,
      "Them: That's a lot. Send me a deck.",
      "Me: Sounds like the timing isn't right — what would need to change?",
    ].join("\n");
    const id = createReview(raw, "call");
    await gradeReview(id);
    const review = db.select().from(reviews).where(eq(reviews.id, id)).get();
    expect(review?.status).toBe("ready");
    expect(review?.overallScore).not.toBeNull();
    expect(review?.criteriaScores?.length).toBeGreaterThan(0);
    // The monologue is code-detected and coached with a verbatim citation.
    const monologuePoint = review?.coachingPoints?.find((p) =>
      p.comment.includes("words"),
    );
    expect(monologuePoint).toBeDefined();
    expect(raw).toContain(monologuePoint!.transcriptQuote);
  });

  it("computes channel-appropriate metric events", () => {
    const { turns } = parseArtifact(
      [
        `Me: ${RAMBLE}`,
        "Them: stop texting me",
        "Me: Just following up on my last text.",
      ].join("\n"),
    );
    const events = deriveArtifactEvents("sms", turns);
    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain("wall_of_text");
    expect(kinds).toContain("guilt_trip");
    // Call-only monologue detection must not fire on SMS.
    expect(kinds).not.toContain("monologue");
  });
});

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reviews } from "@/db/schema";
import { gradeReview } from "@/review/grade-review";

/** In-process review grading, same shape as the call-grading queue. */
export function scheduleReviewGrading(reviewId: string): void {
  setTimeout(() => {
    void runReviewGrading(reviewId);
  }, 0);
}

export async function runReviewGrading(reviewId: string): Promise<void> {
  try {
    await gradeReview(reviewId);
  } catch (error) {
    db.update(reviews)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        gradingStartedAt: null,
      })
      .where(eq(reviews.id, reviewId))
      .run();
  }
}

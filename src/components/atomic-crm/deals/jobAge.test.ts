import { describe, expect, it } from "vitest";

import { ageLabel, ageShort, columnAge, jobAge, toneFor } from "./jobAge";

const NOW = new Date("2026-11-21T18:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

const job = (stage: string, enteredDaysAgo: number, createdDaysAgo = 30) => ({
  stage,
  stage_changed_at: daysAgo(enteredDaysAgo),
  created_at: daysAgo(createdDaysAgo),
});

describe("jobAge", () => {
  it("counts whole days since the job entered its stage", () => {
    expect(jobAge(job("quoted", 4), NOW)?.days).toBe(4);
  });

  it("falls back to the creation date when the stage never changed", () => {
    const age = jobAge(
      { stage: "intake", stage_changed_at: undefined, created_at: daysAgo(2) },
      NOW,
    );
    expect(age?.days).toBe(2);
    expect(age?.since).toBe(daysAgo(2));
  });

  it("is green, amber then red as a quote waits past 3 and 7 days", () => {
    expect(jobAge(job("quoted", 2), NOW)?.tone).toBe("fresh");
    expect(jobAge(job("quoted", 3), NOW)?.tone).toBe("aging");
    expect(jobAge(job("quoted", 7), NOW)?.tone).toBe("stale");
  });

  it("turns an intake red after 3 days and parts on the way after 14", () => {
    expect(toneFor("intake", 3)).toBe("stale");
    expect(toneFor("parts_on_the_way", 13)).toBe("aging");
    expect(toneFor("parts_on_the_way", 14)).toBe("stale");
  });

  it("gives booked jobs and unknown stages an age with no colour", () => {
    expect(jobAge(job("booked", 20), NOW)?.tone).toBeNull();
    expect(toneFor("some_new_stage", 99)).toBeNull();
  });

  it("leaves closed jobs out", () => {
    expect(jobAge(job("won", 1), NOW)).toBeNull();
    expect(jobAge(job("lost", 1), NOW)).toBeNull();
  });

  it("never shows a negative age for a clock a little ahead", () => {
    expect(
      jobAge(
        {
          stage: "intake",
          stage_changed_at: new Date(NOW.getTime() + 60_000).toISOString(),
          created_at: daysAgo(1),
        },
        NOW,
      )?.days,
    ).toBe(0);
  });
});

describe("columnAge", () => {
  it("reports the oldest job and how many are late", () => {
    expect(
      columnAge(
        [
          job("quoted", 1),
          job("quoted", 4),
          job("quoted", 9),
          job("quoted", 12),
        ],
        NOW,
      ),
    ).toEqual({ oldestDays: 12, aging: 1, stale: 2 });
  });

  it("is empty for an empty or closed column", () => {
    expect(columnAge([], NOW).oldestDays).toBeNull();
    expect(columnAge([job("won", 40)], NOW).oldestDays).toBeNull();
  });
});

describe("age labels", () => {
  it("reads naturally", () => {
    expect(ageLabel(0)).toBe("Today");
    expect(ageLabel(1)).toBe("1 day");
    expect(ageShort(9)).toBe("9d");
  });
});

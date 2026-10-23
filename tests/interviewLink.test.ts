import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GYMS, MOCK_INTERVIEW_GYM } from "@/content/gyms";

describe("mock interview link", () => {
  it("is on the last gym (Kernel Summit, the interview gauntlet)", () => {
    expect(GYMS[GYMS.length - 1].id).toBe(MOCK_INTERVIEW_GYM);
    expect(GYMS.find((g) => g.id === MOCK_INTERVIEW_GYM)?.name).toBe("Kernel Summit");
  });

  it("points at a route that exists", () => {
    expect(existsSync("app/interview/page.tsx")).toBe(true);
  });
});

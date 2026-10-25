import { describe, expect, it } from "vitest";
import { scoreToDecision } from "@/lib/ai-review";
import { DEFAULT_RULES } from "@/lib/rules";

const cfg = DEFAULT_RULES.aiReview;

describe("AI 审核分数 → 结论与扣分", () => {
  it("≥ 80 通过不扣", () => {
    expect(scoreToDecision(80, cfg)).toEqual({ verdict: "PASS", deductionPct: 0 });
    expect(scoreToDecision(95, cfg)).toEqual({ verdict: "PASS", deductionPct: 0 });
  });
  it("60–79 扣 20%，40–59 扣 50%，40 以下扣 100%", () => {
    expect(scoreToDecision(79, cfg)).toEqual({ verdict: "FAIL", deductionPct: 20 });
    expect(scoreToDecision(60, cfg)).toEqual({ verdict: "FAIL", deductionPct: 20 });
    expect(scoreToDecision(59, cfg)).toEqual({ verdict: "FAIL", deductionPct: 50 });
    expect(scoreToDecision(40, cfg)).toEqual({ verdict: "FAIL", deductionPct: 50 });
    expect(scoreToDecision(39, cfg)).toEqual({ verdict: "FAIL", deductionPct: 100 });
    expect(scoreToDecision(0, cfg)).toEqual({ verdict: "FAIL", deductionPct: 100 });
  });
  it("分数段顺序无关，阈值可配置", () => {
    const c = { enabled: true, passScore: 70, bands: [{ minScore: 0, deductionPct: 80 }, { minScore: 50, deductionPct: 30 }] };
    expect(scoreToDecision(72, c).verdict).toBe("PASS");
    expect(scoreToDecision(55, c)).toEqual({ verdict: "FAIL", deductionPct: 30 });
    expect(scoreToDecision(10, c)).toEqual({ verdict: "FAIL", deductionPct: 80 });
  });
});

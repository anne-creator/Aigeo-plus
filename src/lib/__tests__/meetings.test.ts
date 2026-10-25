import { describe, expect, it } from "vitest";
import { bjDateTime, bjTime, meetingProgress } from "@/lib/meetings";

const m = (statuses: string[], canceled = false) => ({
  organizerId: "o",
  canceledAt: canceled ? new Date() : null,
  invites: [{ userId: "o", status: "ACCEPTED" }, ...statuses.map((s, i) => ({ userId: `u${i}`, status: s }))],
});

describe("meetingProgress：全员同意才确认", () => {
  it("有人未回复 → 等待确认，发起人不计入", () => {
    expect(meetingProgress(m(["ACCEPTED", "PENDING", "ACCEPTED"]))).toEqual({ state: "PENDING", total: 3, accepted: 2, declined: 0, pending: 1 });
  });
  it("全部同意 → 已确认", () => {
    expect(meetingProgress(m(["ACCEPTED", "ACCEPTED"])).state).toBe("CONFIRMED");
  });
  it("有人拒绝 → 有人拒绝（即使其他人都同意）", () => {
    expect(meetingProgress(m(["ACCEPTED", "DECLINED"])).state).toBe("DECLINED");
  });
  it("取消优先；没有邀请任何人不算确认", () => {
    expect(meetingProgress(m(["ACCEPTED"], true)).state).toBe("CANCELED");
    expect(meetingProgress(m([])).state).toBe("PENDING");
  });
});

describe("北京时间", () => {
  it("bjDateTime / bjTime 往返", () => {
    const d = bjDateTime("2026-10-23", "14:30")!;
    expect(d.toISOString()).toBe("2026-10-23T06:30:00.000Z");
    expect(bjTime(d)).toBe("14:30");
    expect(bjDateTime("2026-10-23", "25:00")).toBeNull();
  });
});

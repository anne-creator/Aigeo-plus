import { expect, it } from "vitest";
import { isSameOriginRequest } from "../request-origin";

it("使用实际 Host 验证来源，兼容 Next.js 内部 localhost URL", () => {
  const request = (origin?: string, host = "app.example.com") => new Request("http://localhost/api/uploads/prepare", {
    headers: { host, ...(origin ? { origin } : {}) },
  });
  expect(isSameOriginRequest(request("https://app.example.com"))).toBe(true);
  expect(isSameOriginRequest(request("https://evil.example.com"))).toBe(false);
  expect(isSameOriginRequest(request("https://app.example.com.evil.test"))).toBe(false);
  expect(isSameOriginRequest(request("null"))).toBe(false);
  expect(isSameOriginRequest(request())).toBe(false);
  expect(isSameOriginRequest(request("http://127.0.0.1:3001", "127.0.0.1:3001"))).toBe(true);
  expect(isSameOriginRequest(request("http://127.0.0.1:3000", "127.0.0.1:3001"))).toBe(false);
});

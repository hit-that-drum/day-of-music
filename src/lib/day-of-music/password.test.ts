import { describe, expect, it } from "vitest";

import { passwordIssues } from "@/lib/day-of-music/password";

const failedRules = (pw: string) => passwordIssues(pw).map((rule) => rule.id);

describe("passwordIssues", () => {
  it("lists every failed rule in policy order", () => {
    expect(failedRules("")).toEqual(["length", "letter", "number"]);
    expect(failedRules("abc")).toEqual(["length", "number"]);
    expect(failedRules("12345678")).toEqual(["letter"]);
    expect(failedRules("abcdefgh")).toEqual(["number"]);
  });

  it("passes at eight characters with a letter and a digit", () => {
    expect(failedRules("abcd1234")).toEqual([]);
  });

  it("counts letters from any script, not just ASCII", () => {
    expect(failedRules("비밀번호1234")).toEqual([]);
    expect(failedRules("ñandú123")).toEqual([]);
  });
});

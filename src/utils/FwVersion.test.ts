import { describe, expect, it } from "vitest";
import { isFwOlderThan, parseFwVersion } from "./FwVersion";

describe("parseFwVersion", () => {
  it("parses the node info format", () => {
    expect(parseFwVersion("4.35 v")).toEqual({ major: 4, minor: 35, sub: "v" });
    expect(parseFwVersion("C 4.29 d")).toEqual({ major: 4, minor: 29, sub: "d" });
    expect(parseFwVersion("4.35")).toEqual({ major: 4, minor: 35, sub: "" });
    expect(parseFwVersion("4.35 A")).toEqual({ major: 4, minor: 35, sub: "a" });
  });

  it("returns null for unknown values", () => {
    expect(parseFwVersion("0.0.0")).toBeNull();
    expect(parseFwVersion("")).toBeNull();
    expect(parseFwVersion(undefined)).toBeNull();
    expect(parseFwVersion("n/a")).toBeNull();
  });
});

describe("isFwOlderThan (min 4.35 v)", () => {
  it("flags older firmware", () => {
    expect(isFwOlderThan("4.35 p")).toBe(true);
    expect(isFwOlderThan("4.35 u")).toBe(true);
    expect(isFwOlderThan("4.35")).toBe(true);
    expect(isFwOlderThan("4.34 z")).toBe(true);
    expect(isFwOlderThan("C 4.29 d")).toBe(true);
    expect(isFwOlderThan("3.99 z")).toBe(true);
  });

  it("accepts the minimum and newer firmware", () => {
    expect(isFwOlderThan("4.35 v")).toBe(false);
    expect(isFwOlderThan("4.35 w")).toBe(false);
    expect(isFwOlderThan("4.36 a")).toBe(false);
    expect(isFwOlderThan("4.36")).toBe(false);
    expect(isFwOlderThan("5.00 a")).toBe(false);
  });

  it("never flags an unknown version", () => {
    expect(isFwOlderThan("0.0.0")).toBe(false);
    expect(isFwOlderThan("")).toBe(false);
    expect(isFwOlderThan(undefined)).toBe(false);
  });
});

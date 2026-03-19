import { Belt } from "@tatame/types";
import { describe, expect, it } from "vitest";
import { HttpError } from "../../lib/http-error.js";
import {
  assertValidBeltRank,
  assertValidPromotion,
} from "./graduation.service.js";

describe("assertValidBeltRank", () => {
  it("rejects stripes above max for white", () => {
    expect(() => assertValidBeltRank(Belt.White, 5)).toThrow(HttpError);
  });

  it("accepts black belt 10 stripes", () => {
    expect(() => assertValidBeltRank(Belt.Black, 10)).not.toThrow();
  });
});

describe("assertValidPromotion", () => {
  it("allows next belt with fewer stripes", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Blue, stripes: 4 },
        { belt: Belt.Purple, stripes: 0 },
      ),
    ).not.toThrow();
  });

  it("allows more stripes on same belt", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Blue, stripes: 1 },
        { belt: Belt.Blue, stripes: 3 },
      ),
    ).not.toThrow();
  });

  it("rejects lower belt", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Purple, stripes: 0 },
        { belt: Belt.Blue, stripes: 4 },
      ),
    ).toThrow(HttpError);
  });

  it("rejects fewer stripes on same belt", () => {
    expect(() =>
      assertValidPromotion(
        { belt: Belt.Brown, stripes: 3 },
        { belt: Belt.Brown, stripes: 2 },
      ),
    ).toThrow(HttpError);
  });
});

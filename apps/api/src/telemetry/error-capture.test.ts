import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import {
  CAPTURED_ERROR,
  captureErrorBody,
  recordAppError,
  type CapturedError,
} from "./error-capture.js";

/** Minimal stand-in for the parts of `res` the middleware touches. */
function fakeResponse(statusCode: number) {
  const sent: unknown[] = [];
  const res = {
    statusCode,
    json(body?: unknown) {
      sent.push(body);
      return this as unknown as Response;
    },
  } as unknown as Response;
  return { res, sent };
}

function run(statusCode: number, body: unknown) {
  const { res, sent } = fakeResponse(statusCode);
  const next = vi.fn() as unknown as NextFunction;
  captureErrorBody({} as Request, res, next);
  res.json(body);
  return {
    captured: (res as Response & { [CAPTURED_ERROR]?: CapturedError })[CAPTURED_ERROR],
    sent,
    next,
  };
}

describe("captureErrorBody", () => {
  it("calls next so the chain continues", () => {
    const { res } = fakeResponse(200);
    const next = vi.fn() as unknown as NextFunction;
    captureErrorBody({} as Request, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("still sends the original body through", () => {
    const { sent } = run(401, { error: "Unauthorized" });
    expect(sent).toEqual([{ error: "Unauthorized" }]);
  });

  it("captures nothing for a successful response", () => {
    expect(run(200, { ok: true }).captured).toBeUndefined();
  });

  it("captures nothing for a 3xx", () => {
    expect(run(302, { to: "/login" }).captured).toBeUndefined();
  });

  it("captures the envelope of a 4xx", () => {
    expect(run(401, { error: "Unauthorized" }).captured?.body).toBe(
      '{"error":"Unauthorized"}',
    );
  });

  it("captures the envelope of a 5xx", () => {
    expect(run(500, { error: "boom" }).captured?.body).toBe('{"error":"boom"}');
  });

  describe("error.type extraction", () => {
    it("promotes a screaming-snake-case application code", () => {
      const { captured } = run(422, {
        error: "CHECKIN_WINDOW_CLOSED",
        message: "Janela fechada",
      });
      expect(captured?.code).toBe("CHECKIN_WINDOW_CLOSED");
    });

    it("ignores a free-form message, which would be high cardinality", () => {
      const { captured } = run(503, {
        error: "Clerk não configurado (CLERK_SECRET_KEY)",
      });
      expect(captured?.code).toBeUndefined();
    });

    it("ignores a mixed-case word", () => {
      expect(run(401, { error: "Unauthorized" }).captured?.code).toBeUndefined();
    });

    it("ignores a non-string error field", () => {
      const { captured } = run(400, { error: { fieldErrors: { name: ["req"] } } });
      expect(captured?.code).toBeUndefined();
    });

    it("ignores a body that is not an object", () => {
      expect(run(400, "plain text").captured?.code).toBeUndefined();
    });
  });

  describe("redaction", () => {
    it("redacts sensitive keys at any depth", () => {
      const { captured } = run(400, {
        error: { fieldErrors: { password: ["too short"], name: ["required"] } },
      });
      expect(captured?.body).toContain('"password":"[redacted]"');
      expect(captured?.body).toContain('"name":["required"]');
    });

    it("redacts short words like `key` on a segment boundary", () => {
      const { captured } = run(400, {
        apiKey: "secret-value",
        api_key: "secret-value",
        access_token: "secret-value",
        userPassword: "secret-value",
      });
      expect(captured?.body).not.toContain("secret-value");
      expect(JSON.parse(captured?.body ?? "{}")).toEqual({
        apiKey: "[redacted]",
        api_key: "[redacted]",
        access_token: "[redacted]",
        userPassword: "[redacted]",
      });
    });

    it("leaves a word that merely ends in a short sensitive segment alone", () => {
      // Matching `key` as a substring would have redacted both of these.
      const { captured } = run(400, { monkey: "curious", pinned: true });
      expect(JSON.parse(captured?.body ?? "{}")).toEqual({
        monkey: "curious",
        pinned: true,
      });
    });
  });

  describe("serialization limits", () => {
    it("truncates a body over the cap", () => {
      const { captured } = run(400, { error: "x".repeat(5000) });
      expect(captured?.body).toHaveLength(2048 + "…[truncated]".length);
      expect(captured?.body.endsWith("…[truncated]")).toBe(true);
    });

    it("does not truncate a small body", () => {
      expect(run(400, { error: "small" }).captured?.body).toBe('{"error":"small"}');
    });

    it("survives a circular body by bottoming out at max depth", () => {
      const circular: Record<string, unknown> = { error: "loop" };
      circular.self = circular;
      const body = run(500, circular).captured?.body;
      expect(body).toContain("[max depth]");
      expect(body).toContain('"error":"loop"');
    });

    it("falls back to a marker for a value JSON cannot express", () => {
      expect(run(500, { error: "boom", size: 1n }).captured?.body).toBe(
        "[unserializable]",
      );
    });

    it("stops at max depth rather than walking forever", () => {
      let deep: Record<string, unknown> = { bottom: true };
      for (let i = 0; i < 12; i += 1) deep = { nested: deep };
      expect(run(400, deep).captured?.body).toContain("[max depth]");
    });

    it("passes a string body through unchanged", () => {
      expect(run(400, "Bad Request").captured?.body).toBe("Bad Request");
    });
  });
});

describe("recordAppError", () => {
  it("attaches the error so the hook can record a stack", () => {
    const { res } = fakeResponse(500);
    const error = new Error("boom");
    recordAppError(res, error);
    const captured = (res as Response & { [CAPTURED_ERROR]?: CapturedError })[
      CAPTURED_ERROR
    ];
    expect(captured?.error).toBe(error);
  });

  it("keeps the error when the body is captured afterwards", () => {
    const { res } = fakeResponse(500);
    const next = vi.fn() as unknown as NextFunction;
    captureErrorBody({} as Request, res, next);
    const error = new Error("boom");

    // The real order: `errorHandler` records, then responds.
    recordAppError(res, error);
    res.json({ error: "boom" });

    const captured = (res as Response & { [CAPTURED_ERROR]?: CapturedError })[
      CAPTURED_ERROR
    ];
    expect(captured?.error).toBe(error);
    expect(captured?.body).toBe('{"error":"boom"}');
  });

  it("keeps an already-captured body if called in the other order", () => {
    const { res } = fakeResponse(500);
    const next = vi.fn() as unknown as NextFunction;
    captureErrorBody({} as Request, res, next);

    res.json({ error: "boom" });
    recordAppError(res, new Error("late"));

    const captured = (res as Response & { [CAPTURED_ERROR]?: CapturedError })[
      CAPTURED_ERROR
    ];
    expect(captured?.body).toBe('{"error":"boom"}');
  });
});

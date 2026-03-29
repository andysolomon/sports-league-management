import { describe, it, expect, vi, beforeEach } from "vitest";
import { classifyError, handleApiError, ApiError } from "../api-error";

describe("classifyError", () => {
  it("returns 503 for missing SF JWT config", () => {
    const err = new Error("Missing Salesforce JWT config. Set SF_CLIENT_ID, SF_USERNAME, and SF_PRIVATE_KEY env vars.");
    expect(classifyError(err)).toEqual({
      statusCode: 503,
      userMessage: "Service temporarily unavailable",
    });
  });

  it("returns 503 for JWT auth failure", () => {
    const err = new Error('Salesforce JWT auth failed: {"error":"invalid_grant"}');
    expect(classifyError(err)).toEqual({
      statusCode: 503,
      userMessage: "Service temporarily unavailable",
    });
  });

  it("returns 503 for INVALID_SESSION_ID", () => {
    const err = new Error("INVALID_SESSION_ID: Session expired or invalid");
    expect(classifyError(err)).toEqual({
      statusCode: 503,
      userMessage: "Service temporarily unavailable",
    });
  });

  it("returns 502 for Salesforce API error", () => {
    const err = new Error("Salesforce API error");
    expect(classifyError(err)).toEqual({
      statusCode: 502,
      userMessage: "Upstream service error",
    });
  });

  it("returns 503 for network TypeError", () => {
    const err = new TypeError("fetch failed");
    expect(classifyError(err)).toEqual({
      statusCode: 503,
      userMessage: "Service temporarily unavailable",
    });
  });

  it("returns 500 for generic unknown error", () => {
    const err = new Error("something unexpected");
    expect(classifyError(err)).toEqual({
      statusCode: 500,
      userMessage: "Internal server error",
    });
  });

  it("passes through ApiError status and message", () => {
    const err = new ApiError({ statusCode: 404, message: "Not found" });
    expect(classifyError(err)).toEqual({
      statusCode: 404,
      userMessage: "Not found",
    });
  });
});

describe("handleApiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns NextResponse with correct status and safe message", async () => {
    const err = new Error("Salesforce JWT auth failed: secret stuff");
    const response = handleApiError(err, "/api/teams");

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toEqual({ error: "Service temporarily unavailable" });
  });

  it("never exposes raw error details in response body", async () => {
    const err = new Error("Salesforce JWT auth failed: grant_type=jwt-bearer&client_id=secret123");
    const response = handleApiError(err);
    const body = await response.json();

    expect(body.error).not.toContain("jwt-bearer");
    expect(body.error).not.toContain("secret123");
    expect(body.error).not.toContain("Salesforce");
    expect(body.error).not.toContain("jsforce");
  });

  it("logs structured JSON with expected fields", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("test error");
    handleApiError(err, "/api/leagues");

    expect(consoleSpy).toHaveBeenCalled();
    const logged = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string);
    expect(logged).toMatchObject({
      level: "error",
      statusCode: 500,
      message: "test error",
      route: "/api/leagues",
    });
    expect(logged.timestamp).toBeDefined();
    expect(logged.stack).toBeDefined();
  });
});

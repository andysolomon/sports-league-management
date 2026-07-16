import { NextResponse } from "next/server";

export class ApiError extends Error {
  statusCode: number;
  userMessage: string;
  details?: unknown;

  constructor({
    statusCode,
    message,
    details,
  }: {
    statusCode: number;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.userMessage = message;
    this.details = details;
  }
}

interface ClassifiedError {
  statusCode: number;
  userMessage: string;
}

// Legacy upstream error strings (still recognized for safe user-facing responses).
const UPSTREAM_CONNECTION_PATTERNS = [
  "Missing Salesforce JWT config",
  "Salesforce JWT auth failed",
  "INVALID_SESSION_ID",
  "Session expired",
  "invalid_grant",
];

const UPSTREAM_API_PATTERN = "Salesforce API error";

export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof ApiError) {
    return { statusCode: error.statusCode, userMessage: error.userMessage };
  }

  const message = error instanceof Error ? error.message : String(error);

  // Jersey policy (WSM-000125): the player create/update mutations throw
  // `duplicate_jersey:<n>` when a team disallows duplicates and the chosen
  // number is already worn. Surface a clear 409 the form can show inline.
  const jerseyMatch = message.match(/duplicate_jersey:(\d+)/);
  if (jerseyMatch) {
    return {
      statusCode: 409,
      userMessage: `Jersey #${jerseyMatch[1]} is already taken on this roster. This team blocks duplicate numbers.`,
    };
  }

  if (UPSTREAM_CONNECTION_PATTERNS.some((p) => message.includes(p))) {
    return { statusCode: 503, userMessage: "Service temporarily unavailable" };
  }

  if (
    error instanceof TypeError &&
    (message.includes("fetch") || message.includes("network"))
  ) {
    return { statusCode: 503, userMessage: "Service temporarily unavailable" };
  }

  if (message.includes(UPSTREAM_API_PATTERN)) {
    return { statusCode: 502, userMessage: "Upstream service error" };
  }

  return { statusCode: 500, userMessage: "Internal server error" };
}

export function handleApiError(
  error: unknown,
  route?: string,
): NextResponse {
  const { statusCode, userMessage } = classifyError(error);

  const rawMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack?.split("\n").slice(0, 5).join("\n") : undefined;

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      statusCode,
      message: rawMessage,
      route,
      stack,
    }),
  );

  return NextResponse.json({ error: userMessage }, { status: statusCode });
}

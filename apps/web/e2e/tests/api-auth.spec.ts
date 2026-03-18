import { test, expect } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/api/teams",
  "/api/teams/fake-id",
  "/api/players",
  "/api/players/fake-id",
  "/api/seasons",
  "/api/divisions",
  "/api/leagues",
];

test.describe("BFF API Auth Enforcement", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} returns 401 without Clerk session`, async ({ request }) => {
      const response = await request.get(route);
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toEqual({ error: "Unauthorized" });
    });
  }
});

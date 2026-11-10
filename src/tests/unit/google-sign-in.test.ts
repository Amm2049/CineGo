import { describe, expect, it } from "vitest";
import { decideGoogleSignIn, isGoogleSignInConfigured, normalizeEmail } from "@/lib/google-sign-in";

describe("decideGoogleSignIn", () => {
  it("creates a customer account for a new verified email", () => {
    expect(decideGoogleSignIn({ email: "new@gmail.com", emailVerified: true, existingRole: null })).toEqual({
      action: "create",
    });
  });

  it("logs an existing customer into their account", () => {
    expect(decideGoogleSignIn({ email: "a@gmail.com", emailVerified: true, existingRole: "CUSTOMER" })).toEqual({
      action: "login",
    });
  });

  it("refuses admin and staff accounts (they keep their password)", () => {
    for (const role of ["ADMIN", "STAFF"]) {
      expect(decideGoogleSignIn({ email: "x@cinego.com", emailVerified: true, existingRole: role })).toEqual({
        action: "refuse",
        reason: "StaffUsePassword",
      });
    }
  });

  it("refuses an unverified or missing email", () => {
    expect(decideGoogleSignIn({ email: "a@gmail.com", emailVerified: false, existingRole: null }).action).toBe("refuse");
    expect(decideGoogleSignIn({ email: "a@gmail.com", emailVerified: undefined, existingRole: "CUSTOMER" }).action).toBe(
      "refuse"
    );
    expect(decideGoogleSignIn({ email: null, emailVerified: true, existingRole: null }).action).toBe("refuse");
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Billy@Gmail.COM ")).toBe("billy@gmail.com");
  });
});

describe("isGoogleSignInConfigured", () => {
  it("needs both the client id and the secret", () => {
    expect(isGoogleSignInConfigured({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).toBe(true);
    expect(isGoogleSignInConfigured({ GOOGLE_CLIENT_ID: "id" })).toBe(false);
    expect(isGoogleSignInConfigured({ GOOGLE_CLIENT_ID: " ", GOOGLE_CLIENT_SECRET: "secret" })).toBe(false);
    expect(isGoogleSignInConfigured({})).toBe(false);
  });
});

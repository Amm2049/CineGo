// src/tests/unit/roles.test.ts
import { describe, it, expect } from "vitest";
import { homePathForRole, isCustomer, postLoginPath } from "@/lib/roles";

describe("isCustomer", () => {
  it("is true only for CUSTOMER", () => {
    expect(isCustomer("CUSTOMER")).toBe(true);
    expect(isCustomer("ADMIN")).toBe(false);
    expect(isCustomer("STAFF")).toBe(false);
    expect(isCustomer(undefined)).toBe(false);
    expect(isCustomer(null)).toBe(false);
  });
});

describe("homePathForRole", () => {
  it("sends each role to its own start page", () => {
    expect(homePathForRole("ADMIN")).toBe("/admin");
    expect(homePathForRole("STAFF")).toBe("/admin/scanner");
    expect(homePathForRole("CUSTOMER")).toBe("/");
    expect(homePathForRole(undefined)).toBe("/");
  });
});

describe("postLoginPath", () => {
  it("uses the role's home when there is no callback", () => {
    expect(postLoginPath(null, "ADMIN")).toBe("/admin");
    expect(postLoginPath(null, "STAFF")).toBe("/admin/scanner");
    expect(postLoginPath("", "CUSTOMER")).toBe("/");
  });

  it("returns customers to the page that asked them to log in", () => {
    expect(postLoginPath("/tickets", "CUSTOMER")).toBe("/tickets");
    expect(postLoginPath("/checkout/abc?x=1", "CUSTOMER")).toBe("/checkout/abc?x=1");
  });

  it("never sends customers into the admin area", () => {
    expect(postLoginPath("/admin", "CUSTOMER")).toBe("/");
    expect(postLoginPath("/admin/scanner", "CUSTOMER")).toBe("/");
  });

  it("sends admin/staff to the admin area, not to customer pages", () => {
    expect(postLoginPath("/admin/showtimes", "ADMIN")).toBe("/admin/showtimes");
    expect(postLoginPath("/checkout/abc", "ADMIN")).toBe("/admin");
    expect(postLoginPath("/tickets", "STAFF")).toBe("/admin/scanner");
    expect(postLoginPath("/administrator", "ADMIN")).toBe("/admin"); // prefix lookalike
  });

  it("ignores external and protocol-relative URLs (no open redirect)", () => {
    expect(postLoginPath("https://evil.example/", "CUSTOMER")).toBe("/");
    expect(postLoginPath("//evil.example/", "CUSTOMER")).toBe("/");
    expect(postLoginPath("/\\evil.example", "CUSTOMER")).toBe("/");
    expect(postLoginPath("javascript:alert(1)", "ADMIN")).toBe("/admin");
  });
});

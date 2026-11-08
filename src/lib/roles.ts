// src/lib/roles.ts
// Who may do what, and where each role lands. Pure functions: safe in proxy, server and client code.
//
// CUSTOMER books and holds tickets. ADMIN and STAFF accounts only run the cinema: they can browse
// the public catalog, but booking, tickets and the customer profile are for customer accounts.

export type RoleName = "CUSTOMER" | "STAFF" | "ADMIN";

export function isCustomer(role: string | null | undefined): boolean {
  return role === "CUSTOMER";
}

/** Where a role starts after logging in, and where it is sent from pages it can't use. */
export function homePathForRole(role: string | null | undefined): string {
  if (role === "ADMIN") return "/admin";
  if (role === "STAFF") return "/admin/scanner";
  return "/";
}

/**
 * Where to go after login: the page the user came from (`callbackUrl`) when it is a local path
 * that their role may use, otherwise the role's home page. Never follows an absolute or
 * protocol-relative URL (open redirect).
 */
export function postLoginPath(callbackUrl: string | null | undefined, role: string | null | undefined): string {
  const home = homePathForRole(role);
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//") || callbackUrl.startsWith("/\\")) {
    return home;
  }
  const path = callbackUrl.split(/[?#]/)[0];
  const isAdminArea = path === "/admin" || path.startsWith("/admin/");

  if (isCustomer(role)) return isAdminArea ? home : callbackUrl;
  // Admin/staff: only back into the admin area (the proxy narrows STAFF to the scanner)
  return isAdminArea ? callbackUrl : home;
}

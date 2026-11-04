// POST /api/admin/verify-ticket — body: { code: "CINEGO:<uuid>" or "<uuid>" }
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-guard";
import { verifyAndUseTicket, type VerifyTicketOutcome } from "@/services/ticket.service";

// Record<...> makes the build fail if a new outcome is added without a status code
const HTTP_STATUS: Record<VerifyTicketOutcome, number> = {
  ADMITTED: 200,
  ALREADY_USED: 409,
  NOT_FOUND: 404,
  INVALID_CODE: 400,
  TOO_EARLY: 422,
  SHOW_ENDED: 422,
};

export async function POST(request: NextRequest) {
  const staff = await requireStaff(); // the only /api/admin route open to STAFF
  if (!staff.ok) return staff.response;

  const body = await request.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code.trim() || code.length > 200) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  try {
    // The scanner's id comes from the session, never from the request body
    const result = await verifyAndUseTicket(code, staff.userId);
    return NextResponse.json(result, { status: HTTP_STATUS[result.outcome] });
  } catch (error) {
    console.error("[POST /api/admin/verify-ticket] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

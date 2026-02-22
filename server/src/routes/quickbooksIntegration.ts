import { Router, type Request, type Response } from "express";

const QB_SENDER_URL = "https://qaraqoyqobqzytrnsqje.supabase.co/functions/v1/qb-sender";

export const quickbooksIntegrationRouter = Router();

quickbooksIntegrationRouter.post("/quickbooks/send", async (req: Request, res: Response) => {
  const tenantIdFromContext = String(res.locals?.tenantId || "").trim();
  const tenantIdFromShopflowHeader = String(req.header("x-shopflow-tenant-id") || "").trim();

  if (tenantIdFromContext && tenantIdFromShopflowHeader && tenantIdFromContext !== tenantIdFromShopflowHeader) {
    return res.status(403).json({
      error: "tenant_mismatch",
      message: "x-shopflow-tenant-id must match the authenticated tenant context",
    });
  }

  const tenantId = tenantIdFromContext || tenantIdFromShopflowHeader;
  if (!tenantId) {
    return res.status(400).json({
      error: "tenant_required",
      message: "Unable to determine tenant context",
    });
  }

  const serviceKey = String(process.env.SHOPFLOW_SERVICE_KEY || "").trim();
  if (!serviceKey) {
    return res.status(500).json({
      error: "server_misconfigured",
      message: "SHOPFLOW_SERVICE_KEY is not configured",
    });
  }

  let upstreamResp: globalThis.Response;
  try {
    upstreamResp = await fetch(QB_SENDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shopflow-service-key": serviceKey,
        "x-shopflow-tenant-id": tenantId,
      },
      body: "{}",
    });
  } catch (err: any) {
    return res.status(502).json({
      error: "qb_sender_upstream_unreachable",
      message: err?.message || "Failed to reach qb-sender",
    });
  }

  const responseText = await upstreamResp.text();
  if (!upstreamResp.ok) {
    let upstreamBody: unknown = responseText;
    try {
      upstreamBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      // Keep raw text body when JSON parse fails.
    }
    return res.status(502).json({
      error: "qb_sender_upstream_failed",
      upstream_status: upstreamResp.status,
      upstream_body: upstreamBody,
    });
  }

  let responseJson: unknown;
  try {
    responseJson = responseText ? JSON.parse(responseText) : {};
  } catch {
    return res.status(502).json({
      error: "qb_sender_invalid_json",
      message: "qb-sender returned a non-JSON response",
      upstream_status: upstreamResp.status,
      upstream_body: responseText,
    });
  }

  return res.status(200).json(responseJson);
});

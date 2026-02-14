import { Request, Response, NextFunction } from "express";

export function adminKeyGate(req: Request, res: Response, next: NextFunction) {
  const providedKey = req.header("x-shopflow-admin-key");
  const expectedKey = process.env.SHOPFLOW_ADMIN_API_KEY || process.env.X_SHOPFLOW_ADMIN_KEY;

  if (!expectedKey || !providedKey || providedKey !== expectedKey) {
    return res.status(403).json({ error: "admin_key_invalid" });
  }

  return next();
}

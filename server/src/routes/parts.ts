import { Router, type Request, type Response } from "express";

type Part = Record<string, any>;

let partsStore: Part[] = [];

export const partsRouter = Router();

const coerceBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return undefined;
};

/**
 * GET /parts
 * Returns all parts in memory.
 */
partsRouter.get("/parts", (req: Request, res: Response) => {
  res.json(partsStore);
});

/**
 * POST /parts
 * Creates a new part.
 * - Accepts arbitrary shape from the client.
 * - If id is missing, generates a simple string id.
 * - Adds created_at / updated_at timestamps if not present.
 * - Enforces uniqueness:
 *   - part_number globally unique
 */
partsRouter.post("/parts", (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Request body must be an object" });
  }

  const isConsumable = coerceBoolean((body as any).is_consumable);
  const includeInValuation = coerceBoolean((body as any).include_in_valuation);
  const now = new Date().toISOString();
  const id = (body as any).id ?? Date.now().toString();

  const partNumber =
    typeof (body as any).part_number === "string"
      ? (body as any).part_number.trim()
      : "";

  // Enforce unique part_number (non-empty)
  if (
    partNumber &&
    partsStore.some((p) => {
      const existingPartNumber =
        typeof (p as any).part_number === "string"
          ? (p as any).part_number.trim()
          : "";
      return existingPartNumber === partNumber;
    })
  ) {
    return res.status(409).json({ error: "PART_NUMBER_NOT_UNIQUE" });
  }

  const isConsumableValue = isConsumable ?? false;
  const includeInValuationValue =
    includeInValuation ?? (isConsumableValue ? false : true);

  const part: Part = {
    ...body,
    id,
    created_at: (body as any).created_at ?? now,
    updated_at: now,
    is_consumable: isConsumableValue,
    include_in_valuation: includeInValuationValue,
  };

  partsStore.push(part);

  return res.status(201).json(part);
});

/**
 * PUT /parts/:id
 * Updates an existing part by id.
 * - Performs a shallow merge of the payload onto the existing part.
 * - Updates updated_at timestamp.
 * - Enforces uniqueness:
 *   - part_number globally unique (excluding self)
 */
partsRouter.put("/parts/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Request body must be an object" });
  }

  const index = partsStore.findIndex(
    (p) => String((p as any).id) === String(id)
  );

  if (index === -1) {
    return res.status(404).json({ error: "Part not found" });
  }

  const existing = partsStore[index];

  const partNumberFromBody =
    typeof (body as any).part_number === "string"
      ? (body as any).part_number.trim()
      : undefined;

  const newPartNumber =
    typeof partNumberFromBody === "string"
      ? partNumberFromBody
      : (existing as any).part_number;

  // Enforce unique part_number (if non-empty, excluding self)
  if (
    newPartNumber &&
    partsStore.some((p) => {
      if (String((p as any).id) === String(id)) return false;
      const existingPartNumber =
        typeof (p as any).part_number === "string"
          ? (p as any).part_number.trim()
          : "";
      return existingPartNumber === newPartNumber;
    })
  ) {
    return res.status(409).json({ error: "PART_NUMBER_NOT_UNIQUE" });
  }

  const now = new Date().toISOString();
  const isConsumable = coerceBoolean((body as any).is_consumable);
  const includeInValuation = coerceBoolean((body as any).include_in_valuation);
  const sanitized: Part = { ...body };

  if (isConsumable !== undefined) {
    sanitized.is_consumable = isConsumable;
  } else {
    delete sanitized.is_consumable;
  }

  if (includeInValuation !== undefined) {
    sanitized.include_in_valuation = includeInValuation;
  } else {
    delete sanitized.include_in_valuation;
  }

  const updated: Part = {
    ...existing,
    ...sanitized,
    id: (existing as any).id, // never change id
    updated_at: now,
  };

  partsStore[index] = updated;

  return res.json(updated);
});

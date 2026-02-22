#!/usr/bin/env node
import process from "process";
import { createClient } from "@supabase/supabase-js";

function getArg(name) {
  const args = process.argv.slice(2);
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function requiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`missing_env_${name}`);
  }
  return value;
}

function optionalEnv(name) {
  const value = String(process.env[name] || "").trim();
  return value || null;
}

function printJson(label, payload) {
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(payload, null, 2));
}

function toEpochMs(value) {
  const ms = Date.parse(String(value || ""));
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeTenantMatch(expectedTenantId, tenantIds) {
  if (!expectedTenantId) return "unknown";
  if (tenantIds.length === 0) return "unknown";
  return tenantIds.every((tenantId) => tenantId === expectedTenantId);
}

function isMissingSalesOrderIdError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42703" || (message.includes("sales_order_id") && message.includes("column"));
}

async function getTableColumns(client, schemaName, tableName) {
  const result = { ok: false, columns: [], error: null };
  try {
    const { data, error } = await client
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", schemaName)
      .eq("table_name", tableName);
    if (error) {
      result.error = {
        message: error.message,
        code: error.code ?? null,
      };
      return result;
    }
    result.ok = true;
    result.columns = (data ?? [])
      .map((row) => row?.column_name)
      .filter(Boolean)
      .map((name) => String(name));
    return result;
  } catch (error) {
    result.error = { message: error instanceof Error ? error.message : String(error) };
    return result;
  }
}

async function getCandidateSalesOrderTables(client) {
  try {
    const { data, error } = await client
      .schema("information_schema")
      .from("tables")
      .select("table_schema,table_name,table_type")
      .eq("table_schema", "public")
      .ilike("table_name", "%sales%")
      .ilike("table_name", "%order%");
    if (error) {
      return { ok: false, tables: [], error: { message: error.message, code: error.code ?? null } };
    }
    const tables = (data ?? [])
      .filter((row) => {
        const tableType = String(row?.table_type || "").toUpperCase();
        return tableType === "BASE TABLE" || tableType === "VIEW";
      })
      .map((row) => String(row?.table_name || ""))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return { ok: true, tables, error: null };
  } catch (error) {
    return {
      ok: false,
      tables: [],
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

async function getSalesOrderLinesFkStatus(client) {
  const result = { known: false, exists: null, constraints: [], error: null };
  try {
    const { data: constraints, error: constraintsError } = await client
      .schema("information_schema")
      .from("table_constraints")
      .select("constraint_name")
      .eq("table_schema", "public")
      .eq("table_name", "sales_order_lines")
      .eq("constraint_type", "FOREIGN KEY");
    if (constraintsError) {
      result.error = {
        message: constraintsError.message,
        code: constraintsError.code ?? null,
      };
      return result;
    }

    const { data: keyColumns, error: keyColumnsError } = await client
      .schema("information_schema")
      .from("key_column_usage")
      .select("constraint_name")
      .eq("table_schema", "public")
      .eq("table_name", "sales_order_lines")
      .eq("column_name", "sales_order_id");
    if (keyColumnsError) {
      result.error = {
        message: keyColumnsError.message,
        code: keyColumnsError.code ?? null,
      };
      return result;
    }

    const fkNames = new Set((constraints ?? []).map((row) => String(row?.constraint_name || "")).filter(Boolean));
    const keyNames = new Set((keyColumns ?? []).map((row) => String(row?.constraint_name || "")).filter(Boolean));
    const overlap = Array.from(fkNames).filter((name) => keyNames.has(name));

    result.known = true;
    result.exists = overlap.length > 0;
    result.constraints = overlap;
    return result;
  } catch (error) {
    result.error = { message: error instanceof Error ? error.message : String(error) };
    return result;
  }
}

async function queryAccountingExports(client, orderId, hasPayloadJson) {
  const exportRows = [];
  const errors = [];

  const { data: bySourceData, error: bySourceError } = await client
    .from("accounting_exports")
    .select("*")
    .eq("source_entity_id", orderId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (bySourceError) {
    errors.push({
      query: "source_entity_id",
      message: bySourceError.message,
      code: bySourceError.code ?? null,
    });
  } else {
    exportRows.push(...(bySourceData ?? []));
  }

  if (hasPayloadJson) {
    const { data: byPayloadData, error: byPayloadError } = await client
      .from("accounting_exports")
      .select("*")
      .filter("payload_json::text", "ilike", `%${orderId}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    if (byPayloadError) {
      errors.push({
        query: "payload_json::text ilike",
        message: byPayloadError.message,
        code: byPayloadError.code ?? null,
      });
    } else {
      exportRows.push(...(byPayloadData ?? []));
    }
  }

  const dedupeMap = new Map();
  for (const row of exportRows) {
    const key = row?.id ? String(row.id) : JSON.stringify(row ?? {});
    if (!dedupeMap.has(key)) dedupeMap.set(key, row);
  }

  const deduped = Array.from(dedupeMap.values())
    .sort((a, b) => toEpochMs(b?.created_at) - toEpochMs(a?.created_at))
    .slice(0, 10);
  return { rows: deduped, errors };
}

async function main() {
  const orderId = String(getArg("--order-id") || "").trim();
  const tenantIdArg = String(getArg("--tenant-id") || "").trim();

  if (!orderId) {
    console.error("Missing required argument: --order-id <uuid>");
    console.error("Usage: node tools/debug/probe-sales-order.mjs --order-id <uuid> [--tenant-id <uuid>]");
    process.exit(1);
  }

  const supabaseUrl = String(optionalEnv("SUPABASE_URL") || optionalEnv("VITE_SUPABASE_URL") || "").trim();
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tenantId = tenantIdArg || optionalEnv("TENANT_ID");

  if (!supabaseUrl) {
    console.error("Missing required env var: SUPABASE_URL (or fallback VITE_SUPABASE_URL)");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const foundIn = [];
  const tenantIdsSeen = [];

  printJson("probe.config", {
    order_id: orderId,
    tenant_id: tenantId || null,
    supabase_url: supabaseUrl,
    using_supabase_url_env: optionalEnv("SUPABASE_URL") ? "SUPABASE_URL" : "VITE_SUPABASE_URL",
  });

  const salesOrdersColumns = await getTableColumns(admin, "public", "sales_orders");
  printJson("public.sales_orders.columns", salesOrdersColumns);

  const { data: salesOrdersRows, error: salesOrdersError } = await admin
    .from("sales_orders")
    .select("*")
    .eq("id", orderId)
    .limit(1);
  const salesOrdersResult = { rows: salesOrdersRows ?? [], error: salesOrdersError ?? null };
  printJson("public.sales_orders", salesOrdersResult);
  if (!salesOrdersError && (salesOrdersRows ?? []).length > 0) {
    foundIn.push("public.sales_orders");
    for (const row of salesOrdersRows ?? []) {
      if (row?.tenant_id) tenantIdsSeen.push(String(row.tenant_id));
    }
  }

  const salesOrderLinesColumns = await getTableColumns(admin, "public", "sales_order_lines");
  printJson("public.sales_order_lines.columns", salesOrderLinesColumns);
  const salesOrderLinesFk = await getSalesOrderLinesFkStatus(admin);
  printJson("public.sales_order_lines.fk", salesOrderLinesFk);

  const hasSalesOrderIdColumn = salesOrderLinesColumns.columns.includes("sales_order_id");
  let salesOrderLinesResult = { skipped: false, reason: null, rows: [], error: null };

  if (salesOrderLinesFk.known && salesOrderLinesFk.exists === false) {
    salesOrderLinesResult = {
      skipped: true,
      reason: "sales_order_lines FK for sales_order_id -> sales_orders.id not found; skipping gracefully",
      rows: [],
      error: null,
    };
  } else if (!hasSalesOrderIdColumn && salesOrderLinesColumns.ok) {
    salesOrderLinesResult = {
      skipped: true,
      reason: "sales_order_lines.sales_order_id column missing; skipping gracefully",
      rows: [],
      error: null,
    };
  } else {
    const { data: linesRows, error: linesError } = await admin
      .from("sales_order_lines")
      .select("*")
      .eq("sales_order_id", orderId);
    salesOrderLinesResult = {
      skipped: false,
      reason: null,
      rows: linesRows ?? [],
      error: linesError ?? null,
    };
    if (!linesError && (linesRows ?? []).length > 0) {
      foundIn.push("public.sales_order_lines");
      for (const row of linesRows ?? []) {
        if (row?.tenant_id) tenantIdsSeen.push(String(row.tenant_id));
      }
    }
    if (linesError && isMissingSalesOrderIdError(linesError)) {
      salesOrderLinesResult.skipped = true;
      salesOrderLinesResult.reason = "sales_order_lines.sales_order_id FK/column unavailable; skipped gracefully";
    }
  }
  printJson("public.sales_order_lines", salesOrderLinesResult);

  const accountingExportsColumns = await getTableColumns(admin, "public", "accounting_exports");
  printJson("public.accounting_exports.columns", accountingExportsColumns);
  const hasPayloadJson = accountingExportsColumns.columns.includes("payload_json");
  const accountingExportsResult = await queryAccountingExports(admin, orderId, hasPayloadJson);
  printJson("public.accounting_exports", {
    rows: accountingExportsResult.rows,
    errors: accountingExportsResult.errors,
    query_mode: hasPayloadJson ? "source_entity_id OR payload_json::text ilike" : "source_entity_id only",
  });
  if (accountingExportsResult.rows.length > 0) {
    foundIn.push("public.accounting_exports");
    for (const row of accountingExportsResult.rows) {
      if (row?.tenant_id) tenantIdsSeen.push(String(row.tenant_id));
    }
  }

  const candidateChecks = [];
  if (!salesOrdersError && (salesOrdersRows ?? []).length === 0) {
    const candidateTablesResult = await getCandidateSalesOrderTables(admin);
    if (!candidateTablesResult.ok) {
      candidateChecks.push({
        table: null,
        row_count: 0,
        rows: [],
        error: candidateTablesResult.error,
      });
    } else {
      for (const tableName of candidateTablesResult.tables) {
        const qualified = `public.${tableName}`;
        if (tableName === "sales_orders") continue;
        try {
          const { data, error } = await admin
            .from(tableName)
            .select("*")
            .eq("id", orderId)
            .limit(1);
          const rows = data ?? [];
          candidateChecks.push({
            table: qualified,
            row_count: rows.length,
            rows,
            error: error ?? null,
          });
          if (!error && rows.length > 0) {
            foundIn.push(qualified);
            for (const row of rows) {
              if (row?.tenant_id) tenantIdsSeen.push(String(row.tenant_id));
            }
          }
        } catch (error) {
          candidateChecks.push({
            table: qualified,
            row_count: 0,
            rows: [],
            error: { message: error instanceof Error ? error.message : String(error) },
          });
        }
      }
    }
    printJson("candidate.sales_order_like_tables", candidateChecks);
  }

  const tenantMatch = normalizeTenantMatch(tenantId, tenantIdsSeen);
  const exportsFound = accountingExportsResult.rows.length;
  const dedupedFoundIn = Array.from(new Set(foundIn));

  let nextAction = "Verify the order ID and target environment, then rerun this probe.";
  if (dedupedFoundIn.includes("public.sales_orders") && exportsFound === 0) {
    nextAction = "Trigger or queue the accounting export for this sales order, then rerun this probe.";
  } else if (dedupedFoundIn.includes("public.sales_orders") && exportsFound > 0) {
    nextAction = "Inspect the newest accounting export status/error fields and retry processing if it is stuck.";
  } else if (dedupedFoundIn.length > 0) {
    nextAction = "Use the candidate table/view hit to trace where this order currently resides and align the lookup path.";
  }

  const verdict = {
    FOUND_IN: dedupedFoundIn,
    TENANT_MATCH: tenantMatch,
    EXPORTS_FOUND: exportsFound,
    NEXT_ACTION: nextAction,
  };

  printJson("verdict", verdict);
}

main().catch((error) => {
  console.error("probe_sales_order_failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

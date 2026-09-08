#!/usr/bin/env node
/**
 * Adapts the community "Lightweight APM for OpenTelemetry" dashboard
 * (Grafana.com ID 22784, revision 7) to this stack.
 *
 *   node scripts/build-apm-dashboard.mjs           # write the dashboard
 *   node scripts/build-apm-dashboard.mjs --check   # fail if it is out of date
 *
 *   infra/observability/upstream/22784_rev7.json      (vendored, never edited)
 *        -> infra/observability/grafana/dashboards/otel-service-apm.json
 *
 * This is a script rather than a hand-edit so the delta from upstream stays
 * reviewable: when a new revision is published, drop it in `upstream/`, adjust
 * the transforms that no longer apply, and re-run. Editing the output by hand
 * is the one thing that breaks that — Grafana's provisioning is set to
 * `allowUiUpdates: true`, so save your UI experiments back into this file.
 *
 * See .specs/features/observability-traces/spec.md for why each change is here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(repoRoot, "infra/observability/upstream/22784_rev7.json");
const TARGET = resolve(
  repoRoot,
  "infra/observability/grafana/dashboards/otel-service-apm.json",
);

/** The label selector every Prometheus panel in this dashboard filters on. */
const SELECTOR =
  'deployment_environment_name=~"$deployment_environment_name", ' +
  'service_namespace=~"$service_namespace", service_name="$service_name"';

const PROM = { type: "prometheus", uid: "${prometheus_datasource}" };

const dash = JSON.parse(readFileSync(SOURCE, "utf8"));

// ---------------------------------------------------------------------------
// 1. Import scaffolding
//
// `__inputs`/`__requires`/`__elements` exist so grafana.com can prompt for
// datasources during a manual import. A provisioned dashboard is never
// imported, and Grafana logs an error when it finds unresolved `${DS_*}`
// placeholders, so all of it goes.
// ---------------------------------------------------------------------------
for (const key of ["__inputs", "__requires", "__elements", "gnetId", "id"]) {
  delete dash[key];
}
dash.id = null;
dash.uid = "otel-service-apm";
dash.tags = ["tatame", "otel"];
dash.refresh = "30s";
dash.description =
  "Lightweight APM for OpenTelemetry (grafana.com ID 22784 rev7), adapted for " +
  "this stack: Node runtime instead of JVM, no gRPC panels, Loki panels parked " +
  "in a collapsed row. Rebuild with `node scripts/build-apm-dashboard.mjs`.";

// ---------------------------------------------------------------------------
// 2. Datasources
//
// Upstream pins some panels to the author's Grafana Cloud datasources
// (`${DS_GRAFANACLOUD-CLECLERC-*}`) and others to the dashboard's own datasource
// variables — the same panel often mixes both. Rewrite every hard-coded uid to
// the matching variable so the whole dashboard follows the pickers at the top.
// ---------------------------------------------------------------------------
const DATASOURCE_REWRITES = {
  "${DS_GRAFANACLOUD-CLECLERC-PROM}": "${prometheus_datasource}",
  "${DS_GRAFANACLOUD-CLECLERC-TRACES}": "${tempo_datasource}",
  "${DS_GRAFANACLOUD-CLECLERC-LOGS}": "${loki_datasource}",
};

function rewriteDatasourceUids(node) {
  if (Array.isArray(node)) return node.forEach(rewriteDatasourceUids);
  if (!node || typeof node !== "object") return;
  if (typeof node.uid === "string" && DATASOURCE_REWRITES[node.uid]) {
    node.uid = DATASOURCE_REWRITES[node.uid];
  }
  Object.values(node).forEach(rewriteDatasourceUids);
}
rewriteDatasourceUids(dash);

// Pin the datasource pickers to our provisioned uids. Without a `current`,
// Grafana picks the first datasource of that type — fine today with one of each,
// but it silently starts guessing the moment a second Prometheus is added.
const PINNED = {
  prometheus_datasource: { text: "Prometheus", value: "prometheus" },
  tempo_datasource: { text: "Tempo", value: "tempo" },
};
for (const variable of dash.templating.list) {
  if (PINNED[variable.name]) variable.current = PINNED[variable.name];
  // Two query variables point at a hard-coded datasource rather than the picker.
  if (variable.type === "query") variable.datasource = { ...PROM };
}

// Upstream ships `service_namespace` and `deployment_environment_name` with
// "All" enabled and no `allValue`, which breaks both signals in different ways:
//
//   * TraceQL compares exactly (`resource.service.namespace="$service_namespace"`),
//     so the interpolated All is not a valid string and Tempo answers 400.
//   * In PromQL an All that resolves before its values have loaded interpolates
//     to nothing, giving `=~""` — which matches only series *missing* the label,
//     so every panel reads "No data".
//
// This dashboard is per-service and per-environment by construction — its header
// panel renders `Service ${service_namespace}/${service_name} (env:
// ${deployment_environment_name})` as prose, where an All value shows up as a
// literal ".*". Drop All from both; each picker then defaults to its first value.
const templating = Object.fromEntries(dash.templating.list.map((v) => [v.name, v]));
templating.service_namespace.includeAll = false;
templating.deployment_environment_name.includeAll = false;

// ---------------------------------------------------------------------------
// 3. Panels
// ---------------------------------------------------------------------------
const byTitle = (title) => (panel) => panel.title === title;
const panels = dash.panels;
const take = (predicate) => {
  const index = panels.findIndex(predicate);
  if (index === -1) throw new Error("panel not found — upstream layout changed");
  return panels.splice(index, 1)[0];
};

// The setup-instructions panel says "delete this panel after setup", and its
// instructions describe ingesting via Prometheus' native OTLP endpoint — which
// is *not* how this stack is wired (see D1 in the spec). Leaving it in would
// document an architecture we deliberately did not adopt.
take((p) => p.type === "text" && /Dashboard setup instructions/.test(p.options?.content ?? ""));

// No gRPC server in this project, and no gRPC clients. These panels can only
// ever render "No data".
take(byTitle("Server RPC RED Metrics"));
take(byTitle("RPC Operations"));
take(byTitle("Outbound RPC Services"));

// Loki is not deployed yet. Park the two log panels inside a collapsed row so
// nothing referencing a missing datasource renders on load; the queries survive
// intact for whenever Loki lands. `Latest logs received` lives in the header
// row upstream, which is exactly where it would error.
const logsPanel = take((p) => p.type === "logs");
const logsStat = take(byTitle("Latest logs received"));
panels.find(byTitle("Logs")).panels = [logsStat, logsPanel];

// The Runtime row is JVM-only. Rebuild it against the Node runtime metrics the
// SDK already emits — the same three views as `tatame-api-overview`, re-scoped
// to this dashboard's namespace/service variables.
take(byTitle("JVM"));

const timeseries = (id, title, description, unit, targets, extra = {}) => ({
  id,
  type: "timeseries",
  title,
  description,
  datasource: { ...PROM },
  fieldConfig: {
    defaults: {
      unit,
      color: { mode: "palette-classic" },
      custom: {
        drawStyle: "line",
        lineInterpolation: "smooth",
        lineWidth: 2,
        fillOpacity: 10,
        gradientMode: "opacity",
        showPoints: "never",
        spanNulls: true,
        axisPlacement: "auto",
        axisSoftMin: 0,
        stacking: { mode: "none", group: "A" },
        ...extra,
      },
      thresholds: { mode: "absolute", steps: [{ color: "green", value: null }] },
      mappings: [],
    },
    overrides: [],
  },
  options: {
    legend: { displayMode: "list", placement: "bottom", showLegend: true, calcs: [] },
    tooltip: { mode: "multi", sort: "desc" },
  },
  targets: targets.map(([refId, expr, legendFormat]) => ({
    refId,
    datasource: { ...PROM },
    editorMode: "code",
    expr,
    legendFormat,
    range: true,
    instant: false,
  })),
});

const runtimePanels = [
  timeseries(
    101,
    "Event loop delay",
    "How long a callback waits before Node runs it. Rising p99 means the loop is blocked.",
    "s",
    [
      ["A", `max by (service_instance_id) (nodejs_eventloop_delay_p50_seconds{${SELECTOR}})`, "p50 {{service_instance_id}}"],
      ["B", `max by (service_instance_id) (nodejs_eventloop_delay_p99_seconds{${SELECTOR}})`, "p99 {{service_instance_id}}"],
    ],
  ),
  timeseries(
    102,
    "V8 heap used by space",
    "Stacked so the total is the process heap; a space that only grows is the shape of a leak.",
    "bytes",
    [["A", `sum by (v8js_heap_space_name) (v8js_memory_heap_used_bytes{${SELECTOR}})`, "{{v8js_heap_space_name}}"]],
    { fillOpacity: 40, stacking: { mode: "normal", group: "A" } },
  ),
  timeseries(
    103,
    "Garbage collection time / s",
    "Seconds spent in GC per second of wall clock.",
    "s",
    [["A", `sum by (v8js_gc_type) (rate(v8js_gc_duration_seconds_sum{${SELECTOR}}[$__rate_interval]))`, "{{v8js_gc_type}}"]],
  ),
];

// Upstream copy-pastes the HTTP error selector onto the database table, so its
// error column filters `db_client_operation_duration_seconds_count` by
// `http_response_status_code` — a label that metric never carries, making the
// column a constant zero. The database convention marks failures with
// `error_type`, so use that.
const outboundDatabases = panels.find(byTitle("Outbound Databases"));
for (const target of outboundDatabases.targets) {
  target.expr = target.expr.replace(/http_response_status_code=~"5\.\."/g, 'error_type!=""');
}

// With `RPC Operations` gone, the inbound HTTP table has the row to itself.
panels.find(byTitle("HTTP Operations")).gridPos.w = 24;
// Same for the traces table, which upstream leaves at w15.
panels.find((p) => p.type === "table" && p.datasource?.uid === "${tempo_datasource}").gridPos.w = 24;
// The header stats close the gap left by `Latest logs received`.
panels.find(byTitle("Latest traces received")).gridPos.x = 13;

// ---------------------------------------------------------------------------
// 4. Layout
//
// Deleting panels leaves holes, and Grafana packs panels upward on load — but
// only within a row, so stale `y` values shuffle rows into the wrong order.
// Re-flow every row block from scratch instead.
// ---------------------------------------------------------------------------
const ordered = [];
let y = 0;

const place = (panel, x, w, h) => {
  panel.gridPos = { h, w, x, y };
  ordered.push(panel);
};

// Header band: title text + the two "latest received" stats, side by side.
place(panels.find((p) => p.type === "text"), 0, 10, 2);
place(panels.find(byTitle("Latest metrics received")), 10, 3, 2);
place(panels.find(byTitle("Latest traces received")), 13, 4, 2);
y += 2;

/** Lays out one row plus the panels that belong to it. */
const section = (rowTitle, children, { collapsed = false } = {}) => {
  const row = panels.find(byTitle(rowTitle));
  row.gridPos = { h: 1, w: 24, x: 0, y };
  row.collapsed = collapsed;
  ordered.push(row);
  y += 1;
  if (collapsed) {
    // A collapsed row carries its panels inline; they must not also appear at
    // the top level or Grafana renders each one twice.
    return;
  }
  row.panels = [];
  let x = 0;
  for (const { panel, w, h } of children) {
    if (x + w > 24) {
      x = 0;
      y += h;
    }
    place(panel, x, w, h);
    x += w;
  }
  y += Math.max(...children.map((c) => c.h));
};

const at = (title, w, h) => ({ panel: panels.find(byTitle(title)), w, h });

section("Server HTTP RED Metrics", [
  at("Duration", 8, 7),
  at("Error", 8, 7),
  at("Request Rate", 8, 7),
]);
section("Inbound Operations", [at("HTTP Operations", 24, 7)]);
section("Outbound Services and Databases", [
  at("Outbound HTTP Services", 12, 6),
  at("Outbound Databases", 12, 6),
]);
section("Traces", [
  {
    panel: panels.find((p) => p.type === "table" && p.datasource?.uid === "${tempo_datasource}"),
    w: 24,
    h: 9,
  },
]);
section("Runtime", runtimePanels.map((panel) => ({ panel, w: 8, h: 7 })));
section("Logs", [], { collapsed: true });

// The collapsed Logs row keeps its own grid; give its children sane positions.
logsStat.gridPos = { h: 2, w: 3, x: 0, y: y + 1 };
logsPanel.gridPos = { h: 15, w: 24, x: 0, y: y + 3 };

dash.panels = ordered;

// ---------------------------------------------------------------------------
// 5. Guardrails
// ---------------------------------------------------------------------------
const serialized = `${JSON.stringify(dash, null, 2)}\n`;

if (serialized.includes("DS_GRAFANACLOUD")) {
  throw new Error("an unresolved import placeholder survived the rewrite");
}
const visibleLoki = ordered.some(
  (p) => p.type !== "row" && JSON.stringify(p).includes("loki_datasource"),
);
if (visibleLoki) {
  throw new Error("a Loki panel is outside the collapsed Logs row");
}
if (/jvm_|rpc_server_|rpc_client_/.test(serialized)) {
  throw new Error("a JVM or RPC query survived the rewrite");
}

if (process.argv.includes("--check")) {
  const current = readFileSync(TARGET, "utf8");
  if (current !== serialized) {
    console.error(
      `${TARGET} is out of date — run \`node scripts/build-apm-dashboard.mjs\``,
    );
    process.exit(1);
  }
  console.log("otel-service-apm.json is up to date");
} else {
  writeFileSync(TARGET, serialized);
  console.log(`wrote ${TARGET} (${ordered.length} panels)`);
}

#!/usr/bin/env node
/**
 * Traffic generator for the observability stack — see docs/observability.md.
 *
 *   node scripts/load-test.mjs                        # 20 rps for 60s
 *   node scripts/load-test.mjs --rps 50 --duration 120
 *   node scripts/load-test.mjs --clients 1            # watch the rate limiter trip
 *
 * Hits a weighted mix of public endpoints so the dashboard shows several routes
 * and status codes at once, not one flat line.
 *
 * Each virtual client sends its own `X-Forwarded-For`. The API runs with
 * `trust proxy = 1`, so express-rate-limit buckets per forwarded IP — without
 * this every request would share one bucket and the run would be 429s after the
 * first 100 requests. That is also why `--clients 1` is the way to see the rate
 * limiter working on purpose.
 */

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const url = flag("url", "http://localhost:3001").replace(/\/$/, "");
const rps = Number(flag("rps", 20));
const duration = Number(flag("duration", 60));
const clients = Number(flag("clients", 40));

if (!Number.isFinite(rps) || rps <= 0) throw new Error("--rps must be a positive number");
if (!Number.isFinite(duration) || duration <= 0) throw new Error("--duration must be a positive number");
if (!Number.isFinite(clients) || clients <= 0) throw new Error("--clients must be a positive number");

/**
 * `weight` is relative, not a percentage. `/v1/ready` is deliberately rare: it
 * runs `select 1` against Postgres and pings Redis, so it is the one route here
 * that shows real dependency latency — and the one you do not want to hammer if
 * DATABASE_URL points at a shared server.
 */
const routes = [
  { method: "GET", path: "/v1/health", weight: 45, expect: 200 },
  { method: "GET", path: "/v1/version", weight: 20, expect: 200 },
  { method: "GET", path: "/v1/users/me", weight: 15, expect: 401 },
  { method: "GET", path: "/v1/does-not-exist", weight: 12, expect: 404 },
  { method: "GET", path: "/v1/ready", weight: 8, expect: 200 },
];

const totalWeight = routes.reduce((sum, r) => sum + r.weight, 0);
function pickRoute() {
  let n = Math.random() * totalWeight;
  for (const route of routes) {
    n -= route.weight;
    if (n <= 0) return route;
  }
  return routes[0];
}

const stats = { sent: 0, done: 0, failed: 0, byStatus: new Map(), latencies: [] };

async function fire() {
  const route = pickRoute();
  const n = Math.floor(Math.random() * clients);
  const client = `10.0.${Math.floor(n / 256)}.${n % 256}`;
  const started = performance.now();
  stats.sent += 1;
  try {
    const res = await fetch(`${url}${route.path}`, {
      method: route.method,
      headers: { "X-Forwarded-For": client, "User-Agent": "tatame-load-test" },
      signal: AbortSignal.timeout(10_000),
    });
    await res.arrayBuffer();
    const key = `${res.status} ${route.method} ${route.path}`;
    stats.byStatus.set(key, (stats.byStatus.get(key) ?? 0) + 1);
    stats.latencies.push(performance.now() - started);
  } catch (error) {
    stats.failed += 1;
    const key = `ERR ${route.method} ${route.path} (${error.name})`;
    stats.byStatus.set(key, (stats.byStatus.get(key) ?? 0) + 1);
  } finally {
    stats.done += 1;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

console.log(
  `→ ${url} — ${rps} req/s for ${duration}s across ${clients} simulated clients (${rps * duration} requests)\n`,
);

const intervalMs = 1000 / rps;
const startedAt = Date.now();
let lastReport = 0;

const ticker = setInterval(() => {
  void fire();

  const elapsed = (Date.now() - startedAt) / 1000;
  if (elapsed - lastReport >= 5) {
    lastReport = elapsed;
    console.log(
      `  ${elapsed.toFixed(0).padStart(3)}s  sent ${String(stats.sent).padStart(6)}  ` +
        `done ${String(stats.done).padStart(6)}  failed ${stats.failed}`,
    );
  }

  if (elapsed >= duration) {
    clearInterval(ticker);
    void finish();
  }
}, intervalMs);

async function finish() {
  // Let the last in-flight requests land before summarising.
  while (stats.done < stats.sent) await new Promise((r) => setTimeout(r, 100));

  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const elapsed = (Date.now() - startedAt) / 1000;

  console.log(`\n${stats.done} requests in ${elapsed.toFixed(1)}s (${(stats.done / elapsed).toFixed(1)} req/s)\n`);
  for (const [key, count] of [...stats.byStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(6)}  ${key}`);
  }
  console.log(
    `\n  latency  p50 ${percentile(sorted, 50).toFixed(1)}ms` +
      `  p95 ${percentile(sorted, 95).toFixed(1)}ms` +
      `  p99 ${percentile(sorted, 99).toFixed(1)}ms`,
  );
  console.log("\nGrafana → http://localhost:3300/d/tatame-api-overview");
}

process.on("SIGINT", () => {
  clearInterval(ticker);
  void finish().then(() => process.exit(0));
});

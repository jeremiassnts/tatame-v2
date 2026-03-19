/**
 * CI / local smoke tests do not start Postgres; routes under test must not execute DB queries.
 * `DATABASE_URL` is only read when modules call `getDb()` — connection is lazy until first query.
 */
process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "postgres://127.0.0.1:5432/tatame_test_placeholder";
delete process.env.CLERK_SECRET_KEY;
delete process.env.REDIS_URL;

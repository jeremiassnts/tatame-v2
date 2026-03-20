import { PostgreSqlContainer } from "@testcontainers/postgresql";

export default async function globalSetup() {
  const container = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.TEST_DATABASE_URL = container.getConnectionUri();

  return async () => {
    await container.stop();
  };
}

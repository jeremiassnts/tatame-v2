import "./env-bootstrap.js";
import { loadEnv } from "@tatame/config";
import { createApp } from "./app.js";

const env = loadEnv();
const app = createApp();

app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}/v1`);
});

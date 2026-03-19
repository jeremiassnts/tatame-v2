import cors from "cors";
import express from "express";
import { loadEnv } from "@tatame/config";
import { apiRouter } from "./router.js";
import { errorHandler } from "./middleware/error-handler.js";

const env = loadEnv();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/v1", apiRouter);
app.use(errorHandler);

app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}/v1`);
});

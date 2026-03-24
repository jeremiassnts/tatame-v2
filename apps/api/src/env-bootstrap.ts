import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const rootEnvPath = path.resolve(currentDir, "../../../.env");

loadDotenv({ path: rootEnvPath });

import path from "node:path";
import { asUser, closeMongo, collections, getMeta, getMongo, mongoConfigured, mongoUri, setMeta, type UserRow } from "./mongo";

export const DATA_DIR = path.join(process.cwd(), ".cache");
export const DB_PATH = path.join(DATA_DIR, "fly-mcns-v1.db");

export { asUser, closeMongo, collections, getMeta, getMongo, mongoConfigured, mongoUri, setMeta, type UserRow };

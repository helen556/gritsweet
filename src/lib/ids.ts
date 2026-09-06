import { randomBytes } from "node:crypto";
export const newId = () => randomBytes(12).toString("base64url");

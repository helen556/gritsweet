import { randomBytes, createHash } from "node:crypto";

export const newId = (prefix: string) => `${prefix}_${randomBytes(10).toString("base64url")}`;
export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

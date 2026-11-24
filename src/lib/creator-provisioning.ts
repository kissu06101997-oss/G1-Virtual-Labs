import { blobMediaEnabled } from "./blob-media";
import { localMediaEnabled } from "./local-media";
import type { AuthContext } from "./types";

export function creatorProvisioningMode(auth: AuthContext): "synthetic" | "operator" | null {
  if (auth.role === "state_admin" && (localMediaEnabled() ||
    (process.env.VERCEL_ENV === "preview" && auth.isSynthetic && blobMediaEnabled()))) {
    return "synthetic";
  }
  return auth.role === "operator" && !auth.isSynthetic && blobMediaEnabled() ? "operator" : null;
}

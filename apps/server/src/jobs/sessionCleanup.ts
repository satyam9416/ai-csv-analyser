import { promises as fs } from "fs";
import { SessionStore } from "../store/sessionStore";

export function startSessionCleanup(store: SessionStore): void {
  setInterval(async () => {
    const snapshot = store.getSessionsSnapshot();

    store.cleanupExpired();

    for (const { session } of snapshot) {
      for (const file of session.uploadedFiles) {
        try {
          await fs.unlink(file.path);
        } catch {
          // ignore missing files
        }
      }
    }
  }, 60 * 60 * 1000);
}

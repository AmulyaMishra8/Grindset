import { prisma } from "../db/prisma";
import { logger } from "../lib/logger";
import { sweepExpiredRefreshTokens } from "./refreshTokenStore";

// Background housekeeping. Verification/reset tokens are single-use and
// short-lived, and refresh tokens carry an expiry; once rows are expired or
// consumed we don't need them, so we sweep them periodically to keep the
// tables small.
export function startMaintenanceJobs() {
  const ONE_HOUR = 60 * 60 * 1000;

  const sweep = async () => {
    try {
      const { count } = await prisma.verificationToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }] },
      });
      if (count > 0) logger.debug(`Maintenance: removed ${count} stale verification tokens`);

      const refreshRemoved = await sweepExpiredRefreshTokens();
      if (refreshRemoved > 0) logger.debug(`Maintenance: removed ${refreshRemoved} expired refresh tokens`);
    } catch (err) {
      logger.warn({ err }, "Maintenance sweep failed");
    }
  };

  sweep(); // run once at startup
  setInterval(sweep, ONE_HOUR).unref();
}

// ============================================================
// VERIDION AI — Risk Engine Cron Scheduler
// ============================================================
// Runs every hour, computes risk metrics for all users with
// holdings, and persists the results.
// ============================================================

import cron from 'node-cron';
import { prisma } from '../../infrastructure/prisma/client';
import { logger } from '../../infrastructure/logger/logger';
import { computeRiskForUser } from './risk.engine';

/**
 * Start the hourly risk computation scheduler.
 * Schedule: every hour at minute 0  →  "0 * * * *"
 */
export function startRiskScheduler(): void {
    // Run once immediately on startup
    runRiskJobForAllUsers().catch((err) =>
        logger.error({ err }, '[RiskScheduler] Initial run failed'),
    );

    cron.schedule('0 * * * *', async () => {
        logger.info('[RiskScheduler] Hourly risk computation starting');
        await runRiskJobForAllUsers();
    });

    logger.info('[RiskScheduler] Started — runs every hour');
}

/**
 * Compute risk metrics for every user that has at least one holding.
 */
async function runRiskJobForAllUsers(): Promise<void> {
    try {
        // Get distinct user IDs that have holdings
        const userIds = await prisma.holding
            .findMany({
                select: { userId: true },
                distinct: ['userId'],
            })
            .then((rows) => rows.map((r) => r.userId));

        logger.info({ userCount: userIds.length }, '[RiskScheduler] Processing users');

        for (const userId of userIds) {
            try {
                await computeRiskForUser(userId);
                logger.info({ userId }, '[RiskScheduler] ✓ Completed');
            } catch (err) {
                logger.error({ userId, err }, '[RiskScheduler] ✗ Failed for user');
            }
        }

        logger.info('[RiskScheduler] Hourly run complete');
    } catch (err) {
        logger.error({ err }, '[RiskScheduler] Job failed at top level');
    }
}

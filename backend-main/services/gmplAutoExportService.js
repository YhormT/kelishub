const prisma = require('../config/db');
const orderBatchService = require('./orderBatchService');
const gmplService = require('./gmplService');
const {
  buildSupplierExcelBuffer,
  submitRowsToGmpl,
} = require('../utils/gmplOrderExport');
const { GMPL_NETWORK, isGmplNetwork } = require('../utils/gmplNetwork');
const { emitPendingQueueChanged } = require('../utils/orderEvents');

const GMPL_AUTO_NETWORKS = [GMPL_NETWORK];

let cycleRunning = false;

const getConfig = () => ({
  enabled: process.env.GMPL_AUTO_EXPORT === 'true',
  intervalMs: Math.max(
    60_000,
    parseInt(process.env.GMPL_AUTO_INTERVAL_MS || '300000', 10)
  ),
  minPending: Math.max(
    1,
    parseInt(process.env.GMPL_MIN_PENDING_COUNT || '1', 10)
  ),
  retryFailed: process.env.GMPL_AUTO_RETRY_FAILED !== 'false',
  maxRetries: Math.max(
    1,
    parseInt(process.env.GMPL_AUTO_MAX_RETRIES || '3', 10)
  ),
  /** Max purchaser orders per auto-export cycle (FIFO). 0 = no cap (export all pending). */
  maxOrdersPerCycle: Math.max(
    0,
    parseInt(process.env.GMPL_MAX_ORDERS_PER_CYCLE || '3', 10)
  ),
});

const extractGmplResponseId = (gmplResult) => {
  if (!gmplResult || typeof gmplResult !== 'object') return null;
  const id =
    gmplResult.id ??
    gmplResult.referenceCode ??
    gmplResult.batchId ??
    gmplResult.orderId;
  return id != null ? String(id) : null;
};

const recordGmplSubmission = async (
  batchId,
  { status, error = null, responseId = null, incrementRetry = false, autoExport = false }
) => {
  const data = {
    gmplStatus: status,
    gmplError: error,
    gmplResponseId: responseId,
  };

  if (status === 'submitted') {
    data.gmplSubmittedAt = new Date();
    data.gmplError = null;
  }

  if (status === 'completed') {
    data.gmplError = null;
  }

  if (autoExport) {
    data.gmplAutoExport = true;
  }

  if (incrementRetry) {
    return prisma.orderBatch.update({
      where: { id: batchId },
      data: { ...data, gmplRetryCount: { increment: 1 } },
    });
  }

  return prisma.orderBatch.update({
    where: { id: batchId },
    data,
  });
};

const getSystemAdminUserId = async () => {
  if (process.env.GMPL_AUTO_EXPORT_ADMIN_USER_ID) {
    return parseInt(process.env.GMPL_AUTO_EXPORT_ADMIN_USER_ID, 10);
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  if (!admin) {
    throw new Error('No ADMIN user found for GMPL auto-export.');
  }

  return admin.id;
};

const submitExistingBatchToGmpl = async (batchId, { incrementRetry = false } = {}) => {
  const existing = await prisma.orderBatch.findUnique({
    where: { id: parseInt(batchId, 10) },
    select: {
      id: true,
      network: true,
      gmplStatus: true,
      status: true,
      items: { select: { status: true } },
    },
  });

  if (!existing) {
    throw new Error('Order batch not found');
  }

  const allItemsCompleted =
    existing.items.length > 0 &&
    existing.items.every((i) => i.status === 'Completed');

  if (existing.status === 'Completed' || allItemsCompleted || existing.gmplStatus === 'completed') {
    await orderBatchService.markGmplCompletedIfFulfilled(existing.id);
    return {
      success: true,
      message: `Batch #${existing.id} already fulfilled — GMPL closed.`,
      batchId: existing.id,
      gmplStatus: 'completed',
      alreadyFulfilled: true,
    };
  }

  if (existing.gmplStatus === 'submitted') {
    throw new Error('Batch already submitted to GMPL.');
  }

  if (!existing.network) {
    throw new Error('Batch has no network label; cannot submit to GMPL.');
  }

  if (!isGmplNetwork(existing.network)) {
    throw new Error('GMPL submission is only supported for MTN batches.');
  }

  if (!process.env.GMPL_API_KEY) {
    throw new Error('GMPL API is not configured. Set GMPL_API_KEY on the server.');
  }

  const { batch, rows } = await orderBatchService.getBatchForDownload(batchId);
  const shouldIncrementRetry =
    incrementRetry && existing.gmplStatus === 'failed';

  try {
    const gmplResult = await submitRowsToGmpl(rows, batch.network, {
      idempotencyKey: `kellishub-batch-${batch.id}`,
      batchId: batch.id,
    });
    const responseId = extractGmplResponseId(gmplResult);
    await recordGmplSubmission(batch.id, {
      status: 'submitted',
      responseId,
      incrementRetry: shouldIncrementRetry,
    });

    return {
      success: true,
      message: `Batch #${batch.id} submitted to GMPL (${batch.network}).`,
      batchId: batch.id,
      gmplStatus: 'submitted',
      gmpl: gmplResult,
    };
  } catch (err) {
    await recordGmplSubmission(batch.id, {
      status: 'failed',
      error: err.message || 'GMPL submit failed',
      incrementRetry: shouldIncrementRetry,
    });
    throw err;
  }
};

const exportPendingWithGmpl = async (
  adminUserId,
  network,
  { submitToGmpl = true, autoExport = false, maxOrders } = {}
) => {
  const exportResult = await orderBatchService.exportPendingByNetwork(
    adminUserId,
    network,
    { maxOrders }
  );
  const {
    batches: orderBatches,
    rows,
    orderCount,
    remainingPendingOrders,
    pendingOrderCount,
  } = exportResult;

  const buffer = buildSupplierExcelBuffer(rows);
  const shouldSubmit =
    submitToGmpl && isGmplNetwork(network) && Boolean(process.env.GMPL_API_KEY);

  const batchResults = [];

  for (const { batch, rows: batchRows } of orderBatches) {
    emitPendingQueueChanged({
      type: 'exported',
      batchId: batch.id,
      network,
      itemCount: batch.totalItems,
      orderId: batchRows[0]?.orderId,
    });

    if (autoExport) {
      await prisma.orderBatch.update({
        where: { id: batch.id },
        data: { gmplAutoExport: true },
      });
    }

    let gmplStatus = 'skipped';
    let gmplError = null;
    let gmplResult = null;
    let gmplResponseId = null;

    if (!isGmplNetwork(network)) {
      await recordGmplSubmission(batch.id, {
        status: 'skipped',
        error: 'GMPL is MTN-only; batch exported without supplier submit',
      });
      gmplError = 'Non-MTN network — GMPL not used';
    } else if (!process.env.GMPL_API_KEY) {
      await recordGmplSubmission(batch.id, {
        status: 'skipped',
        error: 'GMPL_API_KEY not configured',
      });
      gmplError = 'GMPL_API_KEY not configured';
    } else if (!shouldSubmit) {
      await recordGmplSubmission(batch.id, { status: 'skipped' });
    } else {
      try {
        gmplResult = await submitRowsToGmpl(batchRows, batch.network, {
          idempotencyKey: `kellishub-batch-${batch.id}`,
          batchId: batch.id,
        });
        gmplResponseId = extractGmplResponseId(gmplResult);
        await recordGmplSubmission(batch.id, {
          status: 'submitted',
          responseId: gmplResponseId,
          autoExport,
        });
        gmplStatus = 'submitted';
      } catch (err) {
        gmplError = err.message || 'GMPL submit failed';
        await recordGmplSubmission(batch.id, {
          status: 'failed',
          error: gmplError,
          autoExport,
        });
        gmplStatus = 'failed';
      }
    }

    batchResults.push({
      batch,
      gmplStatus,
      gmplError,
      gmplResult,
      gmplResponseId,
    });
  }

  const submittedCount = batchResults.filter((b) => b.gmplStatus === 'submitted').length;
  const failedCount = batchResults.filter((b) => b.gmplStatus === 'failed').length;
  let overallGmplStatus = 'skipped';
  if (submittedCount === batchResults.length && submittedCount > 0) overallGmplStatus = 'submitted';
  else if (failedCount > 0 && submittedCount > 0) overallGmplStatus = 'partial';
  else if (failedCount > 0) overallGmplStatus = 'failed';

  const first = batchResults[0];

  return {
    batch: first?.batch,
    batches: batchResults,
    batchCount: orderCount || batchResults.length,
    remainingPendingOrders,
    pendingOrderCount,
    buffer,
    gmplStatus: overallGmplStatus,
    gmplError: failedCount > 0 ? batchResults.find((b) => b.gmplError)?.gmplError : null,
    gmplResult: first?.gmplResult,
    gmplResponseId: first?.gmplResponseId,
    submittedCount,
    failedCount,
  };
};

const reconcileFulfilledFailedBatches = async () => {
  const stuck = await prisma.orderBatch.findMany({
    where: {
      gmplStatus: 'failed',
      network: GMPL_NETWORK,
    },
    select: { id: true },
    take: 50,
  });

  let resolved = 0;
  for (const batch of stuck) {
    const closed = await orderBatchService.markGmplCompletedIfFulfilled(batch.id);
    if (closed) {
      resolved++;
      console.log(`[GMPL Auto] Batch #${batch.id} fulfilled — GMPL marked completed`);
    }
  }

  return resolved;
};

const retryFailedBatches = async () => {
  const { retryFailed, maxRetries } = getConfig();
  if (!retryFailed || !process.env.GMPL_API_KEY) return [];

  await reconcileFulfilledFailedBatches();

  const failedBatches = await prisma.orderBatch.findMany({
    where: {
      gmplStatus: 'failed',
      gmplRetryCount: { lt: maxRetries },
      network: GMPL_NETWORK,
      status: { not: 'Completed' },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: { id: true, network: true },
  });

  const results = [];

  for (const batch of failedBatches) {
    try {
      const result = await submitExistingBatchToGmpl(batch.id, { incrementRetry: true });
      results.push({ batchId: batch.id, success: true, ...result });
      console.log(`[GMPL Auto] Retry succeeded for batch #${batch.id}`);
    } catch (err) {
      results.push({
        batchId: batch.id,
        success: false,
        error: err.message,
      });
      console.error(`[GMPL Auto] Retry failed for batch #${batch.id}:`, err.message);
    }
  }

  return results;
};

const autoExportPendingNetworks = async (adminUserId) => {
  const { minPending, maxOrdersPerCycle } = getConfig();
  const orderCounts = await orderBatchService.getPendingOrderCountsByNetwork();
  const results = [];

  for (const network of GMPL_AUTO_NETWORKS) {
    const pendingOrders = orderCounts[network]?.count || 0;
    if (pendingOrders < minPending) continue;

    const maxOrders =
      maxOrdersPerCycle > 0
        ? Math.min(maxOrdersPerCycle, pendingOrders)
        : pendingOrders;

    try {
      const result = await exportPendingWithGmpl(adminUserId, network, {
        submitToGmpl: true,
        autoExport: true,
        maxOrders,
      });

      results.push({
        network,
        batchId: result.batch?.id,
        batchCount: result.batchCount,
        remainingPendingOrders: result.remainingPendingOrders,
        itemCount: result.batch?.totalItems,
        gmplStatus: result.gmplStatus,
        gmplError: result.gmplError || null,
      });

      console.log(
        `[GMPL Auto] Exported ${result.batchCount} order batch(es) for ${network}` +
          (result.remainingPendingOrders
            ? ` (${result.remainingPendingOrders} pending order(s) left for next cycle)`
            : '') +
          ` — GMPL: ${result.gmplStatus}`
      );
    } catch (err) {
      if (err.message?.includes('No pending orders')) continue;

      results.push({ network, success: false, error: err.message });
      console.error(`[GMPL Auto] Export failed for ${network}:`, err.message);
    }
  }

  return results;
};

const runAutoGmplCycle = async () => {
  const config = getConfig();
  if (!config.enabled) return { skipped: true, reason: 'disabled' };
  if (!process.env.GMPL_API_KEY) return { skipped: true, reason: 'no_api_key' };
  if (cycleRunning) return { skipped: true, reason: 'already_running' };

  cycleRunning = true;

  try {
    const adminUserId = await getSystemAdminUserId();
    const retries = await retryFailedBatches();
    const exports = await autoExportPendingNetworks(adminUserId);

    return { retries, exports };
  } catch (err) {
    console.error('[GMPL Auto] Cycle error:', err.message);
    return { error: err.message };
  } finally {
    cycleRunning = false;
  }
};

const startAutoGmplScheduler = () => {
  const config = getConfig();

  if (!config.enabled) {
    console.log('[GMPL Auto] Disabled (set GMPL_AUTO_EXPORT=true to enable)');
    return;
  }

  if (!process.env.GMPL_API_KEY) {
    console.log('[GMPL Auto] Enabled but GMPL_API_KEY is not set — scheduler idle');
    return;
  }

  console.log(
    `[GMPL Auto] Scheduler started (every ${config.intervalMs / 1000}s, min pending: ${config.minPending}` +
      (config.maxOrdersPerCycle > 0
        ? `, max ${config.maxOrdersPerCycle} order(s)/cycle (no wait for GMPL completion)`
        : ', unlimited orders/cycle') +
      ')'
  );

  setInterval(() => {
    runAutoGmplCycle().catch((err) => {
      console.error('[GMPL Auto] Unhandled cycle error:', err.message);
    });
  }, config.intervalMs);

  setTimeout(() => {
    runAutoGmplCycle().catch((err) => {
      console.error('[GMPL Auto] Initial cycle error:', err.message);
    });
  }, 45_000);
};

/**
 * Export pending MTN orders on the scheduler (up to maxOrdersPerCycle per run).
 * Immediate per-order export is disabled so orders are sent in groups of 3.
 */
const tryImmediateAutoExport = async () => {
  return { skipped: true, reason: 'batched_scheduler_only' };
};

const scheduleImmediateAutoExport = () => {
  // No-op: wait for scheduler to export up to GMPL_MAX_ORDERS_PER_CYCLE (default 3).
};

const getAutoExportStatus = () => {
  const config = getConfig();
  return {
    enabled: config.enabled,
    configured: Boolean(process.env.GMPL_API_KEY),
    network: GMPL_NETWORK,
    intervalMs: config.intervalMs,
    minPendingCount: config.minPending,
    minPendingOrders: config.minPending,
    maxOrdersPerCycle: config.maxOrdersPerCycle,
    retryFailed: config.retryFailed,
    maxRetries: config.maxRetries,
    apiUrl: process.env.GMPL_API_URL || gmplService.DEFAULT_GMPL_API_URL,
    statusSyncEnabled: process.env.GMPL_STATUS_SYNC !== 'false',
  };
};

module.exports = {
  getConfig,
  getAutoExportStatus,
  recordGmplSubmission,
  submitExistingBatchToGmpl,
  exportPendingWithGmpl,
  runAutoGmplCycle,
  startAutoGmplScheduler,
  tryImmediateAutoExport,
  scheduleImmediateAutoExport,
};

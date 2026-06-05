const prisma = require('../config/db');
const orderBatchService = require('./orderBatchService');
const {
  computeOverallBatchStatus,
  batchHasActiveItems,
  backfillStaleGmplStatuses,
} = orderBatchService;
const {
  buildSupplierExcelBuffer,
  submitRowsToGmpl,
} = require('../utils/gmplOrderExport');

const NETWORKS = ['MTN', 'TELECEL', 'AIRTEL TIGO'];

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
});

const extractGmplResponseId = (gmplResult) => {
  if (!gmplResult || typeof gmplResult !== 'object') return null;
  const id = gmplResult.id ?? gmplResult.orderId ?? gmplResult.batchId;
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
      totalItems: true,
      items: { select: { status: true } },
    },
  });

  if (!existing) {
    throw new Error('Order batch not found');
  }

  if (existing.gmplStatus === 'submitted') {
    throw new Error('Batch already submitted to GMPL.');
  }

  const { overallStatus } = computeOverallBatchStatus(existing, existing.items);
  if (overallStatus === 'Completed' || overallStatus === 'Cancelled') {
    throw new Error('Batch is already completed or cancelled — GMPL submit not applicable.');
  }

  if (!batchHasActiveItems(existing.items)) {
    throw new Error('Batch has no pending or processing orders to send to GMPL.');
  }

  if (!existing.network) {
    throw new Error('Batch has no network label; cannot submit to GMPL.');
  }

  if (!process.env.GMPL_API_KEY) {
    throw new Error('GMPL API is not configured. Set GMPL_API_KEY on the server.');
  }

  const { batch, rows } = await orderBatchService.getBatchForDownload(batchId);
  const shouldIncrementRetry =
    incrementRetry && existing.gmplStatus === 'failed';

  try {
    const gmplResult = await submitRowsToGmpl(rows, batch.network);
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

const exportPendingWithGmpl = async (adminUserId, network, { submitToGmpl = true, autoExport = false } = {}) => {
  const { batch, rows } = await orderBatchService.exportPendingByNetwork(
    adminUserId,
    network
  );

  const buffer = buildSupplierExcelBuffer(rows);
  const shouldSubmit = submitToGmpl && Boolean(process.env.GMPL_API_KEY);

  if (autoExport) {
    await prisma.orderBatch.update({
      where: { id: batch.id },
      data: { gmplAutoExport: true },
    });
  }

  if (!process.env.GMPL_API_KEY) {
    await recordGmplSubmission(batch.id, {
      status: 'skipped',
      error: 'GMPL_API_KEY not configured',
    });

    return {
      batch,
      buffer,
      gmplStatus: 'skipped',
      gmplError: 'GMPL_API_KEY not configured',
    };
  }

  if (!shouldSubmit) {
    await recordGmplSubmission(batch.id, { status: 'skipped' });
    return { batch, buffer, gmplStatus: 'skipped' };
  }

  try {
    const gmplResult = await submitRowsToGmpl(rows, network);
    const responseId = extractGmplResponseId(gmplResult);
    await recordGmplSubmission(batch.id, {
      status: 'submitted',
      responseId,
      autoExport,
    });

    return {
      batch,
      buffer,
      gmplStatus: 'submitted',
      gmplResult,
      gmplResponseId: responseId,
    };
  } catch (err) {
    await recordGmplSubmission(batch.id, {
      status: 'failed',
      error: err.message || 'GMPL submit failed',
      autoExport,
    });

    return {
      batch,
      buffer,
      gmplStatus: 'failed',
      gmplError: err.message || 'GMPL submit failed',
    };
  }
};

const retryFailedBatches = async () => {
  const { retryFailed, maxRetries } = getConfig();
  if (!retryFailed || !process.env.GMPL_API_KEY) return [];

  const failedBatches = await prisma.orderBatch.findMany({
    where: {
      gmplStatus: 'failed',
      gmplRetryCount: { lt: maxRetries },
      items: {
        some: {
          status: { in: ['Pending', 'Processing'] },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: {
      id: true,
      network: true,
      status: true,
      totalItems: true,
      items: { select: { status: true } },
    },
  });

  const results = [];

  for (const batch of failedBatches) {
    const { overallStatus } = computeOverallBatchStatus(batch, batch.items);
    if (overallStatus === 'Completed' || overallStatus === 'Cancelled') {
      await recordGmplSubmission(batch.id, { status: 'skipped', error: null });
      continue;
    }

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
  const { minPending } = getConfig();
  const counts = await orderBatchService.getPendingCountsByNetwork();
  const results = [];

  for (const network of NETWORKS) {
    const pending = counts[network]?.count || 0;
    if (pending < minPending) continue;

    try {
      const result = await exportPendingWithGmpl(adminUserId, network, {
        submitToGmpl: true,
        autoExport: true,
      });

      results.push({
        network,
        batchId: result.batch.id,
        itemCount: result.batch.totalItems,
        gmplStatus: result.gmplStatus,
        gmplError: result.gmplError || null,
      });

      console.log(
        `[GMPL Auto] Exported ${result.batch.totalItems} ${network} orders → batch #${result.batch.id} (GMPL: ${result.gmplStatus})`
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
  backfillStaleGmplStatuses().catch((err) => {
    console.error('[GMPL] Backfill error:', err.message);
  });

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
    `[GMPL Auto] Scheduler started (every ${config.intervalMs / 1000}s, min pending: ${config.minPending}, new pending orders only)`
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

const getAutoExportStatus = () => {
  const config = getConfig();
  return {
    enabled: config.enabled,
    configured: Boolean(process.env.GMPL_API_KEY),
    intervalMs: config.intervalMs,
    minPendingCount: config.minPending,
    retryFailed: config.retryFailed,
    maxRetries: config.maxRetries,
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
};

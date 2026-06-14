const axios = require('axios');
const prisma = require('../config/db');
const orderBatchService = require('./orderBatchService');
const { getGmplConfig } = require('./gmplService');
const { isGmplNetwork } = require('../utils/gmplNetwork');
const { emitPendingQueueChanged } = require('../utils/orderEvents');

let syncRunning = false;

const COMPLETED_STATUSES = new Set([
  'completed',
  'complete',
  'success',
  'successful',
  'fulfilled',
  'delivered',
  'done',
]);

const PROCESSING_STATUSES = new Set([
  'processing',
  'in_progress',
  'in-progress',
  'pending',
  'queued',
  'submitted',
  'active',
]);

const normalizePhone = (phone) => {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('233') && p.length === 12) p = '0' + p.slice(3);
  return p;
};

const mapGmplStatus = (raw) => {
  const s = String(raw || '').toLowerCase().trim();
  if (COMPLETED_STATUSES.has(s)) return 'Completed';
  if (PROCESSING_STATUSES.has(s)) return 'Processing';
  if (s === 'failed' || s === 'cancelled' || s === 'canceled') return 'Failed';
  return null;
};

const findBatch = async ({ batchId, gmplResponseId, gmplOrderId }) => {
  if (batchId) {
    return prisma.orderBatch.findUnique({
      where: { id: parseInt(batchId, 10) },
      include: {
        items: {
          select: {
            id: true,
            status: true,
            mobileNumber: true,
            order: { select: { mobileNumber: true } },
          },
        },
      },
    });
  }

  const gmplId = gmplResponseId || gmplOrderId;
  if (!gmplId) return null;

  return prisma.orderBatch.findFirst({
    where: { gmplResponseId: String(gmplId) },
    include: {
      items: {
        select: {
          id: true,
          status: true,
          mobileNumber: true,
          order: { select: { mobileNumber: true } },
        },
      },
    },
  });
};

const applyLineUpdates = async (batch, lines) => {
  if (!Array.isArray(lines) || lines.length === 0) return { updated: 0 };

  let updated = 0;
  for (const line of lines) {
    const targetStatus = mapGmplStatus(line.status);
    if (!targetStatus || targetStatus === 'Failed') continue;

    const phone = normalizePhone(line.phone || line.phoneNumber || line.msisdn);
    if (!phone) continue;

    const item = batch.items.find((it) => {
      const itemPhone = normalizePhone(it.mobileNumber || it.order?.mobileNumber);
      return itemPhone === phone;
    });

    if (!item || item.status === targetStatus) continue;

    await orderBatchService.updateBatchOrderItemStatus(
      batch.id,
      item.id,
      targetStatus
    );
    updated++;
  }

  return { updated };
};

const refreshBatchOverallStatus = async (batchId) => {
  const batch = await prisma.orderBatch.findUnique({
    where: { id: batchId },
    include: { items: { select: { status: true } } },
  });
  if (!batch) return;

  const total = batch.items.length;
  if (total === 0) return;

  const completed = batch.items.filter((i) => i.status === 'Completed').length;
  const processing = batch.items.filter((i) => i.status === 'Processing').length;

  let status = batch.status;
  if (completed === total) status = 'Completed';
  else if (processing > 0 || completed > 0) status = 'Processing';
  else status = 'Pending';

  if (status !== batch.status) {
    await prisma.orderBatch.update({
      where: { id: batchId },
      data: { status },
    });
  }

  if (status === 'Completed') {
    await orderBatchService.markGmplCompletedIfFulfilled(batchId);
  }
};

const applyFulfillmentUpdate = async (payload = {}) => {
  const batch = await findBatch(payload);
  if (!batch) {
    throw new Error('Batch not found for GMPL status update');
  }

  if (!isGmplNetwork(batch.network)) {
    throw new Error('GMPL status sync applies to MTN batches only');
  }

  const overall = mapGmplStatus(payload.status);
  let result = { batchId: batch.id, updatedItems: 0, batchStatus: batch.status };

  if (Array.isArray(payload.lines) && payload.lines.length > 0) {
    const lineResult = await applyLineUpdates(batch, payload.lines);
    result.updatedItems = lineResult.updated;
    await refreshBatchOverallStatus(batch.id);
  } else if (overall === 'Completed') {
    const updateResult = await orderBatchService.updateBatchStatus(
      batch.id,
      'Completed'
    );
    result.updatedItems = updateResult.updatedItems;
    result.batchStatus = 'Completed';
  } else if (overall === 'Processing') {
    await prisma.orderItem.updateMany({
      where: {
        batchId: batch.id,
        status: 'Pending',
      },
      data: { status: 'Processing' },
    });
    await prisma.orderBatch.update({
      where: { id: batch.id },
      data: { status: 'Processing' },
    });
    result.batchStatus = 'Processing';
  }

  if (overall === 'Completed') {
    await orderBatchService.markGmplCompletedIfFulfilled(batch.id);
  } else if (payload.status && mapGmplStatus(payload.status) === 'Failed') {
    await prisma.orderBatch.update({
      where: { id: batch.id },
      data: {
        gmplStatus: 'failed',
        gmplError: payload.message || payload.error || 'GMPL reported failure',
      },
    });
  }

  if (result.updatedItems > 0 || result.batchStatus !== batch.status) {
    emitPendingQueueChanged({ type: 'batch-updated', batchId: batch.id });
  }

  return result;
};

const fetchGmplRemoteStatus = async (gmplResponseId) => {
  const { baseUrl, apiKey } = getGmplConfig();
  if (!apiKey || !gmplResponseId) return null;

  const id = encodeURIComponent(String(gmplResponseId));
  const candidates = [
    `${baseUrl}/api/orders/agents/${id}`,
    `${baseUrl}/api/orders/agents/${id}/status`,
  ];

  for (const url of candidates) {
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'x-clerk-api-key': apiKey,
        },
        timeout: 30000,
        validateStatus: (status) => status < 500,
      });
      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }
    } catch (_) {
      /* try next candidate */
    }
  }

  return null;
};

const syncBatchFromGmpl = async (batch) => {
  if (!batch.gmplResponseId || batch.gmplStatus !== 'submitted') {
    return { skipped: true, batchId: batch.id };
  }

  const remote = await fetchGmplRemoteStatus(batch.gmplResponseId);
  if (!remote) return { skipped: true, batchId: batch.id, reason: 'no_remote_data' };

  const status =
    remote.status ||
    remote.orderStatus ||
    remote.state ||
    remote.data?.status;
  const lines =
    remote.lines ||
    remote.items ||
    remote.orders ||
    remote.data?.lines ||
    remote.data?.items;

  return applyFulfillmentUpdate({
    batchId: batch.id,
    status,
    lines,
  });
};

const runGmplStatusSyncCycle = async () => {
  if (process.env.GMPL_STATUS_SYNC === 'false') {
    return { skipped: true, reason: 'disabled' };
  }
  if (!process.env.GMPL_API_KEY) {
    return { skipped: true, reason: 'no_api_key' };
  }
  if (syncRunning) return { skipped: true, reason: 'already_running' };

  syncRunning = true;

  try {
    const batches = await prisma.orderBatch.findMany({
      where: {
        network: 'MTN',
        gmplStatus: 'submitted',
        gmplResponseId: { not: null },
        status: { not: 'Completed' },
      },
      orderBy: { gmplSubmittedAt: 'asc' },
      take: 10,
      select: {
        id: true,
        gmplResponseId: true,
        gmplStatus: true,
        network: true,
        status: true,
      },
    });

    const results = [];
    for (const batch of batches) {
      try {
        const result = await syncBatchFromGmpl(batch);
        results.push(result);
        if (result.updatedItems > 0 || result.batchStatus === 'Completed') {
          console.log(
            `[GMPL Status] Batch #${batch.id} sync → ${result.batchStatus || 'updated'} (${result.updatedItems || 0} items)`
          );
        }
      } catch (err) {
        results.push({ batchId: batch.id, error: err.message });
        console.error(`[GMPL Status] Batch #${batch.id}:`, err.message);
      }
    }

    return { synced: results.length, results };
  } finally {
    syncRunning = false;
  }
};

const startGmplStatusSyncScheduler = () => {
  if (process.env.GMPL_STATUS_SYNC === 'false') {
    console.log('[GMPL Status] Sync disabled (GMPL_STATUS_SYNC=false)');
    return;
  }
  if (!process.env.GMPL_API_KEY) return;

  const intervalMs = Math.max(
    60_000,
    parseInt(process.env.GMPL_STATUS_SYNC_INTERVAL_MS || '180000', 10)
  );

  console.log(`[GMPL Status] Sync scheduler started (every ${intervalMs / 1000}s)`);

  setInterval(() => {
    runGmplStatusSyncCycle().catch((err) => {
      console.error('[GMPL Status] Cycle error:', err.message);
    });
  }, intervalMs);

  setTimeout(() => {
    runGmplStatusSyncCycle().catch(() => {});
  }, 60_000);
};

const verifyWebhookSecret = (req) => {
  const expected = process.env.GMPL_WEBHOOK_SECRET;
  if (!expected) return true;

  const provided =
    req.headers['x-gmpl-webhook-secret'] ||
    req.headers['x-webhook-secret'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  return provided === expected;
};

module.exports = {
  applyFulfillmentUpdate,
  syncBatchFromGmpl,
  runGmplStatusSyncCycle,
  startGmplStatusSyncScheduler,
  verifyWebhookSecret,
};

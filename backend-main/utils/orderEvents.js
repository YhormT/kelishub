const NETWORKS = ['MTN', 'TELECEL', 'AIRTEL TIGO'];

const detectNetwork = (productName) => {
  const name = String(productName || '').toUpperCase();
  for (const net of NETWORKS) {
    if (name.startsWith(net)) return net;
  }
  return null;
};

const summarizeOrderItems = (items = []) => {
  const networks = { MTN: 0, TELECEL: 0, 'AIRTEL TIGO': 0 };
  for (const item of items) {
    const net = detectNetwork(item.productName || item.product?.name);
    if (net) networks[net] += item.quantity || 1;
  }
  return networks;
};

/**
 * Notify admin UIs that the pending export queue changed (new order, export, etc.)
 */
const emitPendingQueueChanged = (payload = {}) => {
  // Trigger GMPL auto-export independently of socket availability so a missing
  // or not-yet-ready io connection never prevents pending orders from exporting.
  if (payload.orderId && payload.type !== 'exported') {
    try {
      const { scheduleImmediateAutoExport } = require('../services/gmplAutoExportService');
      scheduleImmediateAutoExport(payload);
    } catch (e) {
      /* auto-export scheduling is best-effort */
    }
  }

  try {
    const { io } = require('../index');
    if (!io) return;
    io.emit('order-pending-changed', payload);
    if (payload.orderId) {
      io.emit('new-order', payload);
    }
  } catch (e) {
    /* socket emit is best-effort */
  }
};

module.exports = {
  NETWORKS,
  detectNetwork,
  summarizeOrderItems,
  emitPendingQueueChanged,
};

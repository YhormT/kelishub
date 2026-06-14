const prisma = require("../config/db");
const { createTransaction } = require("./transactionService");

/**
 * Get counts of pending order items grouped by network (for export UI)
 */
const getPendingCountsByNetwork = async () => {
  // Find all pending OrderItems that have NOT been assigned to any batch yet
  const items = await prisma.orderItem.findMany({
    where: {
      status: "Pending",
      batchId: null
    },
    select: { productName: true, productPrice: true, quantity: true, product: { select: { name: true, price: true } } }
  });

  const networks = { MTN: { count: 0, total: 0 }, TELECEL: { count: 0, total: 0 }, "AIRTEL TIGO": { count: 0, total: 0 } };

  for (const item of items) {
    const name = (item.productName || item.product?.name || "").toUpperCase();
    for (const net of Object.keys(networks)) {
      if (name.startsWith(net)) {
        networks[net].count++;
        networks[net].total += (item.productPrice || item.product?.price || 0) * item.quantity;
        break;
      }
    }
  }

  return networks;
};

/**
 * Pending purchaser orders not yet exported (for admin queue display)
 */
const getPendingQueue = async () => {
  const items = await prisma.orderItem.findMany({
    where: {
      status: "Pending",
      batchId: null,
    },
    orderBy: { order: { createdAt: "desc" } },
    take: 200,
    select: {
      id: true,
      orderId: true,
      mobileNumber: true,
      productName: true,
      productPrice: true,
      quantity: true,
      product: { select: { name: true, price: true } },
      order: {
        select: {
          createdAt: true,
          mobileNumber: true,
          user: { select: { id: true, name: true, phone: true } },
        },
      },
    },
  });

  const networks = {
    MTN: { count: 0, total: 0, items: [] },
    TELECEL: { count: 0, total: 0, items: [] },
    "AIRTEL TIGO": { count: 0, total: 0, items: [] },
  };

  for (const item of items) {
    const name = (item.productName || item.product?.name || "").toUpperCase();
    let network = null;
    for (const net of Object.keys(networks)) {
      if (name.startsWith(net)) {
        network = net;
        break;
      }
    }
    if (!network) continue;

    const price =
      (item.productPrice != null ? item.productPrice : item.product?.price || 0) *
      item.quantity;

    networks[network].count++;
    networks[network].total += price;
    networks[network].items.push({
      itemId: item.id,
      orderId: item.orderId,
      agentName:
        item.order?.user?.name ||
        item.order?.user?.phone ||
        "N/A",
      phone: item.mobileNumber || item.order?.mobileNumber || "",
      product: item.productName || item.product?.name || "N/A",
      price,
      createdAt: item.order?.createdAt,
    });
  }

  return networks;
};

/**
 * Pending purchaser orders (distinct orderId) per network — for auto-export gating.
 */
const getPendingOrderCountsByNetwork = async () => {
  const items = await prisma.orderItem.findMany({
    where: {
      status: "Pending",
      batchId: null,
    },
    select: {
      orderId: true,
      productName: true,
      product: { select: { name: true } },
    },
  });

  const orderSets = {
    MTN: new Set(),
    TELECEL: new Set(),
    "AIRTEL TIGO": new Set(),
  };

  for (const item of items) {
    const name = (item.productName || item.product?.name || "").toUpperCase();
    for (const net of Object.keys(orderSets)) {
      if (name.startsWith(net)) {
        orderSets[net].add(item.orderId);
        break;
      }
    }
  }

  return {
    MTN: { count: orderSets.MTN.size },
    TELECEL: { count: orderSets.TELECEL.size },
    "AIRTEL TIGO": { count: orderSets["AIRTEL TIGO"].size },
  };
};

/**
 * Export pending orders by network — one batch per purchaser order (not one mega-batch).
 * @param {number|null|undefined} maxOrders — cap orders exported this run (FIFO). Omit/null = all pending orders.
 */
const exportPendingByNetwork = async (adminUserId, network, { maxOrders } = {}) => {
  return await prisma.$transaction(async (tx) => {
    const pendingItems = await tx.orderItem.findMany({
      where: {
        status: "Pending",
        batchId: null,
        OR: [
          { productName: { startsWith: network.toUpperCase() } },
          { productName: null, product: { name: { startsWith: network.toUpperCase() } } },
          { productName: "", product: { name: { startsWith: network.toUpperCase() } } }
        ]
      },
      include: {
        order: { include: { user: { select: { id: true, name: true, phone: true } } } },
        product: { select: { id: true, name: true, description: true, price: true } }
      },
      orderBy: { order: { createdAt: "asc" } }
    });

    if (pendingItems.length === 0) {
      throw new Error(`No pending orders found for ${network}`);
    }

    const byOrder = new Map();
    for (const item of pendingItems) {
      if (!byOrder.has(item.orderId)) byOrder.set(item.orderId, []);
      byOrder.get(item.orderId).push(item);
    }

    const exportStamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const batches = [];

    const createBatchForOrder = async (orderId, items) => {
      let totalPrice = 0;
      for (const item of items) {
        totalPrice += (item.productPrice || item.product.price) * item.quantity;
      }

      const filename = `${network.toUpperCase()}_order_${orderId}_${exportStamp}.xlsx`;
      const batch = await tx.orderBatch.create({
        data: {
          userId: parseInt(adminUserId),
          filename,
          network: network.toUpperCase(),
          totalItems: items.length,
          totalPrice,
          status: "Pending"
        }
      });

      await tx.order.updateMany({
        where: { id: orderId, batchId: null },
        data: { batchId: batch.id }
      });

      const itemIds = items.map((item) => item.id);
      await tx.orderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { status: "Processing", batchId: batch.id }
      });

      await tx.orderBatch.update({
        where: { id: batch.id },
        data: { status: "Processing" }
      });

      const rows = items.map((item) => ({
        orderId: item.orderId,
        itemId: item.id,
        agent: item.order.user?.name || "N/A",
        phone: item.mobileNumber || item.order.mobileNumber || "",
        product: item.productName || item.product.name,
        bundle: item.productDescription || item.product.description,
        price: item.productPrice || item.product.price,
        quantity: item.quantity,
        status: "Processing"
      }));

      return { batch, rows, orderId, totalPrice, totalItems: items.length };
    };

    const orderEntries = [...byOrder.entries()];
    const orderLimit =
      maxOrders != null && maxOrders > 0
        ? Math.min(maxOrders, orderEntries.length)
        : orderEntries.length;
    const ordersToExport = orderEntries.slice(0, orderLimit);

    for (const [orderId, items] of ordersToExport) {
      batches.push(await createBatchForOrder(orderId, items));
    }

    const allRows = batches.flatMap((b) => b.rows);
    const totalPrice = batches.reduce((sum, b) => sum + b.totalPrice, 0);
    const exportedItemCount = batches.reduce((sum, b) => sum + b.totalItems, 0);

    return {
      batches,
      batch: batches[0]?.batch,
      rows: allRows,
      totalItems: exportedItemCount,
      totalPrice,
      orderCount: batches.length,
      pendingOrderCount: orderEntries.length,
      remainingPendingOrders: Math.max(0, orderEntries.length - batches.length),
    };
  }, { timeout: 60000 });
};

/**
 * Get all order batches with computed stats
 */
const getAllBatches = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [totalCount, batches] = await Promise.all([
    prisma.orderBatch.count(),
    prisma.orderBatch.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        filename: true,
        network: true,
        totalItems: true,
        totalPrice: true,
        status: true,
        gmplStatus: true,
        gmplSubmittedAt: true,
        gmplError: true,
        gmplResponseId: true,
        gmplAutoExport: true,
        gmplRetryCount: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        _count: { select: { items: true } },
        items: {
          select: {
            id: true, status: true,
            order: { select: { id: true, user: { select: { id: true, name: true } } } }
          }
        }
      }
    })
  ]);

  const result = batches.map(batch => {
    const totalItems = batch.totalItems || batch._count.items;
    let statusCounts = { Pending: 0, Processing: 0, Completed: 0, Cancelled: 0 };

    for (const item of batch.items) {
      const s = item.status === "Canceled" ? "Cancelled" : item.status;
      if (statusCounts[s] !== undefined) statusCounts[s]++;
    }

    let overallStatus = batch.status;
    if (totalItems > 0) {
      if (statusCounts.Completed === totalItems) overallStatus = "Completed";
      else if (statusCounts.Cancelled === totalItems) overallStatus = "Cancelled";
      else if (statusCounts.Processing > 0) overallStatus = "Processing";
      else overallStatus = "Pending";
    }

    const agents = [];
    const seenAgents = new Set();
    for (const item of batch.items) {
      const user = item.order?.user;
      if (user && !seenAgents.has(user.id)) {
        seenAgents.add(user.id);
        agents.push(user);
      }
    }

    return {
      id: batch.id,
      filename: batch.filename,
      network: batch.network,
      totalItems,
      totalPrice: batch.totalPrice,
      status: overallStatus,
      statusCounts,
      gmplStatus: batch.gmplStatus,
      gmplSubmittedAt: batch.gmplSubmittedAt,
      gmplError: batch.gmplError,
      gmplResponseId: batch.gmplResponseId,
      gmplAutoExport: batch.gmplAutoExport,
      gmplRetryCount: batch.gmplRetryCount,
      createdAt: batch.createdAt,
      exportedBy: batch.user,
      agents,
      orderIds: [...new Set(batch.items.map(i => i.order?.id).filter(Boolean))]
    };
  });

  return {
    batches: result,
    pagination: {
      page, limit, total: totalCount,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
};

/**
 * Get a specific batch with all its orders and order items
 */
const getBatchById = async (batchId) => {
  const batch = await prisma.orderBatch.findUnique({
    where: { id: parseInt(batchId) },
    include: {
      user: { select: { id: true, name: true } },
      items: {
        include: {
          order: { include: { user: { select: { id: true, name: true, phone: true } } } },
          product: { select: { id: true, name: true, description: true, price: true } }
        }
      }
    }
  });

  if (!batch) throw new Error("Order batch not found");

  // Restructure items into orders format for frontend compatibility
  const orderMap = new Map();
  for (const item of batch.items) {
    const orderId = item.orderId;
    if (!orderMap.has(orderId)) {
      orderMap.set(orderId, {
        id: orderId,
        user: item.order?.user || null,
        items: []
      });
    }
    orderMap.get(orderId).items.push(item);
  }
  batch.orders = [...orderMap.values()];

  const statusCounts = { Pending: 0, Processing: 0, Completed: 0, Cancelled: 0 };
  for (const item of batch.items) {
    const s = item.status === 'Canceled' ? 'Cancelled' : item.status;
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  }
  batch.statusCounts = statusCounts;

  return batch;
};

const computeBatchStatusFromItems = (items) => {
  const total = items.length;
  if (total === 0) return "Pending";

  const completed = items.filter((i) => i.status === "Completed").length;
  const processing = items.filter((i) => i.status === "Processing").length;

  if (completed === total) return "Completed";
  if (processing > 0 || completed > 0) return "Processing";
  return "Pending";
};

const refreshBatchOverallStatus = async (batchId, tx = prisma) => {
  const batch = await tx.orderBatch.findUnique({
    where: { id: parseInt(batchId, 10) },
    include: { items: { select: { status: true } } },
  });
  if (!batch) return null;

  const status = computeBatchStatusFromItems(batch.items);
  if (status !== batch.status) {
    await tx.orderBatch.update({
      where: { id: batch.id },
      data: { status },
    });
  }

  return status;
};

/** When a batch is fully fulfilled, close out GMPL tracking (manual or supplier path). */
const markGmplCompletedIfFulfilled = async (batchId, tx = prisma) => {
  const batch = await tx.orderBatch.findUnique({
    where: { id: parseInt(batchId, 10) },
    include: { items: { select: { status: true } } },
  });
  if (!batch) return false;

  const allCompleted =
    batch.items.length > 0 &&
    batch.items.every((i) => i.status === "Completed");
  const batchCompleted = batch.status === "Completed" || allCompleted;

  if (!batchCompleted) return false;

  if (batch.gmplStatus === "completed") return true;

  await tx.orderBatch.update({
    where: { id: batch.id },
    data: {
      gmplStatus: "completed",
      gmplError: null,
      status: "Completed",
    },
  });

  return true;
};

/**
 * Update status of all order items in a batch (auto-refund on cancel)
 */
const updateBatchStatus = async (batchId, newStatus) => {
  const validStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status. Must be: Pending, Processing, Completed, or Cancelled");
  }

  return await prisma.$transaction(async (tx) => {
    const batch = await tx.orderBatch.findUnique({
      where: { id: parseInt(batchId) },
      include: {
        items: {
          include: { order: true, product: true }
        }
      }
    });

    if (!batch) throw new Error("Order batch not found");

    let totalRefund = 0;
    let updatedCount = 0;

    if (newStatus === "Cancelled") {
      // Group items by order for refund processing
      const orderItemsMap = new Map();
      for (const item of batch.items) {
        if (!orderItemsMap.has(item.orderId)) {
          orderItemsMap.set(item.orderId, { order: item.order, items: [] });
        }
        orderItemsMap.get(item.orderId).items.push(item);
      }

      for (const [orderId, { order, items }] of orderItemsMap) {
        const refundReference = `batch_refund:${batchId}:order:${orderId}`;
        const existingRefund = await tx.transaction.findFirst({
          where: { userId: order.userId, type: "ORDER_ITEMS_REFUND", reference: refundReference }
        });

        if (!existingRefund) {
          let orderRefund = 0;
          for (const item of items) {
            if (item.status !== "Cancelled" && item.status !== "Canceled") {
              orderRefund += (item.productPrice || item.product.price) * item.quantity;
            }
          }
          if (orderRefund > 0) {
            await createTransaction(order.userId, orderRefund, "ORDER_ITEMS_REFUND",
              `Batch #${batchId} - Order #${orderId} cancelled & refunded (Amount: ${orderRefund})`,
              refundReference, tx);
            totalRefund += orderRefund;
          }
        }
      }
    }

    // Update all items in this batch by their batchId
    const result = await tx.orderItem.updateMany({
      where: { batchId: parseInt(batchId) },
      data: { status: newStatus }
    });
    updatedCount = result.count;

    await tx.orderBatch.update({
      where: { id: parseInt(batchId) },
      data: { status: newStatus }
    });

    if (newStatus === "Completed") {
      await markGmplCompletedIfFulfilled(parseInt(batchId), tx);
    }

    return {
      success: true, batchId: parseInt(batchId), newStatus, updatedItems: updatedCount, totalRefund,
      message: `Batch #${batchId}: ${updatedCount} items updated to ${newStatus}${totalRefund > 0 ? `, refunded GHS ${totalRefund.toFixed(2)}` : ''}`
    };
  }, { timeout: 30000 });
};

/**
 * Update a single order item status within a batch (with refund if cancelled)
 */
const updateBatchOrderItemStatus = async (batchId, itemId, newStatus) => {
  const validStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
  if (!validStatuses.includes(newStatus)) throw new Error("Invalid status");

  return await prisma.$transaction(async (tx) => {
    const item = await tx.orderItem.findUnique({
      where: { id: parseInt(itemId) },
      include: { order: true, product: true }
    });

    if (!item) throw new Error("Order item not found");
    if (item.batchId !== parseInt(batchId)) throw new Error("Order item does not belong to this batch");

    if (newStatus === "Cancelled" && item.status !== "Cancelled" && item.status !== "Canceled") {
      const refundReference = `batch_item_refund:${batchId}:item:${itemId}`;
      const existingRefund = await tx.transaction.findFirst({
        where: { userId: item.order.userId, type: "ORDER_ITEM_REFUND", reference: refundReference }
      });

      if (!existingRefund) {
        const refundAmount = (item.productPrice || item.product.price) * item.quantity;
        if (refundAmount > 0) {
          await createTransaction(item.order.userId, refundAmount, "ORDER_ITEM_REFUND",
            `Batch #${batchId} - Item #${itemId} cancelled & refunded (Amount: ${refundAmount})`,
            refundReference, tx);
        }
      }
    }

    const updatedItem = await tx.orderItem.update({
      where: { id: parseInt(itemId) },
      data: { status: newStatus }
    });

    const batchStatus = await refreshBatchOverallStatus(parseInt(batchId), tx);
    if (batchStatus === "Completed") {
      await markGmplCompletedIfFulfilled(parseInt(batchId), tx);
    }

    return { success: true, item: updatedItem, batchStatus };
  }, { timeout: 15000 });
};

/**
 * Re-download a batch as Excel (for re-export)
 */
const getBatchForDownload = async (batchId) => {
  const batch = await prisma.orderBatch.findUnique({
    where: { id: parseInt(batchId) },
    include: {
      items: {
        include: {
          order: { include: { user: { select: { name: true } } } },
          product: { select: { name: true, description: true, price: true } }
        }
      }
    }
  });

  if (!batch) throw new Error("Batch not found");

  const rows = batch.items.map(item => ({
    orderId: item.orderId,
    itemId: item.id,
    agent: item.order?.user?.name || "N/A",
    phone: item.mobileNumber || item.order?.mobileNumber || "",
    product: item.productName || item.product.name,
    bundle: item.productDescription || item.product.description,
    price: item.productPrice || item.product.price,
    quantity: item.quantity,
    status: item.status
  }));

  return { batch, rows };
};

module.exports = {
  getPendingCountsByNetwork,
  getPendingOrderCountsByNetwork,
  getPendingQueue,
  exportPendingByNetwork,
  getAllBatches,
  getBatchById,
  refreshBatchOverallStatus,
  markGmplCompletedIfFulfilled,
  updateBatchStatus,
  updateBatchOrderItemStatus,
  getBatchForDownload
};

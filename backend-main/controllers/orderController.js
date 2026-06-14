const {
  submitCart,
  getOrderStatus,
  processOrderItem,
  getAllOrders,
  processOrder,
  getUserCompletedOrders,
  getOrderHistory,
  updateOrderItemsStatus,
  updateSingleOrderItemStatus,
  downloadOrdersForExcel,
  getOrderTrackerData,
  cancelOrderItem,
  resolveAlert,
} = require("../services/orderService");

const orderService = require("../services/orderService");
const prisma = require("../config/db");
const path = require("path");
const {
  emitPendingQueueChanged,
  summarizeOrderItems,
} = require("../utils/orderEvents");

// Helper: emit balance-updated WebSocket event to a specific user after refund
const emitBalanceUpdate = async (userId) => {
  try {
    const { io, userSockets } = require("../index");
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { loanBalance: true, adminLoanBalance: true, hasLoan: true },
    });
    if (user && io && userSockets) {
      const socketId =
        userSockets.get(String(userId)) || userSockets.get(userId);
      if (socketId) {
        io.to(socketId).emit("balance-updated", {
          loanBalance: user.loanBalance,
          adminLoanBalance: user.adminLoanBalance,
          hasLoan: user.hasLoan,
          type: "REFUND",
        });
      }
    }
  } catch (e) {
    /* socket emit is best-effort */
  }
};

exports.submitCart = async (req, res) => {
  try {
    const { userId, mobileNumber } = req.body;

    const order = await submitCart(userId, mobileNumber);

    emitPendingQueueChanged({
      orderId: order.id,
      userId,
      itemCount: order.items?.length || 0,
      networks: summarizeOrderItems(order.items),
      source: "cart",
    });

    res.status(201).json({
      success: true,
      message: "Order submitted successfully",
      order,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await getAllOrders(parseInt(limit), parseInt(offset));

    // Transform data to match frontend expectations
    const transformedData = result.orders.flatMap((order) =>
      order.items.map((item) => ({
        ...item,
        orderId: order.id,
        createdAt: order.createdAt,
        user: order.user,
        order: {
          ...order,
          items: [item], // Only include current item to avoid status mix-ups
        },
      })),
    );

    res.json(transformedData);
  } catch (error) {
    console.error("Error in getAllOrders:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      orderIdFilter,
      phoneNumberFilter,
      selectedProduct,
      selectedStatusMain,
      selectedDate,
      startTime,
      endTime,
      sortOrder = "newest",
      showNewRequestsOnly = false,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      orderIdFilter,
      phoneNumberFilter,
      selectedProduct,
      selectedStatusMain,
      selectedDate,
      startTime,
      endTime,
      sortOrder,
      showNewRequestsOnly: showNewRequestsOnly === "true",
    };

    const result = await getOrderStatus(options);
    res.json(result);
  } catch (error) {
    console.error("Error in getOrderStatus:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.processOrderItem = async (req, res) => {
  const { orderItemId, status } = req.body;
  try {
    const updatedItem = await processOrderItem(orderItemId, status);
    // Emit balance update if refund occurred
    if (
      ["Cancelled", "Canceled"].includes(status) &&
      updatedItem?.order?.userId
    ) {
      await emitBalanceUpdate(updatedItem.order.userId);
    }
    res.json({ message: "Order item status updated", updatedItem });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.processOrderController = async (req, res) => {
  const { status } = req.body;
  try {
    const updatedOrder = await processOrder(
      parseInt(req.params.orderId),
      status,
    );
    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUserCompletedOrdersController = async (req, res) => {
  try {
    const orders = await getUserCompletedOrders(parseInt(req.params.userId));
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getOrderHistory = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId); // Get userId from request params

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Users can only view their own order history; admins can view any
    if (req.user.role?.toUpperCase() !== "ADMIN" && req.user.id !== userId) {
      return res
        .status(403)
        .json({ error: "You can only view your own order history" });
    }

    const orders = await getOrderHistory(userId);

    res.json(orders || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrderItemsStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate inputs
    if (!orderId) {
      return res
        .status(400)
        .json({ success: false, message: "Order ID is required" });
    }

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "New status is required" });
    }

    // Validate status is one of the allowed values
    const allowedStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const result = await updateOrderItemsStatus(orderId, status);
    // Emit balance update if refund occurred
    if (["Cancelled", "Canceled"].includes(status)) {
      try {
        const order = await prisma.order.findUnique({
          where: { id: parseInt(orderId) },
          select: { userId: true },
        });
        if (order?.userId) await emitBalanceUpdate(order.userId);
      } catch (e) {
        /* best-effort */
      }
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order items status",
    });
  }
};

exports.updateSingleOrderItemStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    if (!itemId) {
      return res
        .status(400)
        .json({ success: false, message: "Item ID is required" });
    }

    if (!status) {
      return res
        .status(400)
        .json({ success: false, message: "New status is required" });
    }

    const allowedStatuses = ["Pending", "Processing", "Completed", "Cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const result = await updateSingleOrderItemStatus(itemId, status);
    // Emit balance update if refund occurred
    if (["Cancelled", "Canceled"].includes(status)) {
      try {
        const item = await prisma.orderItem.findUnique({
          where: { id: parseInt(itemId) },
          include: { order: { select: { userId: true } } },
        });
        if (item?.order?.userId) await emitBalanceUpdate(item.order.userId);
      } catch (e) {
        /* best-effort */
      }
    }
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order item status",
    });
  }
};

((exports.getOrders = async (req, res) => {
  try {
    const { page, limit, startDate, endDate, status, product, mobileNumber } =
      req.query;

    const filters = {
      startDate,
      endDate,
      status,
      product,
      mobileNumber,
    };

    const result = await orderService.getOrdersPaginated({
      page,
      limit,
      filters,
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: error.message });
  }
}),
  // Excel Upload Controller for Agent Orders
  (exports.uploadExcelOrders = async (req, res) => {
    const prisma = require("../config/db");
    const userService = require("../services/userService");
    const productService = require("../services/productService");
    const cartService = require("../services/cartService");
    const xlsx = require("xlsx");
    const fs = require("fs");

    try {
      const { agentId, network } = req.body;
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded." });
      }
      if (!agentId || !network) {
        return res
          .status(400)
          .json({ success: false, message: "Missing agentId or network." });
      }

      // Parse Excel file
      const filePath = req.file.path;
      let data = [];
      try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
      } catch (parseErr) {
        return res
          .status(400)
          .json({ success: false, message: "Failed to parse Excel file." });
      }

      let total = data.length;
      let errorReport = [];

      // Fetch agent/user and role
      const agent = await userService.getUserById(parseInt(agentId));
      if (!agent) {
        fs.unlinkSync(filePath);
        return res
          .status(400)
          .json({ success: false, message: "Agent not found." });
      }
      const userRole = agent.role;
      const username = agent.name;

      // Validate all rows before adding to cart
      let productsToAdd = [];
      let totalCost = 0;
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const phoneNumber = row["phone"] ? String(row["phone"]).trim() : "";
        const item = row["item"] ? String(row["item"]).trim() : "";
        const bundleAmount = row["bundle amount"]
          ? String(row["bundle amount"]).trim()
          : "";
        const quantity = 1;
        let rowErrors = [];
        if (!phoneNumber) rowErrors.push("Missing phone");
        if (!item) rowErrors.push("Missing item (e.g: MTN - SUPERAGENT)");
        if (!bundleAmount) rowErrors.push("Missing bundle amount (e.g: 50GB)");
        // Lookup product by item and bundle amount
        let product = await prisma.product.findFirst({
          where: {
            name: item,
            description: bundleAmount,
          },
        });
        if (!product) {
          rowErrors.push(
            "Product not found for item: " +
              item +
              " and bundle amount: " +
              bundleAmount,
          );
        }
        // Get price for user role
        let finalPrice = null;
        if (product) {
          finalPrice = productService.getPriceForUserRole(userRole, product);
          if (finalPrice == null) {
            rowErrors.push(
              "Price could not be determined for user role and product.",
            );
          }
        }
        // Check stock
        if (product && product.stock < quantity) {
          rowErrors.push(
            "Not enough stock for product: " + item + " (" + bundleAmount + ")",
          );
        }
        // Accumulate total cost
        if (finalPrice && rowErrors.length === 0) {
          totalCost += finalPrice * quantity;
          productsToAdd.push({
            product,
            quantity,
            phoneNumber,
            price: finalPrice,
          });
        } else if (rowErrors.length > 0) {
          errorReport.push({ row: i + 2, errors: rowErrors });
        }
      }

      // Check agent wallet balance (loanBalance)
      if (productsToAdd.length > 0 && agent.loanBalance < totalCost) {
        errorReport.push({
          row: "ALL",
          errors: [
            "Insufficient wallet balance for total order. Required: GHS " +
              totalCost.toFixed(2) +
              ", Available: GHS " +
              agent.loanBalance.toFixed(2),
          ],
        });
      }

      // If any errors, do not add to cart
      if (errorReport.length > 0) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, errorReport });
      }

      // All validations passed, add to cart
      let added = 0;
      for (const item of productsToAdd) {
        await cartService.addItemToCart(
          agent.id,
          item.product.id,
          item.quantity,
          item.phoneNumber,
        );
        added++;
      }
      fs.unlinkSync(filePath);
      return res.json({
        success: true,
        message: `${added} products added to cart.`,
        summary: { total, added },
      });
    } catch (err) {
      if (req.file && req.file.path)
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      res.status(500).json({ success: false, message: err.message });
    }
  }));

((exports.getOrderStats = async (req, res) => {
  try {
    const stats = await orderService.getOrderStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching order stats:", error);
    res.status(500).json({ error: error.message });
  }
}),
  (exports.downloadSimplifiedTemplate = (req, res) => {
    const filePath = path.join(
      __dirname,
      "..",
      "public",
      "order_template.xlsx",
    );
    res.download(filePath, "order_template.xlsx", (err) => {
      if (err) {
        console.error("Error downloading template:", err);
        res.status(500).send("Could not download the file.");
      }
    });
  }));

// New Excel Upload Controller for Simplified (2-column) Agent Orders
exports.uploadSimplifiedExcelOrders = async (req, res) => {
  const prisma = require("../config/db");
  const userService = require("../services/userService");
  const cartService = require("../services/cartService");
  const xlsx = require("xlsx");
  const fs = require("fs");

  try {
    const { agentId, network } = req.body;
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded." });
    }
    if (!agentId || !network) {
      return res
        .status(400)
        .json({ success: false, message: "Missing agentId or network." });
    }

    const filePath = req.file.path;
    let data = [];
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } catch (parseErr) {
      return res
        .status(400)
        .json({ success: false, message: "Failed to parse Excel file." });
    }

    let total = data.length;
    let errorReport = [];

    const agent = await userService.getUserById(parseInt(agentId));
    if (!agent) {
      fs.unlinkSync(filePath);
      return res
        .status(400)
        .json({ success: false, message: "Agent not found." });
    }
    const userRole = agent.role;

    let productsToAdd = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Support multiple column name variations (case-insensitive)
      const getColumnValue = (row, possibleNames) => {
        for (const name of possibleNames) {
          // Check exact match first
          if (row[name] !== undefined) return String(row[name]).trim();
          // Check case-insensitive match
          const key = Object.keys(row).find(
            (k) => k.toLowerCase() === name.toLowerCase(),
          );
          if (key && row[key] !== undefined) return String(row[key]).trim();
        }
        return "";
      };

      const phoneNumber = getColumnValue(row, [
        "phone",
        "Phone",
        "PHONE",
        "phone_number",
        "Phone Number",
        "phoneNumber",
      ]);
      const bundleAmount = getColumnValue(row, [
        "bundle_amount",
        "bundle amount",
        "Bundle_Amount",
        "Bundle Amount",
        "BUNDLE_AMOUNT",
        "BUNDLE AMOUNT",
        "bundle",
        "Bundle",
        "amount",
        "Amount",
        "data",
        "Data",
        "gb",
        "GB",
      ]);

      let rowErrors = [];

      if (!phoneNumber) rowErrors.push("Missing phone number.");
      if (!bundleAmount || isNaN(parseFloat(bundleAmount)))
        rowErrors.push(
          `Invalid or missing bundle amount. It must be a number. Got: "${bundleAmount}"`,
        );

      if (rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
        continue; // Skip to next row
      }

      const productDescription = `${bundleAmount}GB`;
      let productName;
      if (userRole.toUpperCase() === "USER") {
        // For 'USER' role, product name is just the network
        productName = network.toUpperCase();
      } else {
        // For all other roles, it's 'NETWORK - ROLE'
        productName = `${network.toUpperCase()} - ${userRole.toUpperCase()}`;
      }

      const product = await prisma.product.findFirst({
        where: {
          name: productName,
          description: productDescription,
        },
      });

      if (!product) {
        rowErrors.push(
          `Product not found for your user type (${userRole}) with bundle ${productDescription} and network ${network}.`,
        );
      } else {
        productsToAdd.push({
          product,
          quantity: 1, // Quantity is always 1 in the new flow
          phoneNumber,
        });
      }

      if (rowErrors.length > 0) {
        errorReport.push({ row: i + 2, errors: rowErrors });
      }
    }

    if (errorReport.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "Validation errors occurred.",
        summary: {
          total,
          successful: total - errorReport.length,
          failed: errorReport.length,
        },
        errors: errorReport,
      });
    }

    const productService = require("../services/productService");
    let totalCost = 0;
    for (const item of productsToAdd) {
      const unitPrice =
        productService.getPriceForUserRole(userRole, item.product) ??
        item.product.price;
      totalCost += unitPrice * item.quantity;
    }

    if (agent.loanBalance < totalCost) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: `Insufficient wallet balance. Required: GHS ${totalCost.toFixed(2)}, available: GHS ${agent.loanBalance.toFixed(2)}`,
      });
    }

    // All validations passed, add to cart
    let added = 0;
    for (const item of productsToAdd) {
      await cartService.addItemToCart(
        agent.id,
        item.product.id,
        item.quantity,
        item.phoneNumber,
      );
      added++;
    }
    fs.unlinkSync(filePath);
    return res.json({
      success: true,
      message: `${added} products added to cart.`,
      summary: { total, successful: added, failed: 0 },
    });
  } catch (err) {
    if (req.file && req.file.path)
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const updatedOrder = await orderService.updateOrderStatus(orderId, status);
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: error.message });
  }
};

// Direct order creation from ext_agent system
exports.createDirectOrder = async (req, res) => {
  try {
    const { userId, items, totalAmount } = req.body;

    // Validate required fields
    if (!userId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, items array",
      });
    }

    const order = await orderService.createDirectOrder(
      userId,
      items,
      totalAmount,
    );

    emitPendingQueueChanged({
      orderId: order.id,
      userId,
      itemCount: items?.length || 0,
      networks: summarizeOrderItems(order.items),
      source: "direct",
    });

    res.status(201).json({
      success: true,
      message: "Direct order created successfully",
      orderId: order.id,
      order,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get specific order by ID for status sync
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const prisma = require("../config/db");

    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, description: true, price: true },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order ${orderId} not found`,
      });
    }

    // Transform to match expected format
    const matchingOrders = order.items.map((item) => ({
      id: item.id,
      orderId: order.id,
      productId: item.productId,
      quantity: item.quantity,
      mobileNumber: item.mobileNumber || order.mobileNumber,
      user: order.user,
      product: item.product,
      order: {
        id: order.id,
        createdAt: order.createdAt,
        items: [{ status: item.status }],
      },
    }));

    res.json({
      success: true,
      data: matchingOrders,
      orderId: parseInt(orderId),
      itemCount: matchingOrders.length,
    });
  } catch (error) {
    console.error(
      `[GET ORDER] Error fetching order ${req.params.orderId}:`,
      error,
    );
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get multiple orders by IDs for GB calculation
exports.getOrdersByIds = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order IDs array is required",
      });
    }

    const orders = await orderService.getOrdersByIds(orderIds);

    res.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error(`❌ [GET ORDERS BY IDS] Error:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Batch complete all processing orders (respects filters)
exports.batchCompleteProcessing = async (req, res) => {
  try {
    const {
      selectedProduct,
      selectedDate,
      sourceFilter,
      phoneNumberFilter,
      orderIdFilter,
      startTime,
      endTime,
    } = req.body;
    const result = await orderService.batchCompleteProcessingOrders({
      selectedProduct,
      selectedDate,
      sourceFilter,
      phoneNumberFilter,
      orderIdFilter,
      startTime,
      endTime,
    });
    res.json({
      success: true,
      message: `Successfully completed ${result.count} processing orders`,
      count: result.count,
    });
  } catch (error) {
    console.error(`❌ [BATCH COMPLETE] Error:`, error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Order tracker data with balance tracking and fraud detection
exports.getOrderTracker = async (req, res) => {
  try {
    const {
      agentId,
      productId,
      startDate,
      endDate,
      startTime,
      endTime,
      limit,
      page,
    } = req.query;
    const result = await getOrderTrackerData({
      agentId,
      productId,
      startDate,
      endDate,
      startTime,
      endTime,
      limit,
      page,
      userId: req.user?.id,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in getOrderTracker:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { orderId, itemId } = req.body;
    const result = await resolveAlert(req.user?.id, orderId, itemId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in resolveAlert:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// Download orders for Excel and update pending to processing
exports.downloadOrdersForExcel = async (req, res) => {
  try {
    const {
      statusFilter,
      selectedProduct,
      selectedDate,
      sortOrder,
      sourceFilter,
      phoneNumberFilter,
      orderIdFilter,
      startTime,
      endTime,
    } = req.query;
    const result = await downloadOrdersForExcel({
      statusFilter,
      selectedProduct,
      selectedDate,
      sortOrder,
      sourceFilter,
      phoneNumberFilter,
      orderIdFilter,
      startTime,
      endTime,
    });
    res.json(result);
  } catch (error) {
    console.error("Error in downloadOrdersForExcel:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.cancelOrderItem = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const orderItemId = parseInt(req.params.itemId);
    const result = await cancelOrderItem(userId, orderItemId);
    // Emit balance update after refund
    await emitBalanceUpdate(userId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// ==================== ORDER BATCH (ORDER FILES) CONTROLLERS ====================

const orderBatchService = require("../services/orderBatchService");
const gmplAutoExportService = require("../services/gmplAutoExportService");
const gmplStatusSyncService = require("../services/gmplStatusSyncService");
const { isGmplNetwork } = require("../utils/gmplNetwork");

exports.getPendingCounts = async (req, res) => {
  try {
    const counts = await orderBatchService.getPendingCountsByNetwork();
    res.json({ success: true, counts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPendingQueue = async (req, res) => {
  try {
    const queue = await orderBatchService.getPendingQueue();
    res.json({ success: true, queue });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportPendingOrders = async (req, res) => {
  try {
    const { network, submitToGmpl } = req.body;
    if (!network)
      return res
        .status(400)
        .json({ success: false, message: "Network is required" });

    const adminUserId = req.user.id;
    const result = await gmplAutoExportService.exportPendingWithGmpl(
      adminUserId,
      network,
      {
        submitToGmpl: submitToGmpl !== false && isGmplNetwork(network),
        maxOrders: gmplAutoExportService.getConfig().maxOrdersPerCycle || 3,
      },
    );
    const {
      batch,
      buffer,
      gmplStatus,
      gmplError,
      gmplResult,
      gmplResponseId,
      batchCount,
      batches,
      submittedCount,
      failedCount,
    } = result;

    const batchIds = (batches || []).map((b) => b.batch?.id).filter(Boolean);
    res.setHeader("X-Batch-Count", String(batchCount || 1));
    res.setHeader(
      "X-Batch-Ids",
      batchIds.length ? batchIds.join(",") : String(batch?.id || ""),
    );

    if (gmplStatus === "submitted") {
      res.setHeader("X-GMPL-Submitted", "true");
      res.setHeader("X-GMPL-Submitted-Count", String(submittedCount || batchCount || 1));
      const gmplBatchId =
        gmplResponseId ||
        (gmplResult && typeof gmplResult === "object"
          ? gmplResult.id || gmplResult.orderId
          : null);
      if (gmplBatchId) {
        res.setHeader("X-GMPL-Batch-Id", String(gmplBatchId));
      }
    } else if (gmplStatus === "partial") {
      res.setHeader("X-GMPL-Submitted", "partial");
      res.setHeader("X-GMPL-Submitted-Count", String(submittedCount || 0));
      res.setHeader("X-GMPL-Failed-Count", String(failedCount || 0));
      if (gmplError) {
        res.setHeader("X-GMPL-Error", encodeURIComponent(gmplError));
      }
    } else if (gmplStatus === "failed") {
      console.error("[exportPendingOrders] GMPL submit failed:", gmplError);
      res.setHeader("X-GMPL-Submitted", "false");
      res.setHeader(
        "X-GMPL-Error",
        encodeURIComponent(gmplError || "GMPL submit failed"),
      );
    } else {
      res.setHeader("X-GMPL-Submitted", "skipped");
    }

    res.setHeader("X-Batch-Id", String(batch?.id || batchIds[0] || ""));
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${batch.filename}`,
    );
    res.send(buffer);
  } catch (error) {
    const status = error.message.includes("No pending") ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

exports.submitBatchToGmpl = async (req, res) => {
  try {
    const result = await gmplAutoExportService.submitExistingBatchToGmpl(
      req.params.batchId,
      { incrementRetry: true },
    );
    res.json(result);
  } catch (error) {
    console.error("[submitBatchToGmpl]", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getGmplAutoExportStatus = async (req, res) => {
  try {
    res.json({
      success: true,
      autoExport: gmplAutoExportService.getAutoExportStatus(),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.handleGmplWebhook = async (req, res) => {
  try {
    if (!gmplStatusSyncService.verifyWebhookSecret(req)) {
      return res.status(401).json({ success: false, message: "Invalid webhook secret" });
    }

    const result = await gmplStatusSyncService.applyFulfillmentUpdate(req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error("[handleGmplWebhook]", error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.syncGmplBatchStatus = async (req, res) => {
  try {
    const batch = await orderBatchService.getBatchById(req.params.batchId);
    if (!isGmplNetwork(batch.network)) {
      return res.status(400).json({
        success: false,
        message: "GMPL status sync applies to MTN batches only.",
      });
    }

    const result = await gmplStatusSyncService.syncBatchFromGmpl({
      id: batch.id,
      gmplResponseId: batch.gmplResponseId,
      gmplStatus: batch.gmplStatus,
      network: batch.network,
      status: batch.status,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.submitAdminGmplFile = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: "orderFile is required (Excel .xlsx).",
      });
    }

    const network =
      req.body.network_provider ||
      req.body.networkProvider ||
      req.body.network;
    if (!network) {
      return res.status(400).json({
        success: false,
        message: "network is required (MTN only for GMPL).",
      });
    }

    if (!isGmplNetwork(network)) {
      return res.status(400).json({
        success: false,
        message: "GMPL manual upload supports MTN orders only.",
      });
    }

    const gmplService = require("../services/gmplService");
    const { networkToGmplProvider } = require("../utils/gmplOrderExport");
    const gmplResult = await gmplService.submitAgentOrderFile(
      filePath,
      networkToGmplProvider(network),
    );

    res.json({
      success: true,
      message: "File submitted to GMPL successfully.",
      gmpl: gmplResult,
    });
  } catch (error) {
    console.error("[submitAdminGmplFile]", error.message);
    res.status(400).json({ success: false, message: error.message });
  } finally {
    if (filePath) {
      try {
        const fs = require("fs");
        fs.unlinkSync(filePath);
      } catch (_) {
        /* ignore */
      }
    }
  }
};

exports.getAllBatches = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await orderBatchService.getAllBatches(
      parseInt(page),
      parseInt(limit),
    );
    res.json({
      success: true,
      batches: result.batches,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await orderBatchService.getBatchById(req.params.batchId);
    res.json({ success: true, batch });
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    const result = await orderBatchService.updateBatchStatus(
      req.params.batchId,
      req.body.status,
    );
    // Emit balance update to all affected users if refund occurred
    if (["Cancelled", "Canceled"].includes(req.body.status)) {
      try {
        const batchItems = await prisma.orderItem.findMany({
          where: { batchId: parseInt(req.params.batchId) },
          include: { order: { select: { userId: true } } },
        });
        const userIds = [
          ...new Set(batchItems.map((i) => i.order?.userId).filter(Boolean)),
        ];
        for (const uid of userIds) await emitBalanceUpdate(uid);
      } catch (e) {
        /* best-effort */
      }
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateBatchOrderItemStatus = async (req, res) => {
  try {
    const result = await orderBatchService.updateBatchOrderItemStatus(
      req.params.batchId,
      req.params.itemId,
      req.body.status,
    );
    // Emit balance update if refund occurred
    if (["Cancelled", "Canceled"].includes(req.body.status)) {
      try {
        const item = await prisma.orderItem.findUnique({
          where: { id: parseInt(req.params.itemId) },
          include: { order: { select: { userId: true } } },
        });
        if (item?.order?.userId) await emitBalanceUpdate(item.order.userId);
      } catch (e) {
        /* best-effort */
      }
    }
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.downloadBatch = async (req, res) => {
  try {
    const { batch, rows } = await orderBatchService.getBatchForDownload(
      req.params.batchId,
    );

    const buffer = buildSupplierExcelBuffer(rows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${batch.filename}`,
    );
    res.send(buffer);
  } catch (error) {
    res.status(404).json({ success: false, message: error.message });
  }
};

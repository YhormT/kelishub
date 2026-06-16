const topupPaymentService = require("../services/topupPaymentService");
const prisma = require("../config/db");
const { verifyPaystackSignature } = require("../utils/paystackWebhook");
const { dashboardPathForRole } = require("../utils/dashboardPaths");
const { emitTopupBalanceUpdate } = require("../utils/topupEvents");

// Helper: emit 'balance-updated' WebSocket event to a specific user after a top-up
// so the frontend wallet refreshes in real-time without requiring logout/login.

// Initialize Paystack payment for wallet top-up
const initializeTopup = async (req, res) => {
  try {
    const amount = req.body.amount;
    const userId = req.user?.id ?? req.body.userId;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: "User ID and amount are required",
      });
    }

    if (parseInt(userId, 10) !== parseInt(req.user.id, 10)) {
      return res.status(403).json({
        success: false,
        message: "Cannot initialize top-up for another user",
      });
    }

    if (parseFloat(amount) < 1) {
      return res.status(400).json({
        success: false,
        message: "Minimum top-up amount is GHS 1",
      });
    }

    const dashPath = dashboardPathForRole(req.user?.role);
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}${dashPath}?topup=callback`;
    const result = await topupPaymentService.initializeTopupPayment(userId, amount, callbackUrl);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error initializing top-up payment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to initialize payment",
    });
  }
};

// Verify Paystack payment and credit wallet
const verifyTopup = async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "Payment reference is required",
      });
    }

    const result = await topupPaymentService.verifyTopupPayment(reference);

    if (result.success) {
      // Push live wallet refresh to the agent so they see the new balance immediately
      if (result.userId || result.topupId) {
        try {
          const topupRow = result.userId ? null : await prisma.topUp.findUnique({ where: { id: result.topupId }, select: { userId: true } });
          const uid = result.userId || topupRow?.userId;
          if (uid) await emitTopupBalanceUpdate(uid, 'TOPUP_PAYSTACK', result.amount || 0);
        } catch (_) { /* best-effort */ }
      }
      res.status(200).json(result);
    } else if (result.pending) {
      res.status(202).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error verifying top-up payment:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to verify payment",
    });
  }
};

// Handle Paystack webhook for top-ups (legacy URL — prefer /api/payment/webhook)
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    if (!verifyPaystackSignature(req.rawBody, signature)) {
      console.error("Invalid Paystack top-up webhook signature");
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }

    const result = await topupPaymentService.handleTopupWebhook(req.body);
    if (result.success && result.userId) {
      await emitTopupBalanceUpdate(result.userId, "TOPUP_PAYSTACK", result.amount || 0);
    }
    res.status(200).json(result);
  } catch (error) {
    console.error("Error handling top-up webhook:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all top-ups (for admin)
const getTopUps = async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const topUps = await topupPaymentService.getAllTopups(startDate, endDate, status);
    res.status(200).json(topUps);
  } catch (error) {
    console.error("Error fetching top-ups:", error);
    res.status(500).json({ success: false, message: "Failed to fetch top-ups" });
  }
};

// Get user's top-up history
const getUserTopups = async (req, res) => {
  try {
    const { userId } = req.params;
    const topUps = await topupPaymentService.getUserTopups(userId);
    res.status(200).json({ success: true, data: topUps });
  } catch (error) {
    console.error("Error fetching user top-ups:", error);
    res.status(500).json({ success: false, message: "Failed to fetch top-ups" });
  }
};

// Delete a top-up record
const deleteTopup = async (req, res) => {
  try {
    const { id } = req.params;
    await topupPaymentService.deleteTopup(id);
    res.status(200).json({ success: true, message: "Top-up deleted successfully" });
  } catch (error) {
    console.error("Error deleting top-up:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to delete top-up" });
  }
};

// Verify top-up using Transaction ID (SMS verification)
const verifyTransactionId = async (req, res) => {
  try {
    const { userId, referenceId } = req.body;

    if (!userId || !referenceId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Transaction ID are required",
      });
    }

    const result = await topupPaymentService.verifyTransactionIdTopup(userId, referenceId);

    // Push live wallet refresh so the agent sees the new balance without logout/login
    if (result && result.success) {
      await emitTopupBalanceUpdate(userId, 'TOPUP_TRANSACTION_ID', result.amount || 0);
    }

    res.status(200).json(result);
  } catch (error) {
    const statusCode =
      error.message.includes("Invalid") ||
      error.message.includes("not found") ||
      error.message.includes("already")
        ? 400
        : 500;

    if (statusCode === 400) {
      console.warn(
        `[Top-up TXN] Rejected userId=${req.body?.userId} ref=${req.body?.referenceId}: ${error.message}`,
      );
    } else {
      console.error(
        `[Top-up TXN] Failed userId=${req.body?.userId}:`,
        error.message,
      );
    }

    res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  initializeTopup,
  verifyTopup,
  handleWebhook,
  getTopUps,
  getUserTopups,
  deleteTopup,
  verifyTransactionId,
};

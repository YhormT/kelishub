const fs = require('fs');
const externalApiService = require('../services/externalApiService');

const emitBalanceUpdate = async (req, agentId) => {
  try {
    const prisma = require('../config/db');
    const { io, userSockets } = require('../index');
    const user = await prisma.user.findUnique({
      where: { id: agentId },
      select: { loanBalance: true, adminLoanBalance: true, hasLoan: true },
    });
    if (user && io && userSockets) {
      const socketId = userSockets.get(String(agentId)) || userSockets.get(agentId);
      if (socketId) {
        io.to(socketId).emit('balance-updated', {
          loanBalance: user.loanBalance,
          adminLoanBalance: user.adminLoanBalance,
          hasLoan: user.hasLoan,
          type: 'ORDER',
        });
      }
    }
  } catch (e) {
    /* best-effort */
  }
};

exports.getProducts = async (req, res) => {
  try {
    const products = await externalApiService.getAvailableProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('External API - getProducts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'items array is required and must not be empty. Each item needs: productId, quantity, mobileNumber',
      });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        return res.status(400).json({
          success: false,
          message: `Item at index ${i} is missing productId`,
        });
      }
      if (!item.quantity || parseInt(item.quantity) < 1) {
        return res.status(400).json({
          success: false,
          message: `Item at index ${i} has invalid quantity`,
        });
      }
      if (!item.mobileNumber) {
        return res.status(400).json({
          success: false,
          message: `Item at index ${i} is missing mobileNumber`,
        });
      }
    }

    const order = await externalApiService.createExternalOrder(req.partner.id, items);
    await emitBalanceUpdate(req, req.partner.agentId);

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('new-order', {
          orderId: order.orderId,
          partner: req.partner.name,
          agentId: req.partner.agentId,
          itemCount: items.length,
        });
      }
    } catch (e) {
      /* best-effort */
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully. Wallet debited.',
      data: order,
    });
  } catch (error) {
    console.error('External API - createOrder error:', error);
    const status = error.message?.includes('Insufficient') ? 402 : 400;
    res.status(status).json({ success: false, message: error.message });
  }
};

exports.createFileOrder = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'orderFile is required (Excel upload).' });
    }

    const networkProvider =
      req.body.network_provider || req.body.networkProvider || req.body.network;

    const order = await externalApiService.createExternalFileOrder(
      req.partner.id,
      filePath,
      networkProvider
    );

    await emitBalanceUpdate(req, req.partner.agentId);

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('new-order', {
          orderId: order.orderId,
          partner: req.partner.name,
          agentId: req.partner.agentId,
          itemCount: order.itemCount,
          source: 'gmpl-file',
        });
      }
    } catch (e) {
      /* best-effort */
    }

    res.status(201).json({
      success: true,
      message: 'Order file submitted. Wallet debited and sent to data provider.',
      data: order,
    });
  } catch (error) {
    console.error('External API - createFileOrder error:', error);
    if (error.validationErrors) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errors: error.validationErrors,
      });
    }
    const status = error.message?.includes('Insufficient') ? 402 : 400;
    res.status(status).json({ success: false, message: error.message });
  } finally {
    if (filePath) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        /* ignore */
      }
    }
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await externalApiService.getExternalOrderStatus(orderId, req.partner.id);
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('External API - getOrderStatus error:', error);
    res.status(404).json({ success: false, message: error.message });
  }
};

exports.getOrderStatuses = async (req, res) => {
  try {
    const { orderIds } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'orderIds array is required',
      });
    }

    if (orderIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 50 order IDs per request',
      });
    }

    const orders = await externalApiService.getExternalOrderStatuses(orderIds, req.partner.id);
    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('External API - getOrderStatuses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createApiKey = async (req, res) => {
  try {
    const { partnerName, agentId } = req.body;

    if (!partnerName || partnerName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'partnerName is required',
      });
    }

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'agentId is required — select the agent this key belongs to',
      });
    }

    const result = await externalApiService.createApiKey(partnerName.trim(), agentId);

    res.status(201).json({
      success: true,
      message: `API key created for agent ${result.agentName}. Share this key once — orders debit their wallet.`,
      data: result,
    });
  } catch (error) {
    console.error('External API - createApiKey error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.listAgents = async (req, res) => {
  try {
    const agents = await externalApiService.listAgentsForApiKeys();
    res.json({ success: true, data: agents });
  } catch (error) {
    console.error('External API - listAgents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listApiKeys = async (req, res) => {
  try {
    const keys = await externalApiService.listApiKeys();
    res.json({ success: true, data: keys });
  } catch (error) {
    console.error('External API - listApiKeys error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    await externalApiService.revokeApiKey(id);
    res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('External API - revokeApiKey error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.activateApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    await externalApiService.activateApiKey(id);
    res.json({ success: true, message: 'API key reactivated' });
  } catch (error) {
    console.error('External API - activateApiKey error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteApiKey = async (req, res) => {
  try {
    const { id } = req.params;
    await externalApiService.deleteApiKey(id);
    res.json({ success: true, message: 'API key deleted permanently' });
  } catch (error) {
    console.error('External API - deleteApiKey error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

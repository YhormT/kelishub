const prisma = require('../config/db');
const crypto = require('crypto');
const xlsx = require('xlsx');
const fs = require('fs');
const { createTransaction } = require('./transactionService');
const productService = require('./productService');
const { parseSimplifiedExcelRows } = require('./orderExcelParser');
const { isGmplNetwork } = require('../utils/gmplNetwork');
const { summarizeOrderItems } = require('../utils/orderEvents');

const generateApiKey = () => {
  return 'klh_' + crypto.randomBytes(32).toString('hex');
};

const getAgentForKey = async (keyRecord, tx = prisma) => {
  if (!keyRecord?.agentId) {
    throw new Error('API key is not linked to an agent. Create a new key and select an agent.');
  }
  const agent = await tx.user.findUnique({ where: { id: keyRecord.agentId } });
  if (!agent) {
    throw new Error('Linked agent account no longer exists.');
  }
  if (agent.isSuspended) {
    throw new Error('Agent account is suspended.');
  }
  const role = agent.role?.toUpperCase();
  if (role === 'ADMIN' || role === 'EXTERNAL_PARTNER') {
    throw new Error('API keys can only be linked to agent accounts.');
  }
  return agent;
};

const createApiKey = async (partnerName, agentId) => {
  const parsedAgentId = parseInt(agentId, 10);
  if (!partnerName?.trim()) {
    throw new Error('partnerName is required');
  }
  if (!parsedAgentId || Number.isNaN(parsedAgentId)) {
    throw new Error('agentId is required — select an agent for this API key');
  }

  const agent = await prisma.user.findUnique({ where: { id: parsedAgentId } });
  if (!agent) {
    throw new Error('Agent not found');
  }
  await getAgentForKey({ agentId: parsedAgentId });

  const existing = await prisma.externalApiKey.findFirst({
    where: { agentId: parsedAgentId, isActive: true },
  });
  if (existing) {
    throw new Error(
      `Agent "${agent.name}" already has an active API key (${existing.partnerName}). Revoke it first or choose another agent.`
    );
  }

  const apiKey = generateApiKey();
  const record = await prisma.externalApiKey.create({
    data: {
      partnerName: partnerName.trim(),
      apiKey,
      agentId: parsedAgentId,
    },
    include: {
      agent: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    id: record.id,
    partnerName: record.partnerName,
    apiKey: record.apiKey,
    agentId: record.agentId,
    agentName: record.agent?.name,
    createdAt: record.createdAt,
  };
};

const listApiKeys = async () => {
  const keys = await prisma.externalApiKey.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      agent: { select: { id: true, name: true, email: true, loanBalance: true, role: true } },
    },
  });

  return keys.map((k) => ({
    id: k.id,
    partnerName: k.partnerName,
    agentId: k.agentId,
    agentName: k.agent?.name || null,
    agentEmail: k.agent?.email || null,
    agentBalance: k.agent?.loanBalance ?? null,
    agentRole: k.agent?.role || null,
    apiKeyPreview: k.apiKey.substring(0, 12) + '...',
    isActive: k.isActive,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    totalOrders: k.totalOrders,
  }));
};

const listAgentsForApiKeys = async () => {
  const users = await prisma.user.findMany({
    where: { isSuspended: false },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      loanBalance: true,
      phone: true,
    },
    orderBy: { name: 'asc' },
  });
  return users.filter((u) => {
    const role = u.role?.toUpperCase();
    return role !== 'ADMIN' && role !== 'EXTERNAL_PARTNER';
  });
};

const revokeApiKey = async (id) => {
  return await prisma.externalApiKey.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });
};

const activateApiKey = async (id) => {
  return await prisma.externalApiKey.update({
    where: { id: parseInt(id) },
    data: { isActive: true },
  });
};

const deleteApiKey = async (id) => {
  return await prisma.externalApiKey.delete({
    where: { id: parseInt(id) },
  });
};

const getAvailableProducts = async () => {
  const products = await prisma.product.findMany({
    where: { showForAgents: true },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      promoPrice: true,
      usePromoPrice: true,
      stock: true,
    },
    orderBy: { name: 'asc' },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.usePromoPrice && p.promoPrice != null ? p.promoPrice : p.price,
    stock: p.stock,
  }));
};

const createExternalOrder = async (partnerId, items) => {
  return await prisma.$transaction(
    async (tx) => {
      const keyRecord = await tx.externalApiKey.findUnique({ where: { id: partnerId } });
      const agent = await getAgentForKey(keyRecord, tx);

      const productIds = items.map((i) => parseInt(i.productId));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = {};
      for (const p of products) {
        productMap[p.id] = p;
      }

      const orderItems = [];
      let totalPrice = 0;

      for (const item of items) {
        const product = productMap[parseInt(item.productId)];
        if (!product) {
          throw new Error(`Product with ID ${item.productId} not found`);
        }

        const effectivePrice =
          productService.getPriceForUserRole(agent.role, product) ??
          (product.usePromoPrice && product.promoPrice != null ? product.promoPrice : product.price);

        const quantity = parseInt(item.quantity) || 1;
        totalPrice += effectivePrice * quantity;

        orderItems.push({
          productId: product.id,
          quantity,
          mobileNumber: item.mobileNumber || null,
          status: 'Pending',
          productName: product.name,
          productPrice: effectivePrice,
          productDescription: product.description,
        });
      }

      if (agent.loanBalance < totalPrice) {
        throw new Error(
          `Insufficient wallet balance. Required: GHS ${totalPrice.toFixed(2)}, available: GHS ${agent.loanBalance.toFixed(2)}`
        );
      }

      const order = await tx.order.create({
        data: {
          userId: agent.id,
          mobileNumber: items[0]?.mobileNumber || null,
          status: 'Pending',
          items: { create: orderItems },
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, description: true, price: true },
              },
            },
          },
        },
      });

      await createTransaction(
        agent.id,
        -totalPrice,
        'ORDER',
        `External API order #${order.id} (${keyRecord.partnerName})`,
        `order:${order.id}`,
        tx
      );

      await tx.externalApiKey.update({
        where: { id: partnerId },
        data: { totalOrders: { increment: 1 } },
      });

      return {
        orderId: order.id,
        agentId: agent.id,
        agentName: agent.name,
        status: order.status,
        totalPrice,
        walletBalanceAfter: agent.loanBalance - totalPrice,
        networks: summarizeOrderItems(order.items),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.productPrice,
          mobileNumber: item.mobileNumber,
          status: item.status,
        })),
        createdAt: order.createdAt,
      };
    },
    { timeout: 15000 }
  );
};

const createExternalFileOrder = async (partnerId, filePath, networkProvider) => {
  const keyRecord = await prisma.externalApiKey.findUnique({ where: { id: partnerId } });
  const agent = await getAgentForKey(keyRecord);

  let data = [];
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } catch (err) {
    throw new Error('Failed to parse Excel file.');
  }

  if (!data.length) {
    throw new Error('Excel file is empty.');
  }

  const network = String(networkProvider || '').trim();
  if (!network) {
    throw new Error('network_provider is required (e.g. mtn, telecel, airteltigo)');
  }

  const { productsToAdd, errorReport, totalCost } = await parseSimplifiedExcelRows(
    data,
    network,
    agent.role,
    prisma
  );

  if (errorReport.length > 0) {
    const err = new Error('Validation errors in order file');
    err.validationErrors = errorReport;
    throw err;
  }

  if (productsToAdd.length === 0) {
    throw new Error('No valid order rows found in file.');
  }

  if (agent.loanBalance < totalCost) {
    throw new Error(
      `Insufficient wallet balance. Required: GHS ${totalCost.toFixed(2)}, available: GHS ${agent.loanBalance.toFixed(2)}`
    );
  }

  if (!isGmplNetwork(network)) {
    throw new Error(
      'GMPL file orders are only supported for MTN (network_provider=mtn).'
    );
  }

  let gmplResult = null;
  try {
    const { submitRowsToGmpl } = require('../utils/gmplOrderExport');
    const crypto = require('crypto');
    const rows = productsToAdd.map((item) => ({
      phone: item.phoneNumber,
      bundle: item.product.description || item.product.name,
    }));
    gmplResult = await submitRowsToGmpl(rows, network, {
      idempotencyKey: `kellishub-ext-${partnerId}-${crypto.randomUUID()}`,
    });
  } catch (gmplErr) {
    throw new Error(gmplErr.message || 'Failed to submit order to data provider');
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const freshAgent = await tx.user.findUnique({ where: { id: agent.id } });
        if (freshAgent.loanBalance < totalCost) {
          throw new Error(
            `Insufficient wallet balance. Required: GHS ${totalCost.toFixed(2)}, available: GHS ${freshAgent.loanBalance.toFixed(2)}`
          );
        }

        const order = await tx.order.create({
          data: {
            userId: agent.id,
            mobileNumber: productsToAdd[0]?.phoneNumber || null,
            status: 'Pending',
            items: {
              create: productsToAdd.map((item) => ({
                productId: item.product.id,
                quantity: item.quantity,
                mobileNumber: item.phoneNumber,
                status: 'Pending',
                productName: item.product.name,
                productPrice: item.unitPrice,
                productDescription: item.product.description,
              })),
            },
          },
          include: { items: true },
        });

        await createTransaction(
          agent.id,
          -totalCost,
          'ORDER',
          `External API file order #${order.id} via GMPL (${network})`,
          `order:${order.id}`,
          tx
        );

        await tx.externalApiKey.update({
          where: { id: partnerId },
          data: { totalOrders: { increment: 1 } },
        });

        return {
          orderId: order.id,
          agentId: agent.id,
          agentName: agent.name,
          status: order.status,
          totalPrice: totalCost,
          itemCount: order.items.length,
          networks: summarizeOrderItems(order.items),
          networkProvider: network.toLowerCase(),
          gmpl: gmplResult,
          walletBalanceAfter: freshAgent.loanBalance - totalCost,
          createdAt: order.createdAt,
        };
      },
      { timeout: 15000 }
    );

    return result;
  } catch (localErr) {
    console.error(
      'Local order record failed after GMPL submission — manual reconciliation may be required:',
      localErr.message
    );
    throw new Error(
      `Order was sent to the data provider but wallet recording failed: ${localErr.message}. Contact support.`
    );
  }
};

const getExternalOrderStatus = async (orderId, partnerId) => {
  const keyRecord = await prisma.externalApiKey.findUnique({ where: { id: partnerId } });
  if (!keyRecord?.agentId) {
    throw new Error('API key is not linked to an agent');
  }

  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          productPrice: true,
          mobileNumber: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error('Order not found');
  }

  if (order.userId !== keyRecord.agentId) {
    throw new Error('Order not found');
  }

  return {
    orderId: order.id,
    status: order.status,
    items: order.items,
    createdAt: order.createdAt,
  };
};

const getExternalOrderStatuses = async (orderIds, partnerId) => {
  const keyRecord = await prisma.externalApiKey.findUnique({ where: { id: partnerId } });
  if (!keyRecord?.agentId) {
    throw new Error('API key is not linked to an agent');
  }

  const ids = orderIds.map((id) => parseInt(id));
  const orders = await prisma.order.findMany({
    where: { id: { in: ids }, userId: keyRecord.agentId },
    include: {
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          productPrice: true,
          mobileNumber: true,
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    orderId: order.id,
    status: order.status,
    items: order.items,
    createdAt: order.createdAt,
  }));
};

module.exports = {
  generateApiKey,
  createApiKey,
  listApiKeys,
  listAgentsForApiKeys,
  revokeApiKey,
  activateApiKey,
  deleteApiKey,
  getAvailableProducts,
  createExternalOrder,
  createExternalFileOrder,
  getExternalOrderStatus,
  getExternalOrderStatuses,
};

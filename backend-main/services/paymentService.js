const axios = require('axios');
const prisma = require('../config/db');
const { amountsMatch, paystackAmountToGhs } = require('../utils/productPricing');

// Paystack API URLs
const PAYSTACK_INITIALIZE_URL = 'https://api.paystack.co/transaction/initialize';
const PAYSTACK_VERIFY_URL = 'https://api.paystack.co/transaction/verify';

// Generate unique external reference
const generateExternalRef = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `kellishub-${timestamp}-${random}`;
};

// Initialize Paystack transaction and get payment URL
const initializePayment = async (email, mobileNumber, amount, productId, productName, callbackUrl) => {
  const externalRef = generateExternalRef();
  
  // Format phone number
  let formattedPhone = mobileNumber.replace(/\D/g, '');
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '233' + formattedPhone.substring(1);
  } else if (!formattedPhone.startsWith('233')) {
    formattedPhone = '233' + formattedPhone;
  }

  // Create payment transaction record
  const paymentTransaction = await prisma.paymentTransaction.create({
    data: {
      externalRef,
      mobileNumber: formattedPhone,
      amount: parseFloat(amount),
      currency: 'GHS',
      channel: 'PAYSTACK',
      status: 'PENDING',
      productId: productId ? parseInt(productId) : null,
      productName
    }
  });

  try {
    console.log('Initializing Paystack Payment...');
    
    // Paystack amount is in pesewas (kobo equivalent), so multiply by 100
    const amountInPesewas = Math.round(parseFloat(amount) * 100);

    const response = await axios({
      method: 'POST',
      url: PAYSTACK_INITIALIZE_URL,
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      data: {
        email: email || `${formattedPhone}@kellishub.com`,
        amount: amountInPesewas,
        currency: 'GHS',
        reference: externalRef,
        callback_url: callbackUrl || process.env.PAYSTACK_CALLBACK_URL,
        metadata: {
          productId: productId,
          productName: productName,
          mobileNumber: formattedPhone,
          custom_fields: [
            {
              display_name: "Mobile Number",
              variable_name: "mobile_number",
              value: formattedPhone
            },
            {
              display_name: "Product",
              variable_name: "product_name",
              value: productName
            }
          ]
        },
        channels: ['mobile_money', 'card']
      },
      timeout: 30000
    });

    console.log('Paystack Initialize Response:', response.data);

    if (response.data.status === true) {
      const paymentUrl = response.data.data.authorization_url;
      const accessCode = response.data.data.access_code;
      const paystackRef = response.data.data.reference;

      // Update transaction with Paystack response
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          moolreCode: accessCode,
          moolreMessage: 'Payment initialized',
          moolreSessionId: paystackRef,
          status: 'INITIALIZED'
        }
      });

      return {
        success: true,
        transactionId: paymentTransaction.id,
        externalRef,
        paymentUrl: paymentUrl,
        accessCode: accessCode,
        reference: paystackRef,
        message: 'Payment initialized successfully'
      };
    } else {
      await prisma.paymentTransaction.update({
        where: { id: paymentTransaction.id },
        data: {
          status: 'FAILED',
          moolreMessage: response.data.message || 'Failed to initialize payment'
        }
      });

      return {
        success: false,
        transactionId: paymentTransaction.id,
        externalRef,
        error: response.data.message || 'Failed to initialize payment'
      };
    }

  } catch (error) {
    console.error('Paystack Initialize Error:', error.response?.data || error.message);
    
    await prisma.paymentTransaction.update({
      where: { id: paymentTransaction.id },
      data: {
        status: 'FAILED',
        moolreMessage: error.response?.data?.message || error.message
      }
    });

    return {
      success: false,
      transactionId: paymentTransaction.id,
      externalRef,
      error: error.response?.data?.message || error.message
    };
  }
};

// Verify payment with Paystack API
const verifyPayment = async (reference) => {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef: reference }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  try {
    console.log('Verifying Paystack Payment:', reference);
    
    const response = await axios({
      method: 'GET',
      url: `${PAYSTACK_VERIFY_URL}/${reference}`,
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('Paystack Verify Response:', response.data);

    const paymentData = response.data.data;
    const paymentStatus = paymentData?.status;
    
    // Paystack status: success, failed, abandoned
    const isSuccess = paymentStatus === 'success';
    const isPending = paymentStatus === 'pending' || paymentStatus === 'ongoing';
    const isFailed = paymentStatus === 'failed' || paymentStatus === 'abandoned';

    const paidAmountGhs = paystackAmountToGhs(paymentData?.amount);
    const amountMismatch =
      isSuccess &&
      paidAmountGhs != null &&
      !amountsMatch(transaction.amount, paidAmountGhs);

    let status = transaction.status;
    if (amountMismatch) {
      status = 'FAILED';
      console.error(
        `[verifyPayment] Amount mismatch for ${reference}: expected GHS ${transaction.amount}, got GHS ${paidAmountGhs}`,
      );
    } else if (isSuccess) {
      status = 'SUCCESS';
    } else if (isFailed) {
      status = 'FAILED';
    }

    // Update transaction
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: status,
        moolreCode: paymentData?.gateway_response || paymentStatus,
        moolreMessage: amountMismatch
          ? `Amount mismatch: expected GHS ${transaction.amount}, paid GHS ${paidAmountGhs}`
          : paymentData?.message || `Payment ${paymentStatus}`
      }
    });

    return {
      success: isSuccess && !amountMismatch,
      pending: isPending,
      transactionId: transaction.id,
      externalRef: reference,
      status: status,
      amount: paidAmountGhs ?? transaction.amount,
      paystackResponse: response.data
    };

  } catch (error) {
    console.error('Paystack Verify Error:', error.response?.data || error.message);
    return {
      success: false,
      pending: true,
      transactionId: transaction.id,
      externalRef: reference,
      error: error.response?.data?.message || error.message
    };
  }
};

// Handle Paystack webhook callback
const handleWebhook = async (webhookData) => {
  console.log('Paystack Webhook Received:', webhookData);
  
  // Paystack webhook event structure
  const event = webhookData.event;
  const data = webhookData.data;
  
  if (!data || !data.reference) {
    console.error('Webhook missing reference');
    return { success: false, error: 'Missing reference' };
  }

  const externalRef = data.reference;

  // Find the transaction
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef }
  });

  if (!transaction) {
    console.error('Transaction not found for webhook:', externalRef);
    return { success: false, error: 'Transaction not found' };
  }

  // Determine status from webhook event
  // charge.success = payment successful
  const chargeSucceeded = event === 'charge.success' && data.status === 'success';
  const isFailed = event === 'charge.failed' || data.status === 'failed';

  // Reject underpayments: the amount Paystack received must match what we charged.
  const paidAmountGhs = paystackAmountToGhs(data.amount);
  const amountMismatch =
    chargeSucceeded &&
    paidAmountGhs != null &&
    !amountsMatch(transaction.amount, paidAmountGhs);

  const isSuccess = chargeSucceeded && !amountMismatch;

  let newStatus = transaction.status;
  if (amountMismatch) {
    newStatus = 'FAILED';
    console.error(
      `[handleWebhook] Amount mismatch for ${externalRef}: expected GHS ${transaction.amount}, paid GHS ${paidAmountGhs}`,
    );
  } else if (isSuccess) {
    newStatus = 'SUCCESS';
  } else if (isFailed) {
    newStatus = 'FAILED';
  }

  // Update transaction
  await prisma.paymentTransaction.update({
    where: { id: transaction.id },
    data: {
      status: newStatus,
      moolreSessionId: data.id?.toString() || transaction.moolreSessionId,
      moolreMessage: amountMismatch
        ? `Amount mismatch: expected GHS ${transaction.amount}, paid GHS ${paidAmountGhs}`
        : data.gateway_response || transaction.moolreMessage
    }
  });

  return {
    success: isSuccess,
    transactionId: transaction.id,
    externalRef,
    productId: transaction.productId,
    productName: transaction.productName,
    mobileNumber: transaction.mobileNumber,
    amount: transaction.amount,
    status: newStatus
  };
};

// Check payment status
const checkPaymentStatus = async (externalRef) => {
  const transaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef }
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return {
    transactionId: transaction.id,
    externalRef: transaction.externalRef,
    status: transaction.status,
    amount: transaction.amount,
    mobileNumber: transaction.mobileNumber,
    productId: transaction.productId,
    productName: transaction.productName,
    orderId: transaction.orderId,
    createdAt: transaction.createdAt
  };
};

// Get all payment transactions (for admin)
const getAllPaymentTransactions = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  
  const [transactions, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.paymentTransaction.count()
  ]);

  return {
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

// Update transaction with order ID after successful order creation
const linkTransactionToOrder = async (externalRef, orderId) => {
  return await prisma.paymentTransaction.update({
    where: { externalRef },
    data: { orderId }
  });
};

// Payments that succeeded (or likely succeeded) on Paystack but have no linked order yet.
// Manual reconcile may pass includeFailedRetries to retry rows previously marked
// "Order creation failed" (e.g. after a deploy fix or transient DB error).
const getOrphanedSuccessfulPayments = async ({
  includeFailedRetries = false,
  limit = 50,
} = {}) => {
  const staleCutoff = new Date(Date.now() - 90 * 1000);

  const successBranch = includeFailedRetries
    ? { status: 'SUCCESS' }
    : {
        status: 'SUCCESS',
        OR: [
          { moolreMessage: null },
          { moolreMessage: { equals: '' } },
          { moolreMessage: { not: { startsWith: 'Order creation failed' } } },
        ],
      };

  return await prisma.paymentTransaction.findMany({
    where: {
      orderId: null,
      productId: { not: null },
      OR: [
        successBranch,
        {
          status: { in: ['INITIALIZED', 'PENDING'] },
          createdAt: { lte: staleCutoff },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(1, limit), 200),
  });
};

// Mark transaction as having order creation attempted
const markOrderCreationAttempted = async (transactionId, success, errorMessage = null) => {
  return await prisma.paymentTransaction.update({
    where: { id: transactionId },
    data: {
      moolreMessage: success 
        ? 'Order created successfully' 
        : `Order creation failed: ${errorMessage || 'Unknown error'}`
    }
  });
};

// Verify payment directly with Paystack and create order if successful
const verifyAndCreateOrder = async (reference, shopService) => {
  console.log('[Payment Reconciliation] Processing reference:', reference);
  
  // First check if transaction exists and already has an order
  const existingTransaction = await prisma.paymentTransaction.findUnique({
    where: { externalRef: reference }
  });

  if (!existingTransaction) {
    return { success: false, error: 'Transaction not found' };
  }

  if (existingTransaction.orderId) {
    return { success: true, message: 'Order already exists', orderId: existingTransaction.orderId };
  }

  // Verify with Paystack
  try {
    const response = await axios({
      method: 'GET',
      url: `${PAYSTACK_VERIFY_URL}/${reference}`,
      headers: {
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const paymentData = response.data.data;
    const isSuccess = paymentData?.status === 'success';
    const paidAmountGhs = paystackAmountToGhs(paymentData?.amount);
    const amountMismatch =
      isSuccess &&
      paidAmountGhs != null &&
      !amountsMatch(existingTransaction.amount, paidAmountGhs);

    if (amountMismatch) {
      await prisma.paymentTransaction.update({
        where: { id: existingTransaction.id },
        data: {
          status: 'FAILED',
          moolreMessage: `Amount mismatch: expected GHS ${existingTransaction.amount}, paid GHS ${paidAmountGhs}`,
        },
      });
      return { success: false, error: 'Payment amount mismatch' };
    }

    if (!isSuccess) {
      // Update transaction status
      await prisma.paymentTransaction.update({
        where: { id: existingTransaction.id },
        data: { status: paymentData?.status === 'failed' ? 'FAILED' : existingTransaction.status }
      });
      return { success: false, error: 'Payment not successful', status: paymentData?.status };
    }

    // Payment is successful - update status and create order
    await prisma.paymentTransaction.update({
      where: { id: existingTransaction.id },
      data: { status: 'SUCCESS' }
    });

    // Create order through the SAME atomic, idempotent path used by the
    // webhook and verify endpoints. This guarantees one charge → one order,
    // even if reconciliation races with an in-flight webhook/verify.
    if (existingTransaction.productId && existingTransaction.mobileNumber) {
      try {
        const orderResult = await shopService.createShopOrderForTransaction(
          reference,
          existingTransaction.productId,
          existingTransaction.mobileNumber
        );

        if (orderResult.created) {
          console.log('[Payment Reconciliation] Order created:', orderResult.orderId);
          return {
            success: true,
            message: 'Payment verified and order created',
            orderId: orderResult.orderId,
            mobileNumber: existingTransaction.mobileNumber
          };
        }

        if (orderResult.alreadyExists) {
          return {
            success: true,
            message: 'Order already exists',
            orderId: orderResult.orderId,
            mobileNumber: existingTransaction.mobileNumber
          };
        }

        await markOrderCreationAttempted(existingTransaction.id, false, orderResult.error);
        return { success: false, error: orderResult.error || 'Order creation failed' };
      } catch (orderError) {
        console.error('[Payment Reconciliation] Order creation failed:', orderError);
        await markOrderCreationAttempted(existingTransaction.id, false, orderError.message);
        return { success: false, error: 'Order creation failed', details: orderError.message };
      }
    } else {
      return { success: false, error: 'Missing product or mobile number' };
    }

  } catch (error) {
    console.error('[Payment Reconciliation] Verification error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  initializePayment,
  verifyPayment,
  handleWebhook,
  checkPaymentStatus,
  getAllPaymentTransactions,
  linkTransactionToOrder,
  getOrphanedSuccessfulPayments,
  verifyAndCreateOrder
};

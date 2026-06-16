const prisma = require("../config/db");

class SmsService {
  // Parse SMS message to extract reference and amount
  parseSmsMessage(message) {
    const text = String(message || '');

    const amountPatterns = [
      /Payment received for GHS\s*([\d,]+\.?\d*)/i,
      /You have received GHS\s*([\d,]+\.?\d*)/i,
      /received(?:\s+an amount of)?\s+GHS\s*([\d,]+\.?\d*)/i,
      /(?:GH¢|GHc)\s*([\d,]+\.?\d*)/i,
    ];

    const transactionIdPatterns = [
      /Transaction\s*(?:ID|Id|id|No\.?|#)?\s*:?\s*(\d{8,15})/i,
      /Txn\s*(?:ID|Id|id|No\.?)?\s*:?\s*(\d{8,15})/i,
      /Trans(?:action)?\s*(?:ID|Id|id|No\.?)?\s*:?\s*(\d{8,15})/i,
    ];

    let amount = null;
    for (const pattern of amountPatterns) {
      const match = text.match(pattern);
      if (match) {
        amount = parseFloat(match[1].replace(/,/g, ''));
        if (!Number.isNaN(amount)) break;
        amount = null;
      }
    }

    let reference = null;
    for (const pattern of transactionIdPatterns) {
      const match = text.match(pattern);
      if (match) {
        reference = match[1];
        break;
      }
    }

    return { amount, reference };
  }

  // Save SMS message to database
  async saveSmsMessage(phoneNumber, message) {
    try {
      const parsedData = this.parseSmsMessage(message);

      const isPaymentSms =
        /payment received|you have received/i.test(String(message || ''));

      if (isPaymentSms && (!parsedData.reference || !parsedData.amount)) {
        console.warn(
          '[SMS] Payment SMS saved with missing parsed fields:',
          JSON.stringify({
            reference: parsedData.reference,
            amount: parsedData.amount,
            preview: String(message).slice(0, 160),
          }),
        );
      }

      const smsRecord = await prisma.smsMessage.create({
        data: {
          phoneNumber: phoneNumber,
          message: message,
          reference: parsedData.reference,
          amount: parsedData.amount,
          isProcessed: false
        }
      });

      return smsRecord;
    } catch (error) {
      console.error("Error saving SMS:", error);
      throw new Error(`Failed to save SMS: ${error.message}`);
    }
  }

  // Get unprocessed SMS messages
  async getUnprocessedSms() {
    try {
      return await prisma.smsMessage.findMany({
        where: { isProcessed: false },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error("Error fetching SMS:", error);
      throw new Error(`Failed to fetch SMS messages: ${error.message}`);
    }
  }
  
  // Find SMS by reference
  async findSmsByReference(reference) {
    try {
      // Normalize: trim whitespace and remove non-alphanumeric chars
      const cleanRef = String(reference).trim().replace(/[^a-zA-Z0-9]/g, '');
      
      if (!cleanRef) return null;

      // 1. Try exact match first
      let sms = await prisma.smsMessage.findFirst({
        where: {
          reference: cleanRef,
          isProcessed: false
        },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      // 2. Try contains match (handles partial reference in DB)
      sms = await prisma.smsMessage.findFirst({
        where: {
          reference: { contains: cleanRef },
          isProcessed: false
        },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      // 3. Try searching the raw message text (amount required for credit)
      sms = await prisma.smsMessage.findFirst({
        where: {
          message: { contains: cleanRef },
          isProcessed: false,
          amount: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      // 4. Message contains ref but amount failed to parse at ingest — recover at verify time
      sms = await prisma.smsMessage.findFirst({
        where: {
          message: { contains: cleanRef },
          isProcessed: false,
        },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      return null;
    } catch (error) {
      console.error("Error finding SMS by reference:", error);
      throw new Error(`Failed to find SMS by reference: ${error.message}`);
    }
  }
  
  // Find SMS by reference regardless of processed status
  async findSmsByReferenceAny(reference) {
    try {
      const cleanRef = String(reference).trim().replace(/[^a-zA-Z0-9]/g, '');
      if (!cleanRef) return null;

      // 1. Try exact match first
      let sms = await prisma.smsMessage.findFirst({
        where: { reference: cleanRef },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      // 2. Try contains match
      sms = await prisma.smsMessage.findFirst({
        where: { reference: { contains: cleanRef } },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      // 3. Try searching the raw message text
      sms = await prisma.smsMessage.findFirst({
        where: {
          message: { contains: cleanRef },
          amount: { not: null }
        },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      // 4. Message contains ref even if amount was not parsed at ingest
      sms = await prisma.smsMessage.findFirst({
        where: { message: { contains: cleanRef } },
        orderBy: { createdAt: 'desc' }
      });
      if (sms) return sms;

      return null;
    } catch (error) {
      console.error("Error finding SMS by reference (any):", error);
      throw new Error(`Failed to find SMS by reference: ${error.message}`);
    }
  }

  // Mark SMS as processed
  async markSmsAsProcessed(smsId, prismaTx = null) {
    const prismaClient = prismaTx || prisma;
    try {
      return await prismaClient.smsMessage.update({
        where: { id: smsId },
        data: { isProcessed: true },
      });
    } catch (error) {
      console.error("Error marking SMS as processed:", error);
      throw new Error(`Failed to mark SMS as processed: ${error.message}`);
    }
  }

  // Get payment received messages (updated to handle both formats)
  async getPaymentReceivedMessages(page = 1, limit = 50, search = null) {
    try {
      const where = {
        OR: [
          { message: { contains: "Payment received" } },
          { message: { contains: "You have received" } }
        ]
      };

      if (search) {
        where.AND = [
          {
            OR: [
              { phoneNumber: { contains: search } },
              { message: { contains: search } },
              { reference: { contains: search } }
            ]
          }
        ];
      }

      const skip = (page - 1) * limit;

      const [totalCount, messages] = await Promise.all([
        prisma.smsMessage.count({ where }),
        prisma.smsMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        })
      ]);

      return {
        data: messages,
        pagination: {
          page, limit, total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      console.error("Error fetching payment messages:", error);
      throw new Error(`Failed to fetch payment messages: ${error.message}`);
    }
  }
}

module.exports = new SmsService();
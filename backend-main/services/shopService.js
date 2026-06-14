const prisma = require("../config/db");

// Get or create the "shop" user for guest orders
const getOrCreateShopUser = async () => {
  const shopEmail = "shop@kellishub.com";
  
  let shopUser = await prisma.user.findUnique({
    where: { email: shopEmail }
  });
  
  if (!shopUser) {
    // Create the shop user if it doesn't exist
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("shop_user_password_secure_123", 10);
    
    shopUser = await prisma.user.create({
      data: {
        name: "Shop",
        email: shopEmail,
        password: hashedPassword,
        role: "SHOP",
        loanBalance: 999999999, // High balance for shop orders
        hasLoan: false
      }
    });
  }
  
  return shopUser;
};

// Create a shop order (for guest users)
const createShopOrder = async (productId, mobileNumber, customerName) => {
  // Get the shop user
  const shopUser = await getOrCreateShopUser();
  
  // Get the product
  const product = await prisma.product.findUnique({
    where: { id: productId }
  });
  
  if (!product) {
    throw new Error("Product not found");
  }
  
  if (!product.showInShop) {
    throw new Error("Product is not available in shop");
  }
  
  // Create the order
  const order = await prisma.order.create({
    data: {
      userId: shopUser.id,
      mobileNumber: mobileNumber,
      status: "Pending",
      items: {
        create: [{
          productId: productId,
          quantity: 1,
          mobileNumber: mobileNumber,
          status: "Pending",
          productName: product.name,
          productPrice: (product.usePromoPrice && product.promoPrice != null) ? product.promoPrice : product.price,
          productDescription: product.description
        }]
      }
    },
    include: {
      items: {
        include: { product: true }
      },
      user: true
    }
  });
  
  return order;
};

// Atomic, idempotent order creation keyed on a payment transaction's externalRef.
// Used by ALL paid-shop paths (webhook, verify, reconciliation) so a single
// Paystack charge can never produce more than one order.
const createShopOrderForTransaction = async (externalRef, productId, mobileNumber) => {
  const shopUser = await getOrCreateShopUser();

  return await prisma.$transaction(
    async (tx) => {
      const transaction = await tx.paymentTransaction.findUnique({
        where: { externalRef },
      });

      if (!transaction) {
        return { created: false, error: "Transaction not found" };
      }

      // Already linked → return the existing order (idempotent)
      if (transaction.orderId) {
        const existingOrder = await tx.order.findUnique({
          where: { id: transaction.orderId },
          include: { items: true },
        });

        if (existingOrder) {
          return {
            created: false,
            alreadyExists: true,
            orderId: transaction.orderId,
            order: existingOrder,
          };
        }

        // Stale reference (order was deleted) — clear and recreate
        await tx.paymentTransaction.update({
          where: { externalRef },
          data: { orderId: null },
        });
      }

      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        return { created: false, error: "Product not found" };
      }

      const order = await tx.order.create({
        data: {
          userId: shopUser.id,
          mobileNumber,
          status: "Pending",
          items: {
            create: [
              {
                productId,
                quantity: 1,
                mobileNumber,
                status: "Pending",
                productName: product.name,
                productPrice:
                  product.usePromoPrice && product.promoPrice != null
                    ? product.promoPrice
                    : product.price,
                productDescription: product.description,
              },
            ],
          },
        },
        include: { items: true },
      });

      // Link transaction → order in the SAME transaction (closes the race window)
      await tx.paymentTransaction.update({
        where: { externalRef },
        data: { orderId: order.id },
      });

      return { created: true, orderId: order.id, order };
    },
    { timeout: 15000 },
  );
};

// Track orders by mobile number
const trackOrdersByMobile = async (mobileNumber) => {
  // Clean and generate phone number variants for comprehensive search
  const cleanedNumber = mobileNumber.replace(/\D/g, '');
  const phoneVariants = [cleanedNumber];
  
  // Generate phone number variants for comprehensive search
  if (cleanedNumber.startsWith('0') && cleanedNumber.length === 10) {
    // 0XXXXXXXXX -> add XXXXXXXXX and 233XXXXXXXXX
    phoneVariants.push(cleanedNumber.substring(1));
    phoneVariants.push('233' + cleanedNumber.substring(1));
  } else if (cleanedNumber.startsWith('233') && cleanedNumber.length === 12) {
    // 233XXXXXXXXX -> add 0XXXXXXXXX and XXXXXXXXX
    phoneVariants.push('0' + cleanedNumber.substring(3));
    phoneVariants.push(cleanedNumber.substring(3));
  } else if (cleanedNumber.length === 9) {
    // XXXXXXXXX -> add 0XXXXXXXXX and 233XXXXXXXXX
    phoneVariants.push('0' + cleanedNumber);
    phoneVariants.push('233' + cleanedNumber);
  }
  
  // Build OR conditions for all phone variants
  const phoneConditions = [];
  phoneVariants.forEach(variant => {
    phoneConditions.push({ mobileNumber: { contains: variant } });
    phoneConditions.push({
      items: {
        some: {
          mobileNumber: { contains: variant }
        }
      }
    });
  });
  
  // Calculate 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // Search Order table with all phone variants
  const orders = await prisma.order.findMany({
    where: {
      OR: phoneConditions,
      createdAt: {
        gte: sevenDaysAgo
      }
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });
  
  return orders;
};

module.exports = {
  getOrCreateShopUser,
  createShopOrder,
  createShopOrderForTransaction,
  trackOrdersByMobile
};

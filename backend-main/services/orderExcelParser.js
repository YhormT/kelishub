const productService = require('./productService');

const getColumnValue = (row, possibleNames) => {
  for (const name of possibleNames) {
    if (row[name] !== undefined) return String(row[name]).trim();
    const key = Object.keys(row).find(
      (k) => k.toLowerCase() === name.toLowerCase()
    );
    if (key && row[key] !== undefined) return String(row[key]).trim();
  }
  return '';
};

/**
 * Parse simplified 2-column Excel rows (phone + bundle amount) for agent orders.
 */
const parseSimplifiedExcelRows = async (data, network, userRole, prisma) => {
  const errorReport = [];
  const productsToAdd = [];
  let totalCost = 0;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const phoneNumber = getColumnValue(row, [
      'phone',
      'Phone',
      'PHONE',
      'phone_number',
      'Phone Number',
      'phoneNumber',
    ]);
    const bundleAmount = getColumnValue(row, [
      'bundle_amount',
      'bundle amount',
      'Bundle_Amount',
      'Bundle Amount',
      'BUNDLE_AMOUNT',
      'BUNDLE AMOUNT',
      'bundle',
      'Bundle',
      'amount',
      'Amount',
      'data',
      'Data',
      'gb',
      'GB',
    ]);

    const rowErrors = [];
    if (!phoneNumber) rowErrors.push('Missing phone number.');
    if (!bundleAmount || isNaN(parseFloat(bundleAmount))) {
      rowErrors.push(
        `Invalid or missing bundle amount. It must be a number. Got: "${bundleAmount}"`
      );
    }

    if (rowErrors.length > 0) {
      errorReport.push({ row: i + 2, errors: rowErrors });
      continue;
    }

    const productDescription = `${bundleAmount}GB`;
    let productName;
    if (userRole.toUpperCase() === 'USER') {
      productName = network.toUpperCase();
    } else {
      productName = `${network.toUpperCase()} - ${userRole.toUpperCase()}`;
    }

    const product = await prisma.product.findFirst({
      where: { name: productName, description: productDescription },
    });

    if (!product) {
      errorReport.push({
        row: i + 2,
        errors: [
          `Product not found for role ${userRole} with bundle ${productDescription} on ${network}.`,
        ],
      });
      continue;
    }

    const unitPrice = productService.getPriceForUserRole(userRole, product) ?? product.price;
    if (unitPrice == null) {
      errorReport.push({
        row: i + 2,
        errors: ['Price could not be determined for this agent and product.'],
      });
      continue;
    }

    if (product.stock < 1) {
      errorReport.push({
        row: i + 2,
        errors: [`Not enough stock for ${productName} (${productDescription})`],
      });
      continue;
    }

    totalCost += unitPrice;
    productsToAdd.push({
      product,
      quantity: 1,
      phoneNumber,
      unitPrice,
    });
  }

  return { productsToAdd, errorReport, totalCost };
};

module.exports = {
  parseSimplifiedExcelRows,
  getColumnValue,
};

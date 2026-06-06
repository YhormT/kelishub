/** Shop price charged at checkout (promo when enabled). */
const effectiveShopPrice = (product) => {
  if (!product) return null;
  if (product.usePromoPrice && product.promoPrice != null) {
    return parseFloat(product.promoPrice);
  }
  return parseFloat(product.price);
};

const PAYSTACK_AMOUNT_TOLERANCE = 0.01;

const paystackAmountToGhs = (amountPesewas) => {
  if (amountPesewas == null || Number.isNaN(Number(amountPesewas))) return null;
  return Number(amountPesewas) / 100;
};

const amountsMatch = (expected, actual, tolerance = PAYSTACK_AMOUNT_TOLERANCE) => {
  const a = parseFloat(expected);
  const b = parseFloat(actual);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) <= tolerance;
};

module.exports = {
  effectiveShopPrice,
  paystackAmountToGhs,
  amountsMatch,
  PAYSTACK_AMOUNT_TOLERANCE,
};

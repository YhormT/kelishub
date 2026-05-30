import React, { useState, useEffect } from 'react';
import { X, Loader2, ShoppingCart } from 'lucide-react';

const ProductCardPopup = ({ isOpen, onClose, product, onAddToCart, balance, cart }) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const validPrefixes = ['024', '025', '053', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];

  useEffect(() => {
    if (isOpen && product) {
      setMobileNumber('');
      setError('');
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const isMTN = product.name?.includes('MTN');
  const isAirtelTigo = product.name?.includes('AIRTEL');

  let warningMessage = 'Make sure the recipient has airtime before purchasing this data package. If not, the user would not receive the data and the system would not be liable for refunds.';
  
  if (isMTN) {
    warningMessage = 'Must not owe airtime and must be normal numbers only.';
  } else if (isAirtelTigo) {
    warningMessage = 'Active SIM or must have airtime.';
  }

  const handleMobileChange = (value) => {
    if (/^\d{0,10}$/.test(value)) {
      setError('');
      setMobileNumber(value);
    }
  };

  const handleSubmit = async () => {
    if (!mobileNumber.trim() || mobileNumber.length !== 10) {
      setError('Enter a valid 10-digit number');
      return;
    }
    const prefix = mobileNumber.substring(0, 3);
    if (!validPrefixes.includes(prefix)) {
      setError('Invalid prefix. Use 024, 054, 055, 059, 020, 050, 027, 057, 026, 056, 028');
      return;
    }

    setAdding(true);
    try {
      await onAddToCart(product.id, mobileNumber);
      onClose();
    } catch (e) {
      // Error handled by parent
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Close button */}
        <div className="flex justify-end p-3 pb-0">
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-1">
          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 text-center mb-3">Enter Phone Number</h3>

          {/* Warning text */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-red-600 text-xs text-center leading-relaxed">
              {warningMessage}
            </p>
          </div>

          {/* Phone input */}
          <input
            type="tel"
            inputMode="numeric"
            placeholder="e.g. 0244123456"
            value={mobileNumber}
            onChange={(e) => handleMobileChange(e.target.value)}
            className={`w-full px-4 py-3 bg-gray-50 border-2 ${error ? 'border-red-400' : 'border-gray-200'} rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-500 text-base mb-2`}
            maxLength={10}
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mb-2">{error}</p>}

          {product.stock === 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-center mb-3">
              <span className="text-red-500 text-sm font-semibold">Out of Stock</span>
            </div>
          )}

          {/* Add to Cart button */}
          <button
            onClick={handleSubmit}
            disabled={adding || balance === 0 || product.stock === 0 || mobileNumber.length !== 10}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2 text-base ${
              adding || balance === 0 || product.stock === 0 || mobileNumber.length !== 10
                ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25'
            }`}
          >
            {adding ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Adding...</>
            ) : balance === 0 ? (
              'Insufficient Balance'
            ) : product.stock === 0 ? (
              'Out of Stock'
            ) : (
              <><ShoppingCart className="w-5 h-5" /> Add to Cart</>
            )}
          </button>

          <p className="text-center text-gray-400 text-xs mt-3">Data Bond Payment</p>
        </div>
      </div>
    </div>
  );
};

export default ProductCardPopup;

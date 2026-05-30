import React, { useState } from 'react';
import { X, Loader2, Wallet, CreditCard, ExternalLink, Copy, Check, Receipt } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TopUp = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentStep, setPaymentStep] = useState('amount'); // 'amount', 'processing', 'redirect'
  const [externalRef, setExternalRef] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transaction'); // 'paystack' or 'transaction'
  const [transactionId, setTransactionId] = useState('');
  const [copyStatus, setCopyStatus] = useState(false);

  // Payment details for transaction ID method
  const phoneNumber = '0596316991';
  const accountName = 'Yesu Yhorm Azago Kafui';

  const handleCopy = () => {
    navigator.clipboard.writeText(phoneNumber.replace(/\s/g, '')).then(() => {
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    });
  };

  const quickAmounts = [10, 20, 50, 100, 200, 500];

  const handleInitializePayment = async (e) => {
    e.preventDefault();
    
    const topupAmount = parseFloat(amount);
    if (!topupAmount || topupAmount < 1) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid Amount',
        text: 'Please enter a valid amount (minimum GHS 1)',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    setLoading(true);
    setPaymentStep('processing');

    try {
      const userId = localStorage.getItem('userId');
      const response = await axios.post(`${BASE_URL}/api/topup/initialize`, {
        userId: parseInt(userId, 10),
        amount: topupAmount
      }, { headers: getAuthHeaders() });

      if (response.data.success) {
        setExternalRef(response.data.externalRef);
        setPaymentStep('redirect');
        
        // Open Paystack payment page
        window.open(response.data.paymentUrl, '_blank');
      } else {
        setPaymentStep('amount');
        Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: response.data.error || 'Could not initialize payment',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    } catch (error) {
      setPaymentStep('amount');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Something went wrong',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!externalRef) return;
    
    setLoading(true);

    try {
      const response = await axios.post(`${BASE_URL}/api/topup/verify`, {
        reference: externalRef
      }, { headers: getAuthHeaders() });

      if (response.data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Top-Up Successful!',
          html: `
            <div class="text-left space-y-2">
              <p><strong>Amount:</strong> GHS ${response.data.amount}</p>
              <p><strong>New Balance:</strong> GHS ${response.data.newBalance?.toFixed(2)}</p>
            </div>
          `,
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        setAmount('');
        setPaymentStep('amount');
        setExternalRef('');
        if (onSuccess) onSuccess();
        onClose();
      } else if (response.data.pending) {
        Swal.fire({
          icon: 'info',
          title: 'Payment Pending',
          text: response.data.message || 'Payment is still being processed. Please try again in a moment.',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Verification Failed',
          text: response.data.message || 'Payment could not be verified',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.message || 'Could not verify payment',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Transaction ID verification
  const handleTransactionIdVerify = async (e) => {
    e.preventDefault();
    
    if (!transactionId.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Please enter a valid Transaction ID.',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    setLoading(true);

    try {
      const userId = localStorage.getItem('userId');
      const response = await axios.post(`${BASE_URL}/api/verify-sms`, {
        userId: parseInt(userId, 10),
        referenceId: transactionId
      }, { headers: getAuthHeaders() });

      if (response.data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Top-Up Successful!',
          html: `
            <div class="text-left space-y-2">
              <p><strong>Amount:</strong> GHS ${response.data.amount}</p>
              <p><strong>New Balance:</strong> GHS ${response.data.newBalance?.toFixed(2)}</p>
              <p><strong>Reference:</strong> ${response.data.reference}</p>
            </div>
          `,
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        setTransactionId('');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Verification Failed',
          text: response.data.message || 'Transaction could not be verified.',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Something went wrong. Please try again.';
      const isAlreadyUsed = errorMessage.toLowerCase().includes('already been used');
      await Swal.fire({
        icon: isAlreadyUsed ? 'warning' : 'error',
        title: isAlreadyUsed ? 'Transaction Already Processed' : 'Error',
        text: errorMessage,
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: isAlreadyUsed ? '#f59e0b' : '#ef4444'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setPaymentStep('amount');
    setExternalRef('');
    setTransactionId('');
    setPaymentMethod('paystack');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet className="w-6 h-6 text-white" />
            <h2 className="text-lg sm:text-xl font-bold text-white">Top Up Wallet</h2>
          </div>
          <button onClick={handleClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors active:scale-95">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto">
          {paymentStep === 'amount' && (
            <>
              {/* Payment Method Toggle */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-xs sm:text-sm font-medium text-dark-300 mb-2 sm:mb-3">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transaction')}
                    className={`py-3 px-2 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                      paymentMethod === 'transaction'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    }`}
                  >
                    <Receipt className="w-4 h-4 flex-shrink-0" />
                    <span>Transaction ID</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('paystack')}
                    className={`py-3 px-2 rounded-xl font-semibold text-xs sm:text-sm transition-all active:scale-95 flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap ${
                      paymentMethod === 'paystack'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 flex-shrink-0" />
                    <span>Paystack</span>
                  </button>
                </div>
              </div>

              {/* Paystack Payment Method */}
              {paymentMethod === 'paystack' && (
                <>
                  {/* Quick Amount Buttons */}
                  <div className="mb-4 sm:mb-6">
                    <label className="block text-xs sm:text-sm font-medium text-dark-300 mb-2 sm:mb-3">Quick Select</label>
                    <div className="grid grid-cols-3 gap-2">
                      {quickAmounts.map((quickAmt) => (
                        <button
                          key={quickAmt}
                          type="button"
                          onClick={() => setAmount(quickAmt.toString())}
                          className={`py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                            amount === quickAmt.toString()
                              ? 'bg-emerald-500 text-white'
                              : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                          }`}
                        >
                          GHS {quickAmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Amount Input */}
                  <form onSubmit={handleInitializePayment} className="space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-dark-300 mb-1.5 sm:mb-2">Amount (GHS)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        min="1"
                        step="0.01"
                        className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white text-lg font-semibold placeholder-dark-500 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>

                    <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl">
                      <div className="flex items-center gap-2 text-cyan-400 text-sm">
                        <CreditCard className="w-4 h-4" />
                        <span>Pay securely with Mobile Money or Card</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !amount}
                      className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 active:scale-95"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-5 h-5" />
                          Top Up GHS {amount || '0'}
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}

              {/* Transaction ID Payment Method */}
              {paymentMethod === 'transaction' && (
                <>
                  {/* Payment Info */}
                  <div className="bg-dark-900/50 border border-dark-700 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                    <h3 className="text-white font-semibold mb-2 sm:mb-3 text-sm sm:text-base">Payment Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-dark-400">Phone Number:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-cyan-400 font-mono">{phoneNumber}</span>
                          <button onClick={handleCopy} className="p-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition-colors">
                            {copyStatus ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-dark-400" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-dark-400">Account Name:</span>
                        <span className="text-purple-400">{accountName}</span>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-amber-400 text-xs sm:text-sm">
                        <strong>Note:</strong> Send money to the number above, then enter your transaction ID below to verify.
                      </p>
                    </div>
                  </div>

                  {/* Transaction ID Form */}
                  <form onSubmit={handleTransactionIdVerify} className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-dark-300 mb-1.5 sm:mb-2">Transaction ID</label>
                      <input
                        type="text"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                        placeholder="Enter your transaction ID"
                        className="w-full bg-dark-900 border border-dark-600 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none text-base"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:from-emerald-600 hover:to-emerald-700 transition-all disabled:opacity-50 active:scale-95 text-sm sm:text-base"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify Top-Up'
                      )}
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {paymentStep === 'processing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
              <p className="text-white font-semibold">Initializing Payment...</p>
              <p className="text-dark-400 text-sm mt-2">Please wait</p>
            </div>
          )}

          {paymentStep === 'redirect' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ExternalLink className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Payment Page Opened</h3>
                <p className="text-dark-400 text-sm">
                  Complete your payment in the new tab, then click verify below.
                </p>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-amber-400 text-xs sm:text-sm text-center">
                  <strong>Amount:</strong> GHS {amount}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleVerifyPayment}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'I Have Paid - Verify'
                  )}
                </button>
                <button
                  onClick={() => { setPaymentStep('amount'); setExternalRef(''); }}
                  className="w-full py-3 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-xl font-semibold active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopUp;

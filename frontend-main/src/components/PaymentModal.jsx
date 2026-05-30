import React, { useState } from 'react';
import { X, Phone, Loader2, CheckCircle, XCircle, ArrowRight, Shield, Wifi } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const PaymentModal = ({ isOpen, onClose, product, onSuccess }) => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [paymentStep, setPaymentStep] = useState('initiate');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [externalRef, setExternalRef] = useState('');

  const getCarrierGradient = (name) => {
    const upperName = name?.toUpperCase() || '';
    if (upperName.includes('MTN')) return 'from-yellow-500 to-amber-600';
    if (upperName.includes('TELECEL')) return 'from-red-500 to-rose-600';
    if (upperName.includes('AIRTEL') || upperName.includes('TIGO')) return 'from-blue-500 to-indigo-600';
    return 'from-cyan-500 to-cyan-600';
  };

  const resetModal = () => {
    setMobileNumber('');
    setPaymentStep('initiate');
    setIsProcessing(false);
    setPaymentMessage('');
    setExternalRef('');
    onClose();
  };

  const validPrefixes = ['024', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];
  
  const validatePhoneNumber = (phone) => {
    if (!phone || phone.length !== 10) return false;
    const prefix = phone.substring(0, 3);
    return validPrefixes.includes(prefix);
  };

  const initiatePayment = async () => {
    if (!mobileNumber || mobileNumber.length !== 10) {
      Swal.fire({
        title: 'Invalid Number',
        text: 'Please enter a valid mobile number (10 digits)',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }
    
    if (!validatePhoneNumber(mobileNumber)) {
      Swal.fire({
        title: 'Invalid Number Format',
        text: 'Number must start with a valid prefix (024, 054, 055, 059, 020, 050, 027, 057, 026, 056, 028)',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setIsProcessing(true);
    setPaymentMessage('Initializing payment...');

    try {
      const response = await axios.post(`${BASE_URL}/api/payment/initialize`, {
        mobileNumber,
        amount: product.price,
        productId: product.id,
        productName: product.name
      });

      if (response.data.success && response.data.paymentUrl) {
        setExternalRef(response.data.externalRef);
        window.location.href = response.data.paymentUrl;
      } else {
        setPaymentStep('failed');
        setPaymentMessage(response.data.message || 'Failed to initialize payment');
      }
    } catch (error) {
      setPaymentStep('failed');
      setPaymentMessage(error.response?.data?.message || 'Failed to initialize payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  const verifyPayment = async () => {
    if (!externalRef) return;

    setIsProcessing(true);
    setPaymentStep('processing');
    setPaymentMessage('Verifying payment...');

    try {
      const response = await axios.post(`${BASE_URL}/api/payment/verify`, { reference: externalRef });

      if (response.data.success) {
        setPaymentStep('success');
        setPaymentMessage('Payment verified! Your order has been placed.');
        if (onSuccess) onSuccess(response.data.order);
      } else if (response.data.status === 'PENDING') {
        setPaymentStep('waiting');
        setPaymentMessage('Payment not yet confirmed. Please complete the payment.');
      } else {
        setPaymentStep('failed');
        setPaymentMessage(response.data.message || 'Payment verification failed');
      }
    } catch (error) {
      setPaymentStep('failed');
      setPaymentMessage(error.response?.data?.message || 'Payment verification failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className={`relative bg-gradient-to-r ${getCarrierGradient(product.name)} p-6`}>
          <button onClick={resetModal} className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-5 h-5 text-white/70" />
            <span className="text-white/70 text-sm font-medium uppercase tracking-wider">Data Bundle</span>
          </div>
          <h2 className="text-xl font-bold text-white">{product.name}</h2>
          <p className="text-white/80 font-medium mt-1">{product.description}</p>
        </div>
        
        <div className="p-6">
          <div className="bg-dark-900/50 rounded-xl p-4 mb-6 border border-dark-700">
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Amount</span>
              <span className="text-2xl font-bold text-white">GHS {product.price?.toFixed(2)}</span>
            </div>
          </div>

          {paymentMessage && (
            <div className={`mb-6 p-4 rounded-xl text-sm font-medium border ${
              paymentStep === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              paymentStep === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            }`}>
              {paymentMessage}
            </div>
          )}

          {paymentStep === 'initiate' && (
            <>
              <div className="mb-6">
                <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-3">
                  <Phone className="w-4 h-4 text-cyan-500" />
                  Data Bundle Number
                </label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="0XX XXX XXXX"
                  className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-4 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
                  maxLength={10}
                  disabled={isProcessing}
                />
              </div>
              <div className="space-y-3">
                <button
                  onClick={initiatePayment}
                  disabled={isProcessing}
                  className={`w-full bg-gradient-to-r ${getCarrierGradient(product.name)} text-white py-4 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                  ) : (
                    <>Pay with Mobile Money <ArrowRight className="w-5 h-5" /></>
                  )}
                </button>
                <button onClick={resetModal} className="w-full bg-dark-700 hover:bg-dark-600 text-dark-300 py-4 rounded-xl font-semibold border border-dark-600">
                  Cancel
                </button>
              </div>
            </>
          )}

          {paymentStep === 'waiting' && (
            <div className="space-y-3">
              <button onClick={verifyPayment} disabled={isProcessing} className={`w-full bg-gradient-to-r ${getCarrierGradient(product.name)} text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2`}>
                {isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</> : 'I Have Paid - Verify'}
              </button>
              <button onClick={() => { setPaymentStep('initiate'); setPaymentMessage(''); }} className="w-full bg-dark-700 text-dark-300 py-4 rounded-xl font-semibold border border-dark-600">Cancel</button>
            </div>
          )}

          {paymentStep === 'processing' && (
            <div className="text-center py-10">
              <Loader2 className="w-16 h-16 animate-spin text-cyan-500 mx-auto" />
              <p className="text-dark-400 mt-6">Please wait...</p>
            </div>
          )}

          {paymentStep === 'success' && (
            <div className="text-center py-6">
              <div className="inline-flex p-4 bg-emerald-500/10 rounded-full mb-4">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
              </div>
              <button onClick={resetModal} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-xl font-bold">Done</button>
            </div>
          )}

          {paymentStep === 'failed' && (
            <div className="text-center py-6">
              <div className="inline-flex p-4 bg-red-500/10 rounded-full mb-4">
                <XCircle className="w-16 h-16 text-red-400" />
              </div>
              <div className="space-y-3">
                <button onClick={() => { setPaymentStep('initiate'); setPaymentMessage(''); }} className={`w-full bg-gradient-to-r ${getCarrierGradient(product.name)} text-white py-4 rounded-xl font-bold`}>Try Again</button>
                <button onClick={resetModal} className="w-full bg-dark-700 text-dark-300 py-4 rounded-xl font-semibold border border-dark-600">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-dark-700">
            <Shield className="w-4 h-4 text-dark-500" />
            <p className="text-xs text-dark-500">Secured by Paystack</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;

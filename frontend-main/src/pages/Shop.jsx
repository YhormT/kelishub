import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import axios from 'axios';
import { Search, Phone, CheckCircle, XCircle, Clock, Package, Filter, Loader2, Shield, Zap, Wifi, Star, ArrowRight, MessageSquareWarning, X, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';
import ComplaintModal from '../components/ComplaintModal';
import ShopAnnouncementBanner from '../components/ShopAnnouncementBanner';
import ShopFloatingChatButton from '../components/ShopFloatingChatButton';
import { WhatsAppCommunityBanner } from '../components/WhatsAppCommunity';
import getSocket from '../utils/socket';


const Shop = () => {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [shopAlert, setShopAlert] = useState(null);
  const [showShopAlert, setShowShopAlert] = useState(false);
  const [mobileNumber, setMobileNumber] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackedOrders, setTrackedOrders] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [paymentStep, setPaymentStep] = useState('initiate');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [externalRef, setExternalRef] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const filterRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/shop/products`);
      setProducts(response.data || []);
    } catch (error) {
      console.error('Error fetching shop products:', error);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    // Fetch shop alert popup on every visit
    axios.get(`${BASE_URL}/api/announcement/shop-alert`)
      .then(res => {
        if (res.data?.success && res.data?.data) {
          setShopAlert(res.data.data);
          setShowShopAlert(true);
        }
      })
      .catch(() => {});
  }, [fetchProducts]);

  // Real-time stock updates via socket
  useEffect(() => {
    const socket = getSocket();
    socket.on('product:stock-update', fetchProducts);
    return () => socket.off('product:stock-update', fetchProducts);
  }, [fetchProducts]);

  // Handle Paystack callback redirect — runs independently of the payment modal
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const reference = urlParams.get('reference') || urlParams.get('trxref');
    
    if (paymentStatus === 'callback' && reference) {
      // Clear URL params immediately
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Show a blocking Swal while verifying (no dependency on selectedProduct)
      Swal.fire({
        title: 'Verifying Payment...',
        html: 'Please wait while we confirm your payment.',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        background: '#1e293b',
        color: '#f1f5f9',
        didOpen: () => Swal.showLoading()
      });

      axios.post(`${BASE_URL}/api/payment/verify`, { reference })
        .then((response) => {
          if (response.data.success) {
            Swal.fire({
              title: 'Order Placed!',
              html: `<p>Order ID: <strong>#${response.data.order?.id || 'N/A'}</strong></p><p>Use your mobile number to track your order.</p>`,
              icon: 'success',
              background: '#1e293b',
              color: '#f1f5f9',
              confirmButtonColor: '#06b6d4'
            });
            fetchProducts();
          } else if (response.data.status === 'PENDING') {
            Swal.fire({
              title: 'Payment Pending',
              text: 'Your payment has not been confirmed yet. Please check back shortly.',
              icon: 'info',
              background: '#1e293b',
              color: '#f1f5f9',
              confirmButtonColor: '#06b6d4'
            });
          } else {
            Swal.fire({
              title: 'Payment Failed',
              text: response.data.message || 'Payment was not successful.',
              icon: 'error',
              background: '#1e293b',
              color: '#f1f5f9',
              confirmButtonColor: '#06b6d4'
            });
          }
        })
        .catch((error) => {
          Swal.fire({
            title: 'Verification Error',
            text: error.response?.data?.message || 'Could not verify payment. Please use your mobile number to track your order.',
            icon: 'warning',
            background: '#1e293b',
            color: '#f1f5f9',
            confirmButtonColor: '#06b6d4'
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleOrderClick = (product) => {
    if (product.stock <= 0 || product.shopStockClosed) {
      Swal.fire({
        title: product.shopStockClosed ? 'Stock Closed' : 'Out of Stock',
        text: product.shopStockClosed ? 'Sorry, this product is currently unavailable for purchase.' : 'Sorry, this product is currently out of stock.',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }
    setSelectedProduct(product);
    setShowPaymentModal(true);
    setMobileNumber('');
    setExternalRef('');
    setPaymentStep('initiate');
    setPaymentMessage('');
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedProduct(null);
    setMobileNumber('');
    setExternalRef('');
    setPaymentStep('initiate');
    setPaymentMessage('');
    setIsProcessingPayment(false);
  };

  const validPrefixes = ['024', '025', '053', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];
  
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

    setIsProcessingPayment(true);
    setPaymentMessage('Initializing payment...');

    try {
      const response = await axios.post(`${BASE_URL}/api/payment/initialize`, {
        mobileNumber,
        amount: (selectedProduct.usePromoPrice && selectedProduct.promoPrice != null) ? selectedProduct.promoPrice : selectedProduct.price,
        productId: selectedProduct.id,
        productName: selectedProduct.name
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
      setIsProcessingPayment(false);
    }
  };

  const verifyPayment = async (reference) => {
    const refToVerify = reference || externalRef;
    if (!refToVerify) return;

    setIsProcessingPayment(true);
    setPaymentStep('processing');
    setPaymentMessage('Verifying payment...');

    try {
      const response = await axios.post(`${BASE_URL}/api/payment/verify`, { reference: refToVerify });

      if (response.data.success) {
        setPaymentStep('success');
        setPaymentMessage('Payment verified! Your order has been placed.');
        Swal.fire({
          title: 'Order Placed!',
          html: `<p>Order ID: <strong>#${response.data.order?.id || 'N/A'}</strong></p><p>Use your mobile number to track.</p>`,
          icon: 'success',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        closePaymentModal();
        fetchProducts();
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
      setIsProcessingPayment(false);
    }
  };

  const trackOrder = async () => {
    if (!trackingNumber || trackingNumber.length < 10) {
      Swal.fire({
        title: 'Invalid Number',
        text: 'Please enter a valid mobile number',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setIsTracking(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/shop/track?mobileNumber=${trackingNumber}`);
      setTrackedOrders(response.data.orders || []);
      if (response.data.orders?.length === 0) {
        Swal.fire({
          title: 'No Orders Found',
          text: 'No orders found for this mobile number.',
          icon: 'info',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
      }
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: 'Failed to track order.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } finally {
      setIsTracking(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'processing': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'cancelled': case 'canceled': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-dark-700 text-dark-300 border-dark-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'processing': return <Clock className="w-4 h-4" />;
      case 'pending': return <Package className="w-4 h-4" />;
      case 'cancelled': case 'canceled': return <XCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const filteredProducts = useMemo(() => {
    const filtered = activeFilter === 'all' ? [...products] : products.filter((product) => {
      const upperName = product.name?.toUpperCase() || '';
      if (activeFilter === 'mtn') return upperName.includes('MTN');
      if (activeFilter === 'airtel') return upperName.includes('AIRTEL') || upperName.includes('TIGO');
      if (activeFilter === 'telecel') return upperName.includes('TELECEL');
      return true;
    });

    const getNetworkPriority = (name) => {
      const upperName = name?.toUpperCase() || '';
      if (upperName.includes('MTN')) return 1;
      if (upperName.includes('TELECEL')) return 2;
      if (upperName.includes('AIRTEL') || upperName.includes('TIGO')) return 3;
      return 4;
    };

    const parseBundleSize = (text) => {
      if (!text) return Number.MAX_SAFE_INTEGER;
      const match = text.match(/([\d.]+)\s*(gb|mb|g|m)/i);
      if (!match) return Number.MAX_SAFE_INTEGER;
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      return value * (unit.startsWith('g') ? 1024 : 1);
    };

    return filtered.sort((a, b) => {
      const networkDiff = getNetworkPriority(a.name) - getNetworkPriority(b.name);
      if (networkDiff !== 0) return networkDiff;
      return parseBundleSize(a.description) - parseBundleSize(b.description);
    });
  }, [products, activeFilter]);

  const getCarrierGradient = (name) => {
    const upperName = name?.toUpperCase() || '';
    if (upperName.includes('MTN')) return 'from-yellow-500 to-amber-600';
    if (upperName.includes('TELECEL')) return 'from-red-500 to-rose-600';
    if (upperName.includes('AIRTEL') || upperName.includes('TIGO')) return 'from-blue-500 to-indigo-600';
    return 'from-dark-600 to-dark-700';
  };

  return (
    <div className="min-h-screen bg-dark-950">
      <ShopAnnouncementBanner />
      
      {/* Navbar */}
      <nav className="sticky top-0 z-50 glass border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-20">
            <a href="/shop" className="flex items-center gap-2 sm:gap-3">
              <img src="/logo-icon.png" alt="kellishub" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl" />
              <div>
                <h1 className="text-base sm:text-xl font-bold text-white">kellishub</h1>
                <p className="text-xs text-cyan-400 font-medium">Data Shop</p>
              </div>
            </a>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowComplaintModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg sm:rounded-xl text-red-400 font-medium transition-all active:scale-95"
              >
                <MessageSquareWarning className="w-4 h-4" />
                <span className="sm:inline text-sm">Help</span>
              </button>
              <button
                onClick={() => setShowTrackingModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-lg sm:rounded-xl text-white text-sm sm:text-base font-medium shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-cyan-700 transition-all active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span className="text-sm sm:text-base">Track</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* WhatsApp Community CTA */}
        <WhatsAppCommunityBanner />

        {/* Filter Section */}
        <div ref={filterRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 p-6 bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <Filter className="w-5 h-5 text-cyan-500" />
            </div>
            <span className="text-white font-semibold">Filter by Network</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Networks' },
              { id: 'mtn', label: 'MTN' },
              { id: 'airtel', label: 'AirtelTigo' },
              { id: 'telecel', label: 'Telecel' }
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                  activeFilter === filter.id
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600 border border-dark-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-32">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-dark-700 border-t-cyan-500 animate-spin"></div>
            </div>
            <p className="mt-6 text-dark-400 font-medium">Loading bundles...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-32">
            <div className="inline-flex p-6 bg-dark-800 rounded-full mb-6">
              <Package className="w-12 h-12 text-dark-500" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              {products.length === 0 ? 'No Products Available' : 'No Matches Found'}
            </h2>
            <p className="text-dark-400">
              {products.length === 0 ? 'Check back later for new data bundles.' : 'Try selecting a different network filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group relative bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/10"
              >
                <div className={`relative p-4 sm:p-6 bg-gradient-to-br ${getCarrierGradient(product.name)}`}>
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="relative flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Wifi className="w-4 h-4 text-white/70" />
                        <span className="text-white/70 text-xs font-medium uppercase tracking-wider">Data Bundle</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-white">{product.name}</h3>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 sm:p-6">
                  <p className="text-xl sm:text-2xl font-bold text-white mb-3 sm:mb-4">{product.description}</p>
                  
                  <div className="flex items-end gap-2 mb-4 sm:mb-6">
                    <span className="text-xl sm:text-2xl font-bold text-white">GHS {((product.usePromoPrice && product.promoPrice != null) ? product.promoPrice : product.price).toFixed(2)}</span>
                    <span className="text-dark-500 text-xs sm:text-sm mb-1">/ bundle</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 sm:mb-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-xs font-medium border border-emerald-500/20">
                      <Zap className="w-3 h-3" /> Instant
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg text-xs font-medium border border-cyan-500/20">
                      <Shield className="w-3 h-3" /> Secure
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium border border-purple-500/20">
                      <Star className="w-3 h-3" /> Premium
                    </span>
                  </div>
                  
                  <button
                    onClick={() => handleOrderClick(product)}
                    className={`w-full py-3 sm:py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                      product.stock > 0 && !product.shopStockClosed
                        ? `bg-gradient-to-r ${getCarrierGradient(product.name)} text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]`
                        : 'bg-dark-700 text-dark-400 cursor-pointer hover:bg-dark-600'
                    }`}
                  >
                    {product.shopStockClosed ? 'Stock Closed' : product.stock > 0 ? (
                      <>
                        <span>Purchase Now</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    ) : 'Out of Stock'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {showPaymentModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden">
            <div className={`relative bg-gradient-to-r ${getCarrierGradient(selectedProduct.name)} p-4`}>
              <button onClick={closePaymentModal} className="absolute top-3 right-3 p-1.5 bg-white/20 hover:bg-white/30 rounded-lg active:scale-95 transition-all">
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Wifi className="w-5 h-5 text-white/80" />
                <span className="text-white/80 text-xs font-semibold uppercase tracking-wider">Data Bundle</span>
              </div>
              <h2 className="text-lg font-bold text-white pr-8">
                {paymentStep === 'initiate' && 'Complete Your Order'}
                {paymentStep === 'waiting' && 'Complete Payment'}
                {paymentStep === 'processing' && 'Verifying Payment'}
                {paymentStep === 'success' && 'Payment Successful'}
                {paymentStep === 'failed' && 'Payment Failed'}
              </h2>
              <p className="text-white/90 text-sm font-medium mt-1">{selectedProduct.name} - {selectedProduct.description}</p>
            </div>
            
            <div className="p-4">
              <div className="bg-dark-900/50 rounded-xl p-3 mb-4 border border-dark-700">
                <div className="flex justify-between items-center">
                  <span className="text-dark-400 text-sm">Amount</span>
                  <span className="text-xl font-bold text-white">GHS {((selectedProduct.usePromoPrice && selectedProduct.promoPrice != null) ? selectedProduct.promoPrice : selectedProduct.price).toFixed(2)}</span>
                </div>
              </div>

              {paymentMessage && (
                <div className={`mb-4 p-3 rounded-xl text-sm font-medium border ${
                  paymentStep === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  paymentStep === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                }`}>
                  {paymentMessage}
                </div>
              )}

              {paymentStep === 'initiate' && (
                <>
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
                      <Phone className="w-4 h-4 text-cyan-500" />
                      Data Bundle Number
                    </label>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                      placeholder="0XX XXX XXXX"
                      className="w-full bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
                      maxLength={10}
                      disabled={isProcessingPayment}
                    />
                  </div>
                  <div className="space-y-2.5">
                    <button
                      onClick={initiatePayment}
                      disabled={isProcessingPayment}
                      className={`w-full bg-gradient-to-r ${getCarrierGradient(selectedProduct.name)} text-white py-3.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:shadow-lg active:scale-95`}
                    >
                      {isProcessingPayment ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
                      ) : (
                        <>Pay with Mobile Money <ArrowRight className="w-5 h-5" /></>
                      )}
                    </button>
                    <button onClick={closePaymentModal} className="w-full bg-dark-700 hover:bg-dark-600 text-dark-300 py-3.5 rounded-xl font-semibold transition-all active:scale-95">
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {paymentStep === 'waiting' && (
                <>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                    <p className="text-amber-400 font-medium text-center text-sm">Payment page opened</p>
                    <p className="text-amber-400/70 text-xs mt-1 text-center">Complete your payment there, then return here.</p>
                  </div>
                  <div className="space-y-2.5">
                    <button onClick={() => verifyPayment()} disabled={isProcessingPayment} className={`w-full bg-gradient-to-r ${getCarrierGradient(selectedProduct.name)} text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95`}>
                      {isProcessingPayment ? <><Loader2 className="w-5 h-5 animate-spin" /> Verifying...</> : 'I Have Paid - Verify'}
                    </button>
                    <button onClick={() => { setPaymentStep('initiate'); setPaymentMessage(''); }} className="w-full bg-dark-700 hover:bg-dark-600 text-dark-300 py-3.5 rounded-xl font-semibold active:scale-95">Cancel</button>
                  </div>
                </>
              )}

              {paymentStep === 'processing' && (
                <div className="text-center py-8">
                  <Loader2 className="w-14 h-14 animate-spin text-cyan-500 mx-auto" />
                  <p className="text-dark-400 mt-4 text-sm">Please wait...</p>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="text-center py-6">
                  <div className="inline-flex p-3 bg-emerald-500/10 rounded-full mb-3">
                    <CheckCircle className="w-14 h-14 text-emerald-400" />
                  </div>
                  <p className="text-dark-300 mb-4 text-sm">Order placed successfully!</p>
                  <button onClick={closePaymentModal} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3.5 rounded-xl font-bold active:scale-95">Done</button>
                </div>
              )}

              {paymentStep === 'failed' && (
                <div className="text-center py-6">
                  <div className="inline-flex p-3 bg-red-500/10 rounded-full mb-3">
                    <XCircle className="w-14 h-14 text-red-400" />
                  </div>
                  <p className="text-dark-300 mb-4 text-sm">Payment was not successful.</p>
                  <div className="space-y-2.5">
                    <button onClick={() => { setPaymentStep('initiate'); setPaymentMessage(''); }} className={`w-full bg-gradient-to-r ${getCarrierGradient(selectedProduct.name)} text-white py-3.5 rounded-xl font-bold active:scale-95`}>Try Again</button>
                    <button onClick={closePaymentModal} className="w-full bg-dark-700 text-dark-300 py-3.5 rounded-xl font-semibold active:scale-95">Cancel</button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-dark-700">
                <Shield className="w-4 h-4 text-dark-500" />
                <p className="text-xs text-dark-500">Secured by Paystack</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {showTrackingModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-6 border-b border-dark-700 flex justify-between items-center flex-shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-white">Track Your Order</h2>
              <button onClick={() => { setShowTrackingModal(false); setTrackedOrders([]); setTrackingNumber(''); }} className="text-dark-500 hover:text-dark-300">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="flex gap-2 sm:gap-3 mb-4 sm:mb-6">
                <input
                  type="tel"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter mobile number"
                  className="flex-1 bg-dark-900/50 border-2 border-dark-600 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                  maxLength={10}
                />
                <button onClick={trackOrder} disabled={isTracking} className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2 flex-shrink-0">
                  {isTracking ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Search className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              </div>

              {trackedOrders.length > 0 && (
                <div className="space-y-3 sm:space-y-4">
                  {trackedOrders.map((order) => (
                    <div key={order.orderId} className="bg-dark-900/50 rounded-xl p-3 sm:p-4 border border-dark-700">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2 sm:mb-3">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm sm:text-base">Order #{order.orderId}</p>
                          <p className="text-dark-500 text-xs sm:text-sm">{new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap flex-shrink-0 ${getStatusColor(order.items?.[0]?.status)}`}>
                          {getStatusIcon(order.items?.[0]?.status)} {order.items?.[0]?.status || 'Pending'}
                        </span>
                      </div>
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="text-dark-300 text-xs sm:text-sm break-words">
                          <span className="text-white font-medium">{item.productName}</span> - {item.productDescription}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ComplaintModal isOpen={showComplaintModal} onClose={() => setShowComplaintModal(false)} />
      {/* <WhatsAppCommunityFAB /> */}
      <ShopFloatingChatButton />

      {/* Shop Alert Popup - shows every visit, only closes on OK */}
      {showShopAlert && shopAlert && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-dark-800 border border-red-500/40 rounded-2xl shadow-2xl shadow-red-500/10 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-5 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{shopAlert.title}</h2>
                <p className="text-red-100 text-xs mt-0.5">Important Notice</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-dark-200 leading-relaxed whitespace-pre-wrap">{shopAlert.message}</p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowShopAlert(false)}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-red-500/25"
              >
                Okay, I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shop;

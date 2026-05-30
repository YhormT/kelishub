import React, { useState, useEffect, useCallback } from 'react';
import { X, Store, Plus, Trash2, Edit2, Copy, Check, ExternalLink, Loader2, RefreshCw, DollarSign, Package, TrendingUp, Link2, Eye, EyeOff, FileText, Send, Phone, Wifi, Database } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const formatAmount = (amount) => {
  const num = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  return `GHS ${num.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const Storefront = ({ isOpen, onClose, userId }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [storefrontProducts, setStorefrontProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [referralSummary, setReferralSummary] = useState({ orders: [], stats: {} });
  const [storefrontSlug, setStorefrontSlug] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Add product modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [customPrice, setCustomPrice] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('all');

  // Edit price modal
  const [editingProduct, setEditingProduct] = useState(null);
  const [editPrice, setEditPrice] = useState('');

  // Commission request tab - networks suffixed by agent role
  const agentRole = (localStorage.getItem('role') || 'USER').toUpperCase();
  const networkOptions = React.useMemo(() => {
    const carriers = ['MTN', 'AirtelTigo', 'Telecel'];
    if (agentRole === 'USER' || agentRole === 'ADMIN') return carriers;
    return carriers.map(c => `${c} - ${agentRole}`);
  }, [agentRole]);

  const [commissionRequests, setCommissionRequests] = useState([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestForm, setRequestForm] = useState({
    customerPhone: '',
    price: '',
    network: networkOptions[0] || 'MTN',
    dataSize: ''
  });

  const fetchStorefrontData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [slugRes, productsRes, availableRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/slug`, { headers }),
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/products`, { headers }),
        axios.get(`${BASE_URL}/api/storefront/agent/${userId}/products/available`, { headers })
      ]);

      if (slugRes.data.success) setStorefrontSlug(slugRes.data.slug);
      if (productsRes.data.success) setStorefrontProducts(productsRes.data.products);
      if (availableRes.data.success) setAvailableProducts(availableRes.data.products);
    } catch (error) {
      console.error('Error fetching storefront data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchReferralSummary = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/storefront/agent/${userId}/referrals`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setReferralSummary({ orders: res.data.orders, stats: res.data.stats });
      }
    } catch (error) {
      console.error('Error fetching referral summary:', error);
    }
  }, [userId]);

  const fetchCommissionRequests = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/commission-requests/my-requests`, { headers: getAuthHeaders() });
      if (res.data.success) {
        setCommissionRequests(res.data.data);
      }
    } catch (error) {
      console.error('Error fetching commission requests:', error);
    }
  }, []);

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!requestForm.customerPhone || !requestForm.price || !requestForm.dataSize) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please fill all fields', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    setSubmittingRequest(true);
    try {
      await axios.post(`${BASE_URL}/api/commission-requests`, requestForm, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Request Submitted!', text: 'Admin will review your commission request', timer: 2000, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
      setRequestForm({ customerPhone: '', price: '', network: networkOptions[0] || 'MTN', dataSize: '' });
      fetchCommissionRequests();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to submit request', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setSubmittingRequest(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStorefrontData();
      fetchReferralSummary();
      fetchCommissionRequests();
    }
  }, [isOpen, fetchStorefrontData, fetchReferralSummary, fetchCommissionRequests]);

  const copyStoreLink = () => {
    const storeUrl = `${window.location.origin}/store/${storefrontSlug}`;
    navigator.clipboard.writeText(storeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddProduct = async () => {
    if (!selectedProduct || !customPrice) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Please select a product and enter a price', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    if (parseFloat(customPrice) < selectedProduct.price) {
      Swal.fire({ icon: 'error', title: 'Error', text: `Price must be at least GHS ${selectedProduct.price} (base price)`, background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    setAddingProduct(true);
    try {
      await axios.post(`${BASE_URL}/api/storefront/agent/${userId}/products`, {
        productId: selectedProduct.id,
        customPrice: parseFloat(customPrice)
      }, { headers: getAuthHeaders() });
      
      Swal.fire({ icon: 'success', title: 'Added!', text: 'Product added to your storefront', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
      setShowAddModal(false);
      setSelectedProduct(null);
      setCustomPrice('');
      fetchStorefrontData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to add product', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setAddingProduct(false);
    }
  };

  const handleUpdatePrice = async () => {
    if (!editingProduct || !editPrice) return;

    if (parseFloat(editPrice) < editingProduct.product.price) {
      Swal.fire({ icon: 'error', title: 'Error', text: `Price must be at least GHS ${editingProduct.product.price} (base price)`, background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    try {
      await axios.put(`${BASE_URL}/api/storefront/agent/${userId}/products/${editingProduct.id}`, {
        customPrice: parseFloat(editPrice)
      }, { headers: getAuthHeaders() });
      
      Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
      setEditingProduct(null);
      setEditPrice('');
      fetchStorefrontData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to update price', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleRemoveProduct = async (productId) => {
    const result = await Swal.fire({
      title: 'Remove Product?',
      text: 'This will remove the product from your storefront',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/storefront/agent/${userId}/products/${productId}`, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Removed!', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
        fetchStorefrontData();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to remove product', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const handleToggleProduct = async (productId) => {
    try {
      await axios.patch(`${BASE_URL}/api/storefront/agent/${userId}/products/${productId}/toggle`, {}, { headers: getAuthHeaders() });
      fetchStorefrontData();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to toggle product', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  // Filter out products already in storefront, then apply search + carrier filter
  const availableToAdd = availableProducts
    .filter(p => !storefrontProducts.some(sp => sp.productId === p.id))
    .filter(p => {
      if (carrierFilter === 'all') return true;
      const name = (p.name || '').toLowerCase();
      if (carrierFilter === 'mtn') return name.includes('mtn');
      if (carrierFilter === 'airteltigo') return name.includes('airteltigo') || name.includes('airtel') || name.includes('tigo');
      if (carrierFilter === 'telecel') return name.includes('telecel') || name.includes('vodafone');
      return true;
    })
    .filter(p => {
      if (!productSearch.trim()) return true;
      const q = productSearch.trim().toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">My Storefront</h2>
              <p className="text-violet-100 text-xs sm:text-sm">Manage your products & commissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { fetchStorefrontData(); fetchReferralSummary(); fetchCommissionRequests(); }} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Store Link */}
        {storefrontSlug && (
          <div className="p-3 sm:p-4 bg-dark-900/50 border-b border-dark-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2 text-dark-300">
                <Link2 className="w-4 h-4" />
                <span className="text-sm">Your Store Link:</span>
              </div>
              <div className="flex-1 flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2 w-full sm:w-auto">
                <span className="text-violet-400 text-sm truncate flex-1">
                  {window.location.origin}/store/{storefrontSlug}
                </span>
                <button onClick={copyStoreLink} className="p-1.5 hover:bg-dark-700 rounded transition-colors" title="Copy link">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-dark-400" />}
                </button>
                <a href={`/store/${storefrontSlug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-dark-700 rounded transition-colors" title="Open store">
                  <ExternalLink className="w-4 h-4 text-dark-400" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 p-3 sm:p-4 bg-dark-900/30">
          <div className="bg-dark-800 border border-violet-500/30 rounded-xl p-3">
            <p className="text-violet-400 text-xs">Products Listed</p>
            <p className="text-xl font-bold text-white">{storefrontProducts.length}</p>
          </div>
          <div className="bg-dark-800 border border-cyan-500/30 rounded-xl p-3">
            <p className="text-cyan-400 text-xs">Total Orders</p>
            <p className="text-xl font-bold text-white">{referralSummary.stats.totalOrders || 0}</p>
          </div>
          <div className="bg-dark-800 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-emerald-400 text-xs">Total Commission</p>
            <p className="text-lg font-bold text-emerald-400">{formatAmount(referralSummary.stats.totalCommission || 0)}</p>
          </div>
          <div className="bg-dark-800 border border-amber-500/30 rounded-xl p-3">
            <p className="text-amber-400 text-xs">Unpaid Commission</p>
            <p className="text-lg font-bold text-amber-400">{formatAmount(referralSummary.stats.unpaidCommission || 0)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-3 border-b border-dark-700">
          <div className="flex bg-dark-700 rounded-xl p-1 w-full sm:w-auto">
            <button onClick={() => setActiveTab('products')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'products' ? 'bg-violet-500 text-white' : 'text-dark-300 hover:text-white'}`}>
              <Package className="w-4 h-4 inline mr-2" />Products
            </button>
            <button onClick={() => setActiveTab('earnings')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'earnings' ? 'bg-violet-500 text-white' : 'text-dark-300 hover:text-white'}`}>
              <TrendingUp className="w-4 h-4 inline mr-2" />Earnings
            </button>
            <button onClick={() => setActiveTab('commission-requests')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'commission-requests' ? 'bg-violet-500 text-white' : 'text-dark-300 hover:text-white'}`}>
              <FileText className="w-4 h-4 inline mr-2" />Requests
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : activeTab === 'products' ? (
            <div>
              {/* Add Product Button */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-semibold">Your Products</h3>
                <button onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
              </div>

              {/* Products Grid */}
              {storefrontProducts.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No products in your storefront yet</p>
                  <p className="text-dark-500 text-sm mt-1">Add products to start earning commissions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storefrontProducts.map((sp) => (
                    <div key={sp.id} className={`bg-dark-900/50 border rounded-xl p-4 transition-all ${sp.isActive ? 'border-dark-700 hover:border-violet-500/50' : 'border-dark-800 opacity-60'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-medium">{sp.product.name}</h4>
                        <button onClick={() => handleToggleProduct(sp.id)} className="p-1 hover:bg-dark-700 rounded" title={sp.isActive ? 'Hide' : 'Show'}>
                          {sp.isActive ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-dark-500" />}
                        </button>
                      </div>
                      <p className="text-dark-400 text-sm mb-3">{sp.product.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-dark-500 text-xs">Base Price</p>
                          <p className="text-dark-300 text-sm">{formatAmount(sp.product.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-dark-500 text-xs">Your Price</p>
                          <p className="text-violet-400 font-semibold">{formatAmount(sp.customPrice)}</p>
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 mb-3">
                        <p className="text-emerald-400 text-xs">Your Profit</p>
                        <p className="text-emerald-400 font-semibold">{formatAmount(sp.customPrice - sp.product.price)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setEditingProduct(sp); setEditPrice(sp.customPrice.toString()); }}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg text-sm transition-colors">
                          <Edit2 className="w-3 h-3" /> Edit Price
                        </button>
                        <button onClick={() => handleRemoveProduct(sp.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'earnings' ? (
            <div>
              <h3 className="text-white font-semibold mb-4">Referral Earnings</h3>
              
              {referralSummary.orders.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No referral orders yet</p>
                  <p className="text-dark-500 text-sm mt-1">Share your store link to start earning</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-900">
                      <tr className="text-left text-dark-400 text-sm">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Commission</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralSummary.orders.map((order) => (
                        <tr key={order.id} className="border-t border-dark-700 hover:bg-dark-800/50">
                          <td className="px-4 py-3 text-dark-300 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-white">{order.product?.name}</td>
                          <td className="px-4 py-3 text-dark-300">{order.customerName}</td>
                          <td className="px-4 py-3 text-cyan-400">{formatAmount(order.agentPrice)}</td>
                          <td className="px-4 py-3 text-emerald-400 font-medium">{formatAmount(order.commission)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              order.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                              order.paymentStatus === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {order.paymentStatus}
                            </span>
                            {order.commissionPaid && (
                              <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-violet-500/20 text-violet-400">
                                Commission Paid
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Banner */}
              <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-white font-semibold mb-1">Commission Requests</h4>
                    <p className="text-dark-300 text-sm">File a request for orders you served manually. Admin review and approve commission.</p>
                  </div>
                </div>
              </div>

              {/* Submit Form */}
              <div className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 sm:p-5">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Send className="w-5 h-5 text-violet-400" /> File New Request
                </h3>
                <form onSubmit={handleSubmitRequest} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-dark-300 text-sm mb-2 flex items-center gap-1.5">
                        <Phone className="w-4 h-4" /> Customer Phone
                      </label>
                      <input
                        type="tel"
                        value={requestForm.customerPhone}
                        onChange={(e) => setRequestForm({ ...requestForm, customerPhone: e.target.value })}
                        placeholder="0241234567"
                        className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4" /> Price (GHS)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={requestForm.price}
                        onChange={(e) => setRequestForm({ ...requestForm, price: e.target.value })}
                        placeholder="50.00"
                        className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2 flex items-center gap-1.5">
                        <Wifi className="w-4 h-4" /> Network
                      </label>
                      <select
                        value={requestForm.network}
                        onChange={(e) => setRequestForm({ ...requestForm, network: e.target.value })}
                        className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none"
                      >
                        {networkOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-dark-300 text-sm mb-2 flex items-center gap-1.5">
                        <Database className="w-4 h-4" /> Data Size
                      </label>
                      <input
                        type="text"
                        value={requestForm.dataSize}
                        onChange={(e) => setRequestForm({ ...requestForm, dataSize: e.target.value })}
                        placeholder="e.g., 5GB"
                        className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="w-full sm:w-auto px-6 py-2.5 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submittingRequest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Request
                  </button>
                </form>
              </div>

              {/* Requests History */}
              <div>
                <h3 className="text-white font-semibold mb-4">Your Requests</h3>
                {commissionRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                    <p className="text-dark-400">No commission requests yet</p>
                    <p className="text-dark-500 text-sm mt-1">Submit a request above for manual orders</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-dark-900">
                        <tr className="text-left text-dark-400 text-sm">
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Customer</th>
                          <th className="px-4 py-3">Network</th>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Price</th>
                          <th className="px-4 py-3">Commission</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionRequests.map((req) => (
                          <tr key={req.id} className="border-t border-dark-700 hover:bg-dark-800/50">
                            <td className="px-4 py-3 text-dark-300 text-sm">{new Date(req.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-white text-sm">{req.customerPhone}</td>
                            <td className="px-4 py-3 text-cyan-400 text-sm">{req.network}</td>
                            <td className="px-4 py-3 text-dark-300 text-sm">{req.dataSize}</td>
                            <td className="px-4 py-3 text-cyan-400 text-sm">{formatAmount(req.price)}</td>
                            <td className="px-4 py-3 text-emerald-400 font-medium text-sm">
                              {req.commission ? formatAmount(req.commission) : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                req.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' :
                                req.status === 'DECLINED' ? 'bg-red-500/20 text-red-400' :
                                'bg-amber-500/20 text-amber-400'
                              }`}>
                                {req.status}
                              </span>
                              {req.adminNotes && (
                                <p className="text-dark-500 text-xs mt-1" title={req.adminNotes}>
                                  Note: {req.adminNotes.length > 30 ? req.adminNotes.slice(0, 30) + '...' : req.adminNotes}
                                </p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Product Modal - Card Grid */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-60 p-0 sm:p-4">
          <div className="bg-dark-800 border-t sm:border border-dark-700 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4 sm:p-5 flex items-center justify-between sticky top-0 z-10">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">Add Product to Storefront</h3>
                <p className="text-violet-100 text-xs sm:text-sm mt-1">Select a product to add</p>
              </div>
              <button onClick={() => { setShowAddModal(false); setSelectedProduct(null); setCustomPrice(''); setProductSearch(''); setCarrierFilter('all'); }}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Search + Filters */}
            <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-2 border-b border-dark-700 bg-dark-900/40 sticky top-[64px] sm:top-[76px] z-10">
              <div className="relative mb-3">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full bg-dark-800 border border-dark-600 rounded-lg pl-10 pr-9 py-2.5 text-white text-sm placeholder-dark-500 focus:border-violet-500 focus:outline-none"
                />
                {productSearch && (
                  <button onClick={() => setProductSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-dark-700 rounded">
                    <X className="w-4 h-4 text-dark-400" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'All', color: 'violet' },
                  { key: 'mtn', label: 'MTN', color: 'amber' },
                  { key: 'airteltigo', label: 'AirtelTigo', color: 'red' },
                  { key: 'telecel', label: 'Telecel', color: 'cyan' }
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setCarrierFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      carrierFilter === f.key
                        ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
                        : 'bg-dark-800 border border-dark-600 text-dark-300 hover:text-white hover:border-violet-500/50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
                <span className="ml-auto text-dark-400 text-xs self-center">
                  {availableToAdd.length} product{availableToAdd.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {/* Products Grid */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1">
              {availableToAdd.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 sm:w-16 sm:h-16 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400 text-sm sm:text-base">No products available to add</p>
                  <p className="text-dark-500 text-xs sm:text-sm mt-1">All available products are already in your storefront</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {availableToAdd.map(product => (
                    <div key={product.id}
                      onClick={() => {
                        setSelectedProduct(product);
                        setCustomPrice(product.price.toString());
                      }}
                      className={`bg-dark-900/50 border rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
                        selectedProduct?.id === product.id 
                          ? 'border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/20' 
                          : 'border-dark-700 hover:border-violet-500/50'
                      }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold text-sm sm:text-base mb-1">{product.name}</h4>
                          <p className="text-dark-400 text-xs sm:text-sm line-clamp-2">{product.description}</p>
                        </div>
                        {selectedProduct?.id === product.id && (
                          <div className="ml-2 p-1 bg-violet-500 rounded-full">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="bg-dark-800 rounded-lg p-2.5 sm:p-3">
                        <p className="text-dark-500 text-xs mb-1">Base Price</p>
                        <p className="text-violet-400 font-bold text-base sm:text-lg">{formatAmount(product.price)}</p>
                      </div>
                      {product.stock > 0 && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                          <span className="text-emerald-400 text-xs">In Stock ({product.stock})</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Section - Price Input & Add Button */}
            {selectedProduct && (
              <div className="border-t border-dark-700 bg-dark-900/80 backdrop-blur p-4 sm:p-5 sticky bottom-0">
                <div className="max-w-2xl mx-auto">
                  <div className="bg-dark-800 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-medium text-sm sm:text-base">{selectedProduct.name}</p>
                        <p className="text-dark-400 text-xs sm:text-sm">Base: {formatAmount(selectedProduct.price)}</p>
                      </div>
                      <button onClick={() => { setSelectedProduct(null); setCustomPrice(''); }}
                        className="p-1.5 hover:bg-dark-700 rounded transition-colors">
                        <X className="w-4 h-4 text-dark-400" />
                      </button>
                    </div>
                    
                    <div className="mb-3">
                      <label className="block text-dark-300 text-xs sm:text-sm mb-2">Your Selling Price (GHS)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="w-full bg-dark-900 border border-dark-600 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-white text-sm sm:text-base focus:border-violet-500 focus:outline-none"
                        placeholder="Enter your price"
                      />
                    </div>

                    {parseFloat(customPrice) >= selectedProduct.price && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                        <p className="text-emerald-400 text-xs sm:text-sm">Your Commission per Sale</p>
                        <p className="text-emerald-400 font-bold text-lg sm:text-xl">{formatAmount(parseFloat(customPrice) - selectedProduct.price)}</p>
                      </div>
                    )}
                  </div>

                  <button onClick={handleAddProduct} disabled={addingProduct || !customPrice || parseFloat(customPrice) < selectedProduct.price}
                    className="w-full px-4 py-3 sm:py-3.5 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-semibold text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {addingProduct ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to Storefront
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Price Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-4">Edit Price</h3>
            
            <div className="bg-dark-900/50 rounded-lg p-3 mb-4">
              <p className="text-white font-medium">{editingProduct.product.name}</p>
              <p className="text-dark-400 text-sm">Base Price: {formatAmount(editingProduct.product.price)}</p>
            </div>

            <div className="mb-4">
              <label className="block text-dark-300 text-sm mb-2">New Selling Price (GHS)</label>
              <input
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            {parseFloat(editPrice) >= editingProduct.product.price && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4">
                <p className="text-emerald-400 text-sm">Your Commission per Sale</p>
                <p className="text-emerald-400 font-bold text-lg">{formatAmount(parseFloat(editPrice) - editingProduct.product.price)}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setEditingProduct(null); setEditPrice(''); }}
                className="flex-1 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg font-medium transition-colors">
                Cancel
              </button>
              <button onClick={handleUpdatePrice}
                className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors">
                Update Price
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Storefront;

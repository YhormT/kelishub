import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, Clock, XCircle, Package, RefreshCw, Download, X, Loader2, ChevronLeft, ChevronRight, Check, RotateCcw } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import BASE_URL from '../endpoints/endpoints';
import { io as socketIO } from 'socket.io-client';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const OrderTable = ({ isOpen, onClose }) => {
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(100);
  
  // Status counts from database
  const [statusCounts, setStatusCounts] = useState({ pending: 0, processing: 0, completed: 0, cancelled: 0 });
  
  // Filters
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [phoneNumberFilter, setPhoneNumberFilter] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');
  const [sourceFilter, setSourceFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef(null);
  

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        orderIdFilter: orderIdFilter || undefined,
        phoneNumberFilter: phoneNumberFilter || undefined,
        selectedProduct: selectedProduct || undefined,
        selectedStatusMain: selectedStatus || undefined,
        selectedDate: selectedDate || undefined,
        sortOrder: sortOrder
      };
      
      Object.keys(params).forEach(key => {
        if (params[key] === undefined || params[key] === '') delete params[key];
      });

      const response = await axios.get(`${BASE_URL}/order/admin/allorder`, {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        params
      });
      
      if (response.data?.data) {
        setAllItems(response.data.data);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalItems(response.data.pagination?.total || response.data.data.length);
        // Use statusCounts from API response
        if (response.data.statusCounts) {
          setStatusCounts(response.data.statusCounts);
        }
      } else {
        const ordersData = Array.isArray(response.data) ? response.data : [];
        setAllItems(ordersData);
        setTotalPages(Math.ceil(ordersData.length / itemsPerPage));
        setTotalItems(ordersData.length);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, orderIdFilter, phoneNumberFilter, selectedProduct, selectedStatus, selectedDate, sortOrder]);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

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

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Auto-refresh effect
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh && isOpen) {
      intervalRef.current = setInterval(fetchOrders, 30000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, isOpen, fetchOrders]);

  // Real-time order notifications via socket
  useEffect(() => {
    if (!isOpen) return;
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });
    socket.on('new-order', () => {
      fetchOrders();
    });
    return () => socket.disconnect();
  }, [isOpen, fetchOrders]);

  const resetFilters = () => {
    setOrderIdFilter('');
    setPhoneNumberFilter('');
    setSelectedProduct('');
    setSelectedStatus('');
    setSelectedDate('');
    setSortOrder('newest');
    setSourceFilter('');
    setStartTime('');
    setEndTime('');
    setCurrentPage(1);
  };

  // Filter items by source (shop/dashboard) and time
  const filteredItems = allItems.filter(item => {
    // Source filter
    if (sourceFilter) {
      const userName = item.user?.name?.toLowerCase() || '';
      const userEmail = item.user?.email?.toLowerCase() || '';
      if (sourceFilter === 'shop') {
        if (userName !== 'shop' && !userEmail.includes('shop@')) return false;
      } else if (sourceFilter === 'dashboard') {
        if (userName === 'shop' || userEmail.includes('shop@')) return false;
      }
    }
    // Time filter
    if (selectedDate && (startTime || endTime)) {
      const orderDate = new Date(item.order?.createdAt);
      const orderTime = orderDate.toTimeString().slice(0, 5);
      if (startTime && orderTime < startTime) return false;
      if (endTime && orderTime > endTime) return false;
    }
    return true;
  });

  const handleProcessOrder = async (orderItemId, status) => {
    // Always update only the single clicked item
    try {
      Swal.fire({ title: 'Processing...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#1e293b', color: '#f1f5f9' });
      await axios.post(`${BASE_URL}/order/admin/process/order`, { orderItemId, status }, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Status Updated', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      fetchOrders();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Update Failed', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleBatchComplete = async () => {
    if (statusCounts.processing === 0) {
      Swal.fire({ icon: 'info', title: 'No Processing Orders', text: 'There are no orders with Processing status to complete.', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    const hasFilters = selectedDate || startTime || endTime || selectedProduct || sourceFilter || phoneNumberFilter || orderIdFilter;
    const promptText = hasFilters
      ? 'Complete filtered processing orders only?'
      : `Complete ALL ${statusCounts.processing} processing orders in the database?`;
    const { isConfirmed } = await Swal.fire({
      icon: 'question', title: 'Batch Complete',
      text: promptText,
      showCancelButton: true, background: '#1e293b', color: '#f1f5f9'
    });
    if (!isConfirmed) return;
    try {
      Swal.fire({ title: 'Completing processing orders...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#1e293b', color: '#f1f5f9' });
      const filters = {
        selectedProduct: selectedProduct || undefined,
        selectedDate: selectedDate || undefined,
        sourceFilter: sourceFilter || undefined,
        phoneNumberFilter: phoneNumberFilter || undefined,
        orderIdFilter: orderIdFilter || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined
      };
      Object.keys(filters).forEach(key => { if (filters[key] === undefined) delete filters[key]; });
      const response = await axios.post(`${BASE_URL}/order/admin/batch-complete`, filters, { headers: getAuthHeaders() });
      Swal.fire({ icon: 'success', title: 'Batch Complete', text: response.data.message, timer: 2000, background: '#1e293b', color: '#f1f5f9' });
      fetchOrders();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: error.response?.data?.message || error.message, background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleDownloadExcel = async () => {
    try {
      Swal.fire({ title: 'Fetching orders...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), background: '#1e293b', color: '#f1f5f9' });

      const params = {
        statusFilter: selectedStatus || undefined,
        selectedProduct: selectedProduct || undefined,
        selectedDate: selectedDate || undefined,
        sortOrder: sortOrder,
        sourceFilter: sourceFilter || undefined,
        phoneNumberFilter: phoneNumberFilter || undefined,
        orderIdFilter: orderIdFilter || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined
      };
      Object.keys(params).forEach(key => { if (params[key] === undefined) delete params[key]; });

      const response = await axios.get(`${BASE_URL}/order/admin/download-excel`, {
        headers: getAuthHeaders(),
        params,
        timeout: 120000
      });

      const { items, updatedCount } = response.data;

      if (!items || items.length === 0) {
        Swal.fire({ icon: 'warning', title: 'No Orders Available', background: '#1e293b', color: '#f1f5f9' });
        return;
      }

      const dataToExport = items.map(item => {
        let phone = item?.mobileNumber || 'N/A';
        if (phone.startsWith('233')) phone = '0' + phone.substring(3);
        return { 'Phone Number': phone, 'Data Size': item.product?.description?.replace(/\D+$/, '') || 'N/A' };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      XLSX.writeFile(wb, `Orders_${new Date().toISOString().slice(0, 10)}.xlsx`);

      const msg = updatedCount > 0 ? `Downloaded ${items.length} orders. ${updatedCount} pending orders updated to Processing.` : `Downloaded ${items.length} orders.`;
      Swal.fire({ icon: 'success', title: 'Download Complete', text: msg, timer: 3000, background: '#1e293b', color: '#f1f5f9' });
      fetchOrders();
    } catch (error) {
      console.error('Download error:', error);
      Swal.fire({ icon: 'error', title: 'Download Failed', text: error.response?.data?.error || error.message, background: '#1e293b', color: '#f1f5f9' });
    }
  };

  // Use database counts instead of local filtering
  const stats = statusCounts;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center py-2 sm:py-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-[98vw] xl:max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-3 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Package className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            <div>
              <h2 className="text-base sm:text-xl font-bold text-white">Order Management</h2>
              <p className="text-purple-100 text-xs sm:text-sm">{allItems.length} orders loaded</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="hidden sm:flex items-center gap-2 text-white text-sm">
              <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)} className="rounded" />
              Auto-refresh
            </label>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Stats & Actions */}
        <div className="p-2 sm:p-4 border-b border-dark-700 flex flex-col sm:flex-row flex-wrap justify-between items-start sm:items-center gap-2 sm:gap-3">
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg sm:rounded-xl text-xs sm:text-sm">
              <span className="text-amber-400 font-bold">{stats.pending}</span>
              <span className="text-dark-400 ml-1 sm:ml-2">Pending</span>
            </div>
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg sm:rounded-xl text-xs sm:text-sm">
              <span className="text-cyan-400 font-bold">{stats.processing}</span>
              <span className="text-dark-400 ml-1 sm:ml-2">Processing</span>
            </div>
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg sm:rounded-xl text-xs sm:text-sm">
              <span className="text-emerald-400 font-bold">{stats.completed}</span>
              <span className="text-dark-400 ml-1 sm:ml-2">Completed</span>
            </div>
            <div className="px-2 sm:px-4 py-1.5 sm:py-2 bg-red-500/10 border border-red-500/20 rounded-lg sm:rounded-xl text-xs sm:text-sm">
              <span className="text-red-400 font-bold">{stats.cancelled}</span>
              <span className="text-dark-400 ml-1 sm:ml-2">Cancelled</span>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={handleBatchComplete} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Check className="w-4 h-4" /> <span className="hidden sm:inline">Complete All</span><span className="sm:hidden">Complete</span>
            </button>
            <button onClick={handleDownloadExcel} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download Excel</span><span className="sm:hidden">Excel</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-2 sm:p-4 border-b border-dark-700">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            <input
              type="text"
              value={orderIdFilter}
              onChange={(e) => { setOrderIdFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Order ID..."
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-purple-500 focus:outline-none"
            />
            <input
              type="text"
              value={phoneNumberFilter}
              onChange={(e) => { setPhoneNumberFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Phone..."
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-500 focus:border-purple-500 focus:outline-none"
            />
            <select
              value={selectedProduct}
              onChange={(e) => { setSelectedProduct(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Products</option>
                  <option value="MTN">MTN</option>
                  <option value="MTN - PREMIUM">MTN - PREMIUM</option>
                  <option value="MTN - SUPER">MTN - SUPER</option>
                  <option value="MTN - NORMAL">MTN - NORMAL</option>
                  <option value="MTN - OTHER">MTN - OTHER</option>
                  <option value="TELECEL">TELECEL</option>
                  <option value="TELECEL - PREMIUM">TELECEL - PREMIUM</option>
                  <option value="TELECEL - SUPER">TELECEL - SUPER</option>
                  <option value="TELECEL - NORMAL">TELECEL - NORMAL</option>
                  <option value="TELECEL - OTHER">TELECEL - OTHER</option>
                  <option value="AIRTEL TIGO">AIRTEL TIGO</option>
                  <option value="AIRTEL TIGO - PREMIUM">AIRTEL TIGO - PREMIUM</option>
                  <option value="AIRTEL TIGO - SUPER">AIRTEL TIGO - SUPER</option>
                  <option value="AIRTEL TIGO - NORMAL">AIRTEL TIGO - NORMAL</option>
                  <option value="AIRTEL TIGO - OTHER">AIRTEL TIGO - OTHER</option>
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Processing">Processing</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="">All Sources</option>
              <option value="shop">Shop Orders</option>
              <option value="dashboard">Dashboard Orders</option>
            </select>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              title="Date"
            />
            <input
              type="time"
              value={startTime}
              onChange={(e) => { setStartTime(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              title="Start Time"
              placeholder="Start"
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => { setEndTime(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
              title="End Time"
              placeholder="End"
            />
            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
              className="bg-dark-900/50 border border-dark-600 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <div className="flex gap-1 col-span-2 sm:col-span-1">
              <button onClick={resetFilters} className="flex-1 sm:flex-none p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300" title="Reset">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={fetchOrders} className="flex-1 sm:flex-none p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300" title="Refresh">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Table/Cards */}
        <div className="flex-1 overflow-auto p-2 sm:p-4 relative min-h-[50vh]">
          {loading && (
            <div className="absolute inset-0 bg-dark-800/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          )}
          {filteredItems.length === 0 && !loading ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400">No orders found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-2">
                {filteredItems.map((item) => {
                  const status = item.order?.items?.[0]?.status || 'N/A';
                  const isCancelled = status === 'Cancelled' || status === 'Canceled';
                  const productName = item.product?.name?.toUpperCase() || '';
                  const isMTN = productName.includes('MTN');
                  const isTelecel = productName.includes('TELECEL');
                  const isAirtelTigo = productName.includes('AIRTEL') || productName.includes('TIGO');
                  
                  // Card background color based on product (cancelled takes priority)
                  const cardBgColor = isCancelled 
                    ? 'border-red-500/30 bg-red-900/10' 
                    : isMTN 
                      ? 'border-yellow-500/30 bg-yellow-500/10' 
                      : isTelecel 
                        ? 'border-rose-500/30 bg-rose-500/10' 
                        : isAirtelTigo 
                          ? 'border-blue-500/30 bg-blue-500/10' 
                          : '';
                  return (
                    <div key={`mobile-${item.id}-${item.orderId}`} className={`bg-dark-900/50 border border-dark-700 rounded-xl p-3 ${cardBgColor}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-semibold text-sm">#{item.orderId || 'N/A'}</p>
                          <p className="text-dark-400 text-xs">{item.user?.name || 'N/A'}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                          {getStatusIcon(status)}
                          {status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                        <div><span className="text-dark-500">Phone:</span> <span className="text-dark-300">{item.mobileNumber?.startsWith('233') ? '0' + item.mobileNumber.substring(3) : (item.mobileNumber || 'N/A')}</span></div>
                        <div><span className="text-dark-500">Product:</span> <span className="text-dark-300">{item.product?.name || 'N/A'}</span></div>
                        <div><span className="text-dark-500">Data:</span> <span className="text-cyan-400 font-semibold">{item.product?.description?.replace(/\D+$/, '') || 'N/A'} GB</span></div>
                        <div><span className="text-dark-500">Price:</span> <span className="text-emerald-400 font-medium">GHS {item.product?.price || 0}</span></div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-dark-700">
                        <p className="text-dark-500 text-xs">{formatDate(item.order?.createdAt)}</p>
                        <div className="flex gap-1">
                          {(status === 'Pending' || status === 'Completed') && (
                            <button onClick={() => handleProcessOrder(item.id, 'Processing')} className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg"><Clock className="w-4 h-4" /></button>
                          )}
                          {(status === 'Pending' || status === 'Processing') && (
                            <button onClick={() => handleProcessOrder(item.id, 'Completed')} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><CheckCircle className="w-4 h-4" /></button>
                          )}
                          {!isCancelled && (status === 'Pending' || status === 'Processing') && (
                            <button onClick={() => handleProcessOrder(item.id, 'Cancelled')} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg"><XCircle className="w-4 h-4" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Desktop Table View */}
              <table className="w-full hidden sm:table">
                <thead className="sticky top-0 bg-dark-800">
                  <tr className="text-left text-dark-400 text-sm border-b border-dark-700">
                    <th className="pb-3 font-medium">Order ID</th>
                    <th className="pb-3 font-medium">Customer</th>
                    <th className="pb-3 font-medium">Mobile</th>
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium">Data</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Source</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Price</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const status = item.order?.items?.[0]?.status || 'N/A';
                    const isCancelled = status === 'Cancelled' || status === 'Canceled';
                    const productName = item.product?.name?.toUpperCase() || '';
                    const isMTN = productName.includes('MTN');
                    const isTelecel = productName.includes('TELECEL');
                    const isAirtelTigo = productName.includes('AIRTEL') || productName.includes('TIGO');
                    
                    // Row background color based on product (cancelled takes priority)
                    const rowBgColor = isCancelled 
                      ? 'bg-red-900/20' 
                      : isMTN 
                        ? 'bg-yellow-500/10' 
                        : isTelecel 
                          ? 'bg-rose-500/10' 
                          : isAirtelTigo 
                            ? 'bg-blue-500/10' 
                            : '';
                    return (
                      <tr key={`${item.id}-${item.orderId}`} className={`border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors ${rowBgColor}`}>
                        <td className="py-3 text-white font-medium">#{item.orderId || 'N/A'}</td>
                        <td className="py-3 text-dark-300">{item.user?.name || 'N/A'}</td>
                        <td className="py-3 text-dark-300">{item.mobileNumber?.startsWith('233') ? '0' + item.mobileNumber.substring(3) : (item.mobileNumber || 'N/A')}</td>
                        <td className="py-3 text-dark-400">{item.product?.name || 'N/A'}</td>
                        <td className="py-3 text-cyan-400 font-semibold">{item.product?.description?.replace(/\D+$/, '') || 'N/A'} GB</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                            {getStatusIcon(status)}
                            {status}
                          </span>
                        </td>
                        <td className="py-3">
                          {(item.user?.name?.toLowerCase() === 'shop' || item.user?.email?.toLowerCase().includes('shop@')) ? (
                            <span className="px-2 py-1 bg-orange-500/10 text-orange-400 rounded-full text-xs font-medium">Shop</span>
                          ) : (
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-full text-xs font-medium">Dashboard</span>
                          )}
                        </td>
                        <td className="py-3 text-dark-500 text-sm">{formatDate(item.order?.createdAt)}</td>
                        <td className="py-3 text-emerald-400 font-medium">GHS {item.product?.price || 0}</td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {(status === 'Pending' || status === 'Completed') && (
                              <button onClick={() => handleProcessOrder(item.id, 'Processing')} className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20" title="Mark Processing"><Clock className="w-4 h-4" /></button>
                            )}
                            {(status === 'Pending' || status === 'Processing') && (
                              <button onClick={() => handleProcessOrder(item.id, 'Completed')} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20" title="Mark Complete"><CheckCircle className="w-4 h-4" /></button>
                            )}
                            {!isCancelled && (status === 'Pending' || status === 'Processing') && (
                              <button onClick={() => handleProcessOrder(item.id, 'Cancelled')} className="p-1.5 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20" title="Cancel Order"><XCircle className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-2 sm:p-4 border-t border-dark-700 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-dark-400 text-xs sm:text-sm text-center sm:text-left">
              Page {currentPage} of {totalPages} ({totalItems} items)
            </p>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="px-2 sm:px-4 py-1 sm:py-2 text-white text-sm">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default OrderTable;

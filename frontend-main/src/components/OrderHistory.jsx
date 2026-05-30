import React, { useState, useMemo } from 'react';
import { X, Search, Phone, Clock, Package, CreditCard, MessageCircle, Filter, ChevronRight, Calendar, User, DollarSign, XCircle, Download } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import BASE_URL from '../endpoints/endpoints';

const StatusBadge = ({ status }) => {
  const config = {
    Pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
    Processing: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', dot: 'bg-cyan-500' },
    Completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
    Cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' }
  };
  const c = config[status] || config.Cancelled;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
};

const OrderHistory = ({ isOpen, onClose, orderHistory = [], onOrderCancelled }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { filteredItems, stats } = useMemo(() => {
    let items = [];
    
    (Array.isArray(orderHistory) ? orderHistory : []).forEach(order => {
      (order.items || []).forEach(item => {
        items.push({ ...item, order });
      });
    });

    // Apply filters
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      items = items.filter(item => 
        item.mobileNumber?.includes(search) ||
        item.product?.name?.toLowerCase().includes(search) ||
        item.order?.id?.toString().includes(search)
      );
    }
    
    if (statusFilter) {
      items = items.filter(item => item.status === statusFilter);
    }

    // Apply date filters
    if (startDate) {
      items = items.filter(item => {
        const orderDate = new Date(item.order?.createdAt);
        return orderDate >= new Date(startDate);
      });
    }
    
    if (endDate) {
      items = items.filter(item => {
        const orderDate = new Date(item.order?.createdAt);
        return orderDate <= new Date(endDate + 'T23:59:59');
      });
    }

    // Calculate stats
    let totalGB = 0;
    items.forEach(item => {
      const description = item.product?.description || '';
      const match = description.match(/(\d+(?:\.\d+)?)\s*GB/i);
      if (match) totalGB += parseFloat(match[1]);
    });
    
    const stats = {
      total: items.length,
      pending: items.filter(i => i.status === 'Pending').length,
      completed: items.filter(i => i.status === 'Completed').length,
      totalAmount: items.reduce((sum, i) => sum + (i.productPrice != null ? i.productPrice : (i.product?.price || 0)), 0),
      totalGB
    };

    return { filteredItems: items, stats };
  }, [orderHistory, searchTerm, statusFilter, startDate, endDate]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleCancelOrder = async (item, order) => {
    const result = await Swal.fire({
      title: 'Cancel Order?',
      text: `Cancel item #${item.id} (${item.product?.name || 'Unknown'})? Your wallet will be refunded.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
      confirmButtonText: 'Yes, Cancel',
      background: '#1e293b',
      color: '#f1f5f9'
    });
    if (!result.isConfirmed) return;
    try {
      const userId = localStorage.getItem('userId');
      const res = await axios.post(`${BASE_URL}/order/cancel/${userId}/${item.id}`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      Swal.fire({ icon: 'success', title: 'Order Cancelled', text: `Refund of GHS ${res.data.refundAmount?.toFixed(2) || '0.00'} processed.`, timer: 2500, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
      if (onOrderCancelled) onOrderCancelled();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Cancel Failed', text: error.response?.data?.error || 'Failed to cancel order', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const openWhatsApp = (item, order) => {
    const url = `https://wa.me/233540277583?text=${encodeURIComponent(
      `Hello, I have a complaint about my order:\n\n` +
      `Order ID: ${order.id}\n` +
      `Item ID: ${item.id}\n` +
      `Phone: ${item.mobileNumber || 'N/A'}\n` +
      `Date: ${new Date(order.createdAt).toLocaleDateString()}\n` +
      `Item: ${item.product?.name || 'Unknown'}\n` +
      `Bundle: ${item.product?.description || 'Unknown'}\n` +
      `Status: ${item.status}\n\n` +
      `Please assist me with this order.`
    )}`;
    window.open(url, '_blank');
  };

  const downloadExcel = () => {
    if (filteredItems.length === 0) {
      Swal.fire({ icon: 'warning', title: 'No Orders', text: 'No orders to download.', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    const dataToExport = filteredItems.map((item, idx) => {
      let phone = item.mobileNumber || 'N/A';
      if (phone.startsWith('233')) phone = '0' + phone.substring(3);
      return {
        '#': idx + 1,
        'Order ID': item.order?.id || 'N/A',
        'Item ID': item.id || 'N/A',
        'Date': item.order?.createdAt ? new Date(item.order.createdAt).toLocaleString() : 'N/A',
        'Network': item.product?.name || item.productName || 'N/A',
        'Data Size': item.product?.description || item.productDescription || 'N/A',
        'Phone Number': phone,
        'Price (GHS)': (item.productPrice != null ? item.productPrice : item.product?.price)?.toFixed(2) || '0.00',
        'Status': item.status || 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    // Set column widths
    ws['!cols'] = [
      { wch: 5 }, { wch: 10 }, { wch: 10 }, { wch: 22 },
      { wch: 18 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order History');
    XLSX.writeFile(wb, `Order_History_${new Date().toISOString().slice(0, 10)}.xlsx`);

    Swal.fire({ icon: 'success', title: 'Downloaded!', text: `${dataToExport.length} orders exported.`, timer: 2000, showConfirmButton: false, background: '#1e293b', color: '#f1f5f9' });
  };

  if (!isOpen) return null;

  // Order Detail Modal Component
  const OrderDetailModal = ({ item, order, onClose }) => {
    if (!item || !order) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-0 sm:p-4" onClick={onClose}>
        <div 
          className="bg-dark-800 border-0 sm:border sm:border-dark-700 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-white">Order Details</h3>
                <p className="text-white/80 text-xs sm:text-sm">Order #{order.id} - Item #{item.id}</p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <StatusBadge status={item.status} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Product Information */}
            <div className="bg-dark-900/50 border border-dark-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Product Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Product:</span>
                  <span className="text-white font-medium">{item.product?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Bundle:</span>
                  <span className="text-white font-medium">{item.product?.description || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Price:</span>
                  <span className="text-emerald-400 font-bold">GHS {(item.productPrice != null ? item.productPrice : item.product?.price)?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-dark-900/50 border border-dark-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Customer Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Mobile Number:</span>
                  <span className="text-white font-medium">{item.mobileNumber || 'N/A'}</span>
                </div>
                {order.userId && (
                  <div className="flex justify-between">
                    <span className="text-dark-400">User ID:</span>
                    <span className="text-white font-medium">#{order.userId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Information */}
            <div className="bg-dark-900/50 border border-dark-700 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Order Information
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-400">Order Date:</span>
                  <span className="text-white font-medium">{new Date(order.createdAt).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Last Updated:</span>
                  <span className="text-white font-medium">
                    {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : (order.updatedAt ? new Date(order.updatedAt).toLocaleString() : 'Not yet updated')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dark-400">Payment Method:</span>
                  <span className="text-white font-medium">Agent Wallet</span>
                </div>
                {order.transactionRef && (
                  <div className="flex justify-between">
                    <span className="text-dark-400">Transaction Ref:</span>
                    <span className="text-white font-medium text-xs break-all">{order.transactionRef}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Total Amount */}
            <div className="bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span className="text-dark-300 font-medium">Total Amount</span>
                </div>
                <span className="text-2xl font-bold text-emerald-400">GHS {order.totalAmount?.toFixed(2) || (item.productPrice != null ? item.productPrice : item.product?.price)?.toFixed(2) || '0.00'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {item.status === 'Pending' && (
              <button
                onClick={() => {
                  handleCancelOrder(item, order);
                  onClose();
                }}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-5 h-5" />
                Cancel Order
              </button>
            )}
            {item.status === 'Completed' && (
              <button
                onClick={() => {
                  openWhatsApp(item, order);
                  onClose();
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" />
                Report an Issue
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-dark-800 border-0 sm:border sm:border-dark-700 rounded-none sm:rounded-2xl shadow-2xl w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Order History</h2>
              <p className="text-white/80 text-sm">{stats.total} orders found</p>
            </div>
            <div className="flex gap-2">
              <button onClick={downloadExcel} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors" title="Download Excel">
                <Download className="w-5 h-5 text-white" />
              </button>
              <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 sm:p-3">
              <p className="text-white/70 text-[10px] sm:text-xs">Total Orders</p>
              <p className="text-lg sm:text-xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 sm:p-3">
              <p className="text-white/70 text-[10px] sm:text-xs">Pending</p>
              <p className="text-lg sm:text-xl font-bold text-amber-300">{stats.pending}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 sm:p-3">
              <p className="text-white/70 text-[10px] sm:text-xs">Completed</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-300">{stats.completed}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 sm:p-3 hidden sm:block">
              <p className="text-white/70 text-[10px] sm:text-xs">Total GB</p>
              <p className="text-lg sm:text-xl font-bold text-cyan-300">{stats.totalGB.toFixed(1)}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 sm:p-3 hidden sm:block">
              <p className="text-white/70 text-[10px] sm:text-xs">Total Amount</p>
              <p className="text-base sm:text-xl font-bold text-white truncate">GHS {stats.totalAmount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-2.5 col-span-3 sm:hidden">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-white/70 text-[10px]">Total GB</p>
                  <p className="text-lg font-bold text-cyan-300">{stats.totalGB.toFixed(1)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-[10px]">Total Amount</p>
                  <p className="text-base font-bold text-white">GHS {stats.totalAmount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-dark-700 bg-dark-900/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search by phone, product, or order ID..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-10 pr-4 py-2 text-white text-sm placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
          {/* Status and Date Filters - all on one line on mobile */}
          <div className="grid grid-cols-3 gap-2">
            <div className="relative">
              <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-dark-500" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-7 sm:pl-10 pr-2 py-2 text-white text-xs sm:text-sm focus:border-cyan-500 focus:outline-none appearance-none"
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Processing">Processing</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-dark-500" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-7 sm:pl-10 pr-2 py-2 text-white text-xs sm:text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-dark-500" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="w-full bg-dark-800 border border-dark-600 rounded-xl pl-7 sm:pl-10 pr-2 py-2 text-white text-xs sm:text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-4">
          {paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="w-16 h-16 text-dark-600 mb-4" />
              <h3 className="text-lg font-semibold text-dark-400">No orders found</h3>
              <p className="text-dark-500 text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginatedItems.map((item, idx) => (
                <div 
                  key={`${item.order?.id}-${item.id}-${idx}`} 
                  className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-cyan-500/50 hover:bg-dark-900 transition-all cursor-pointer group"
                  onClick={() => setSelectedOrder({ item, order: item.order })}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-dark-500 mb-1">
                        <span>#{item.order?.id || 'N/A'}</span>
                        <span className="w-1 h-1 rounded-full bg-dark-600" />
                        <span>Item #{item.id || 'N/A'}</span>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      {item.status === 'Pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelOrder(item, item.order); }}
                          className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                      <ChevronRight className="w-5 h-5 text-dark-600 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-cyan-500" />
                      <span className="text-dark-300 truncate">{item.mobileNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500" />
                      <span className="text-dark-300 truncate text-xs">
                        {new Date(item.order?.createdAt).toLocaleDateString()} {new Date(item.order?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                      <Package className="w-4 h-4 text-amber-500" />
                      <span className="text-dark-300 truncate">{item.product?.name || 'Unknown'} - {item.product?.description || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-500" />
                      <span className="text-dark-300 truncate">GHS {(item.productPrice != null ? item.productPrice : item.product?.price) || '0'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-dark-700 flex items-center justify-between">
            <p className="text-dark-400 text-xs sm:text-sm">
              {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-dark-700 text-dark-300 rounded-lg text-sm hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >Prev</button>
              <span className="text-dark-400 text-sm">{currentPage}/{totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-dark-700 text-dark-300 rounded-lg text-sm hover:bg-dark-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >Next</button>
            </div>
          </div>
        )}

        {/* Order Detail Modal */}
        {selectedOrder && (
          <OrderDetailModal 
            item={selectedOrder.item}
            order={selectedOrder.order}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </div>
    </div>
  );
};

export default OrderHistory;

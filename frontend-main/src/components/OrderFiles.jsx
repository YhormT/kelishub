import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';
import getSocket from '../utils/socket';
import { FileText, Download, ChevronLeft, RefreshCw, Loader2, Search, X, CheckCircle, Clock, XCircle } from 'lucide-react';
import Swal from 'sweetalert2';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const statusColors = {
  Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const statusIcons = {
  Pending: Clock,
  Processing: Loader2,
  Completed: CheckCircle,
  Cancelled: XCircle,
};

const swalDarkSelect = {
  customClass: { input: 'swal2-dark-select' },
  didOpen: () => {
    const s = Swal.getInput();
    if (s) { s.style.backgroundColor = '#0f172a'; s.style.color = '#fff'; s.style.border = '1px solid #334155'; s.style.padding = '8px 12px'; s.style.borderRadius = '8px'; }
  },
};

const networkColors = {
  MTN: { bg: 'from-yellow-500/10 to-yellow-600/10', border: 'border-yellow-500/30', text: 'text-yellow-400', btn: 'from-yellow-500 to-yellow-600' },
  TELECEL: { bg: 'from-red-500/10 to-red-600/10', border: 'border-red-500/30', text: 'text-red-400', btn: 'from-red-500 to-red-600' },
  'AIRTEL TIGO': { bg: 'from-blue-500/10 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400', btn: 'from-blue-500 to-blue-600' },
};

const OrderFiles = () => {
  const [batches, setBatches] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const perPage = 15;

  const fetchBatches = useCallback(async (targetPage = page, isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const [batchRes, countRes] = await Promise.all([
        axios.get(`${BASE_URL}/order/admin/batches`, { headers: getAuthHeaders(), params: { page: targetPage, limit: perPage } }),
        axios.get(`${BASE_URL}/order/admin/batches/pending-counts`, { headers: getAuthHeaders() }),
      ]);
      if (batchRes.data.success) {
        setBatches(batchRes.data.batches);
        if (batchRes.data.pagination) {
          setPagination(batchRes.data.pagination);
          setPage(batchRes.data.pagination.page);
        }
      }
      if (countRes.data.success) setPendingCounts(countRes.data.counts);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [page]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchBatches(1); }, []);

  // WebSocket: auto-refresh when new orders are submitted
  useEffect(() => {
    const socket = getSocket();
    const handleNewOrder = () => {
      // Refresh both pending counts AND batches list instantly when a new order arrives
      fetchBatches(page, true);
    };
    socket.on('new-order', handleNewOrder);
    return () => { socket.off('new-order', handleNewOrder); };
  }, [fetchBatches, page]);

  // Background periodic refresh every 30 seconds (safety net for missed socket events)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBatches(page, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchBatches, page]);

  const fetchBatchDetail = async (batchId) => {
    try {
      setDetailLoading(true);
      const res = await axios.get(`${BASE_URL}/order/admin/batches/${batchId}`, { headers: getAuthHeaders() });
      if (res.data.success) { setBatchDetail(res.data.batch); setSelectedBatch(batchId); }
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to load batch details', icon: 'error', background: '#1a1a2e', color: '#fff' });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportNetwork = async (network) => {
    const count = pendingCounts[network]?.count || 0;
    if (count === 0) {
      Swal.fire({ title: 'No Pending Orders', text: `No pending orders for ${network}`, icon: 'info', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#06b6d4' });
      return;
    }

    const confirm = await Swal.fire({
      title: `Export ${network} Orders`,
      html: `<p style="color:#94a3b8">Download <b style="color:#fff">${count}</b> pending ${network} orders as Excel?</p><p style="color:#94a3b8;margin-top:8px">This will create a batch and set orders to Processing.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Export & Download',
      confirmButtonColor: '#06b6d4',
      background: '#1a1a2e',
      color: '#fff',
    });
    if (!confirm.isConfirmed) return;

    try {
      setExporting(network);
      const res = await axios.post(`${BASE_URL}/order/admin/batches/export`, { network }, {
        headers: getAuthHeaders(),
        responseType: 'blob',
      });

      const contentDisp = res.headers['content-disposition'];
      let filename = `${network}_export.xlsx`;
      if (contentDisp) {
        const match = contentDisp.match(/filename=(.+)/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      Swal.fire({ title: 'Exported', text: `${count} ${network} orders exported & set to Processing`, icon: 'success', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#06b6d4', timer: 2000 });
      fetchBatches(1, true);
    } catch (err) {
      const msg = err.response?.status === 404 ? `No pending orders for ${network}` : 'Export failed';
      Swal.fire({ title: 'Error', text: msg, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } finally {
      setExporting(null);
    }
  };

  const handleBulkStatusUpdate = async (batchId) => {
    const { value: status } = await Swal.fire({
      title: 'Update All Orders in Batch',
      input: 'select',
      inputOptions: { Pending: 'Pending', Processing: 'Processing', Completed: 'Completed', Cancelled: 'Cancelled (Auto-Refund)' },
      inputPlaceholder: 'Select new status',
      showCancelButton: true, confirmButtonText: 'Update All', confirmButtonColor: '#06b6d4',
      background: '#1a1a2e', color: '#fff', ...swalDarkSelect,
      inputValidator: (v) => { if (!v) return 'Please select a status'; },
    });
    if (!status) return;

    if (status === 'Cancelled') {
      const c = await Swal.fire({ title: 'Confirm Cancellation', text: 'This will cancel ALL orders and auto-refund agents.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, Cancel & Refund', confirmButtonColor: '#ef4444', background: '#1a1a2e', color: '#fff' });
      if (!c.isConfirmed) return;
    }

    try {
      setStatusUpdateLoading(true);
      const res = await axios.put(`${BASE_URL}/order/admin/batches/${batchId}/status`, { status }, { headers: getAuthHeaders() });
      if (res.data.success) {
        Swal.fire({ title: 'Updated', text: res.data.message, icon: 'success', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#06b6d4' });
        fetchBatches(page, true);
        if (selectedBatch === batchId) fetchBatchDetail(batchId);
      }
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed to update status', icon: 'error', background: '#1a1a2e', color: '#fff' });
    } finally {
      setStatusUpdateLoading(false);
    }
  };

  const handleSingleItemStatusUpdate = async (batchId, itemId, currentStatus) => {
    const { value: status } = await Swal.fire({
      title: `Update Item #${itemId}`,
      input: 'select',
      inputOptions: { Pending: 'Pending', Processing: 'Processing', Completed: 'Completed', Cancelled: 'Cancelled (Auto-Refund)' },
      inputValue: currentStatus,
      showCancelButton: true, confirmButtonText: 'Update', confirmButtonColor: '#06b6d4',
      background: '#1a1a2e', color: '#fff', ...swalDarkSelect,
    });
    if (!status || status === currentStatus) return;

    if (status === 'Cancelled') {
      const c = await Swal.fire({ title: 'Confirm Cancellation', text: 'This will cancel this item and auto-refund the agent.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, Cancel & Refund', confirmButtonColor: '#ef4444', background: '#1a1a2e', color: '#fff' });
      if (!c.isConfirmed) return;
    }

    try {
      await axios.put(`${BASE_URL}/order/admin/batches/${batchId}/items/${itemId}/status`, { status }, { headers: getAuthHeaders() });
      fetchBatchDetail(batchId);
      fetchBatches(page, true);
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.response?.data?.message || 'Failed to update', icon: 'error', background: '#1a1a2e', color: '#fff' });
    }
  };

  const handleRedownload = async (batchId, filename) => {
    try {
      const res = await axios.get(`${BASE_URL}/order/admin/batches/${batchId}/download`, { headers: getAuthHeaders(), responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename || `batch_${batchId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to download file', icon: 'error', background: '#1a1a2e', color: '#fff' });
    }
  };

  const filteredBatches = batches.filter(b => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      b.filename?.toLowerCase().includes(term) ||
      String(b.id).includes(term) ||
      b.network?.toLowerCase().includes(term) ||
      b.agents?.some(a => a.name?.toLowerCase().includes(term))
    );
  });

  const totalPages = pagination.totalPages;

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  // ==================== DETAIL VIEW ====================
  if (selectedBatch && batchDetail) {
    const allItems = [];
    for (const order of batchDetail.orders) {
      for (const item of order.items) {
        allItems.push({ ...item, orderId: order.id, agentName: order.user?.name || 'N/A' });
      }
    }

    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedBatch(null); setBatchDetail(null); }} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700 text-dark-300">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Batch #{batchDetail.id} &mdash; {batchDetail.network || 'Unknown'}
              </h2>
              <p className="text-dark-400 text-sm">Exported: {formatDate(batchDetail.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleRedownload(batchDetail.id, batchDetail.filename)} className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-xl text-dark-300 hover:text-white hover:bg-dark-700 text-sm">
              <Download className="w-4 h-4" /> Re-download
            </button>
            <button onClick={() => handleBulkStatusUpdate(batchDetail.id)} disabled={statusUpdateLoading} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl text-sm font-medium hover:from-cyan-600 hover:to-cyan-700 disabled:opacity-50">
              {statusUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Update All
            </button>
          </div>
        </div>

        <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900/50">
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Item ID</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Order ID</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Agent</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Phone</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Product</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Bundle</th>
                  <th className="px-4 py-3 text-right text-dark-400 font-medium">Price</th>
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {allItems.map((item) => {
                  const StatusIcon = statusIcons[item.status === 'Canceled' ? 'Cancelled' : item.status] || Clock;
                  const statusClass = statusColors[item.status === 'Canceled' ? 'Cancelled' : item.status] || statusColors.Pending;
                  return (
                    <tr key={item.id} className="hover:bg-dark-700/30 transition-colors">
                      <td className="px-4 py-3 text-white font-mono text-xs">#{item.id}</td>
                      <td className="px-4 py-3 text-dark-300 font-mono text-xs">#{item.orderId}</td>
                      <td className="px-4 py-3 text-dark-300">{item.agentName}</td>
                      <td className="px-4 py-3 text-white">{item.mobileNumber || '-'}</td>
                      <td className="px-4 py-3 text-dark-300">{item.productName || item.product?.name || '-'}</td>
                      <td className="px-4 py-3 text-dark-300">{item.productDescription || item.product?.description || '-'}</td>
                      <td className="px-4 py-3 text-right text-white">GHS {(item.productPrice || item.product?.price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusClass}`}>
                          <StatusIcon className="w-3 h-3" /> {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleSingleItemStatusUpdate(batchDetail.id, item.id, item.status)} className="px-3 py-1.5 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 hover:text-white text-xs transition-colors">
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {allItems.length === 0 && (
            <div className="p-8 text-center text-dark-400">No order items found in this batch.</div>
          )}
          <div className="border-t border-dark-700 px-4 py-3 bg-dark-900/50 flex flex-wrap items-center justify-between gap-2">
            <span className="text-dark-400 text-sm">{allItems.length} items total</span>
            <span className="text-white text-sm font-medium">
              Total: GHS {allItems.reduce((sum, it) => sum + ((it.productPrice || it.product?.price || 0) * it.quantity), 0).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ==================== LIST VIEW ====================
  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Order Files
          </h2>
          <p className="text-dark-400 text-sm mt-1">Export pending orders by network and manage exported batches</p>
        </div>
        <button onClick={() => fetchBatches(page)} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-xl text-dark-300 hover:text-white hover:bg-dark-700 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Network export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Object.entries(networkColors).map(([network, colors]) => {
          const data = pendingCounts[network] || { count: 0, total: 0 };
          const isExporting = exporting === network;
          return (
            <div key={network} className={`bg-gradient-to-br ${colors.bg} border ${colors.border} rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={`text-lg font-bold ${colors.text}`}>{network}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${colors.text} bg-black/20`}>
                  {data.count} pending
                </span>
              </div>
              <p className="text-dark-300 text-sm mb-4">
                Total: <span className="text-white font-medium">GHS {data.total.toFixed(2)}</span>
              </p>
              <button
                onClick={() => handleExportNetwork(network)}
                disabled={isExporting || data.count === 0}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r ${colors.btn} text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity`}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'Exporting...' : 'Export & Download'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
          <input type="text" placeholder="Search by batch #, network, agent..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-dark-500 text-sm focus:border-cyan-500 focus:outline-none" />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white"><X className="w-4 h-4" /></button>
          )}
        </div>
      </div>

      {/* Exported batches table */}
      <h3 className="text-white font-semibold mb-3">Exported Batches</h3>
      {loading && initialLoad ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-400 animate-spin" /></div>
      ) : filteredBatches.length === 0 ? (
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">No exported batches yet</p>
          <p className="text-dark-500 text-sm mt-1">Export pending orders using the network cards above</p>
        </div>
      ) : (
        <div className="bg-dark-800 border border-dark-700 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-900/50">
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Export Time</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Batch #</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Network</th>
                  <th className="px-4 py-3 text-left text-dark-400 font-medium">Agents</th>
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">Orders</th>
                  <th className="px-4 py-3 text-right text-dark-400 font-medium">Total Price</th>
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">Status</th>
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredBatches.map((batch) => {
                  const StatusIcon = statusIcons[batch.status] || Clock;
                  const statusClass = statusColors[batch.status] || statusColors.Pending;
                  const agentNames = batch.agents?.map(a => a.name).join(', ') || '-';
                  return (
                    <tr key={batch.id} className="hover:bg-dark-700/30 transition-colors">
                      <td className="px-4 py-3 text-dark-300 whitespace-nowrap">{formatDate(batch.createdAt)}</td>
                      <td className="px-4 py-3 text-white font-mono">#{batch.id}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${networkColors[batch.network]?.text || 'text-dark-300'} ${networkColors[batch.network]?.border || ''} border bg-black/20`}>
                          {batch.network || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-dark-300 max-w-[180px] truncate" title={agentNames}>{agentNames}</td>
                      <td className="px-4 py-3 text-center text-white">{batch.totalItems}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">GHS {batch.totalPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusClass}`}>
                          <StatusIcon className="w-3 h-3" /> {batch.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => fetchBatchDetail(batch.id)} className="px-2.5 py-1.5 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 hover:text-white text-xs transition-colors">View</button>
                          <button onClick={() => handleBulkStatusUpdate(batch.id)} className="px-2.5 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 text-xs transition-colors">Status</button>
                          <button onClick={() => handleRedownload(batch.id, batch.filename)} className="px-2.5 py-1.5 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 hover:text-white text-xs transition-colors" title="Re-download">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-dark-700 px-4 py-3 flex items-center justify-between">
              <span className="text-dark-400 text-sm">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, pagination.total)} of {pagination.total}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => fetchBatches(page - 1, true)} disabled={page === 1} className="px-3 py-1.5 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 disabled:opacity-40 text-sm">Prev</button>
                <span className="text-dark-400 text-sm">Page {page} of {totalPages}</span>
                <button onClick={() => fetchBatches(page + 1, true)} disabled={page >= totalPages} className="px-3 py-1.5 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 disabled:opacity-40 text-sm">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {detailLoading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-white">Loading batch details...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderFiles;

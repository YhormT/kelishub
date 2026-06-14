import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';
import getSocket from '../utils/socket';
import { FileText, Download, ChevronLeft, RefreshCw, Loader2, Search, X, CheckCircle, Clock, XCircle, Upload, Send, Zap, AlertTriangle } from 'lucide-react';
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

const gmplStatusConfig = {
  completed: { label: 'GMPL Completed', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  submitted: { label: 'GMPL OK', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', icon: CheckCircle },
  failed: { label: 'GMPL Failed', className: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertTriangle },
  pending: { label: 'GMPL Pending', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
  skipped: { label: 'GMPL Skipped', className: 'bg-dark-600/50 text-dark-400 border-dark-600', icon: XCircle },
};

const isGmplClosed = (batch) =>
  batch?.gmplStatus === 'completed' || batch?.status === 'Completed';

const canRetryGmpl = (batch) =>
  isMtnNetwork(batch?.network) &&
  batch?.gmplStatus === 'failed' &&
  !isGmplClosed(batch);

const canSendGmpl = (batch) =>
  isMtnNetwork(batch?.network) &&
  !isGmplClosed(batch) &&
  !['submitted', 'completed'].includes(batch?.gmplStatus);

const GmplStatusBadge = ({ status, autoExport }) => {
  const cfg = gmplStatusConfig[status] || gmplStatusConfig.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.className}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
      {autoExport && <span className="opacity-70">· auto</span>}
    </span>
  );
};

const isMtnNetwork = (network) => network === 'MTN';

const formatStatusCounts = (counts) => {
  if (!counts) return null;
  const parts = [];
  if (counts.Pending) parts.push(`${counts.Pending} Pending`);
  if (counts.Processing) parts.push(`${counts.Processing} Processing`);
  if (counts.Completed) parts.push(`${counts.Completed} Completed`);
  if (counts.Cancelled) parts.push(`${counts.Cancelled} Cancelled`);
  return parts.length ? parts.join(' · ') : null;
};

const OrderFiles = () => {
  const [batches, setBatches] = useState([]);
  const [pendingCounts, setPendingCounts] = useState({});
  const [pendingQueue, setPendingQueue] = useState({});
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [sendingGmplNetwork, setSendingGmplNetwork] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
  const [gmplUploading, setGmplUploading] = useState(false);
  const [gmplFile, setGmplFile] = useState(null);
  const [submittingGmplBatchId, setSubmittingGmplBatchId] = useState(null);
  const [syncingGmplBatchId, setSyncingGmplBatchId] = useState(null);
  const [autoExportConfig, setAutoExportConfig] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const perPage = 15;

  const fetchPendingLive = useCallback(async () => {
    try {
      const [countRes, queueRes] = await Promise.all([
        axios.get(`${BASE_URL}/order/admin/batches/pending-counts`, { headers: getAuthHeaders() }),
        axios.get(`${BASE_URL}/order/admin/batches/pending-queue`, { headers: getAuthHeaders() }),
      ]);
      if (countRes.data.success) setPendingCounts(countRes.data.counts);
      if (queueRes.data.success) setPendingQueue(queueRes.data.queue);
    } catch (err) {
      console.error('Error fetching pending queue:', err);
    }
  }, []);

  const fetchBatches = useCallback(async (targetPage = page, isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const [batchRes, countRes, queueRes] = await Promise.all([
        axios.get(`${BASE_URL}/order/admin/batches`, { headers: getAuthHeaders(), params: { page: targetPage, limit: perPage } }),
        axios.get(`${BASE_URL}/order/admin/batches/pending-counts`, { headers: getAuthHeaders() }),
        axios.get(`${BASE_URL}/order/admin/batches/pending-queue`, { headers: getAuthHeaders() }),
      ]);
      if (batchRes.data.success) {
        setBatches(batchRes.data.batches);
        if (batchRes.data.pagination) {
          setPagination(batchRes.data.pagination);
          setPage(batchRes.data.pagination.page);
        }
      }
      if (countRes.data.success) setPendingCounts(countRes.data.counts);
      if (queueRes.data.success) setPendingQueue(queueRes.data.queue);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [page]);

  const fetchAutoExportConfig = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/order/admin/gmpl/auto-export`, { headers: getAuthHeaders() });
      if (res.data.success) setAutoExportConfig(res.data.autoExport);
    } catch (err) {
      console.error('Error fetching GMPL auto-export config:', err);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchBatches(1);
    fetchAutoExportConfig();
  }, []);

  // WebSocket: refresh pending counts/queue immediately when orders arrive or are exported
  useEffect(() => {
    const socket = getSocket();
    const handlePendingChanged = (data) => {
      if (data?.networks && data.type !== 'exported') {
        setPendingCounts((prev) => {
          const next = { ...prev };
          for (const [network, added] of Object.entries(data.networks)) {
            if (!added) continue;
            if (!next[network]) next[network] = { count: 0, total: 0 };
            next[network] = {
              ...next[network],
              count: (next[network].count || 0) + added,
            };
          }
          return next;
        });
      }
      fetchPendingLive();
      fetchBatches(page, true);
    };
    socket.on('order-pending-changed', handlePendingChanged);
    socket.on('new-order', handlePendingChanged);
    return () => {
      socket.off('order-pending-changed', handlePendingChanged);
      socket.off('new-order', handlePendingChanged);
    };
  }, [fetchPendingLive, fetchBatches, page]);

  // Background periodic refresh every 30 seconds (safety net for missed socket events)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPendingLive();
      fetchBatches(page, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingLive, fetchBatches, page]);

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

  const handleExportNetwork = async (network, { submitToGmpl = false } = {}) => {
    const count = pendingCounts[network]?.count || 0;
    if (count === 0) {
      Swal.fire({ title: 'No Pending Orders', text: `No pending orders for ${network}`, icon: 'info', background: '#1a1a2e', color: '#fff', confirmButtonColor: '#06b6d4' });
      return;
    }

    const isGmplSubmit = submitToGmpl && isMtnNetwork(network);

    const confirm = await Swal.fire({
      title: isGmplSubmit ? `Send ${network} to GMPL` : `Export ${network} Orders`,
      html: isGmplSubmit
        ? `<p style="color:#94a3b8">Export <b style="color:#fff">${count}</b> pending ${network} order(s), create batch(es), and submit to <b style="color:#fff">GMPL</b>.</p><p style="color:#64748b;margin-top:8px;font-size:13px">Use <b>Export Excel</b> first if you need the spreadsheet downloaded.</p>`
        : `<p style="color:#94a3b8">Export <b style="color:#fff">${count}</b> pending ${network} order(s).</p><p style="color:#94a3b8;margin-top:8px">Creates batch(es), sets orders to Processing, and downloads the Excel file. Does <b style="color:#fff">not</b> send to GMPL.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: isGmplSubmit ? 'Send to GMPL' : 'Export & Download',
      confirmButtonColor: isGmplSubmit ? '#10b981' : '#06b6d4',
      background: '#1a1a2e',
      color: '#fff',
    });
    if (!confirm.isConfirmed) return;

    const setBusy = isGmplSubmit
      ? () => setSendingGmplNetwork(network)
      : () => setExporting(network);
    const clearBusy = isGmplSubmit
      ? () => setSendingGmplNetwork(null)
      : () => setExporting(null);

    try {
      setBusy();
      const res = await axios.post(
        `${BASE_URL}/order/admin/batches/export`,
        { network, submitToGmpl: isGmplSubmit },
        { headers: getAuthHeaders(), responseType: 'blob' }
      );

      const contentDisp = res.headers['content-disposition'];
      let filename = `${network}_export.xlsx`;
      if (contentDisp) {
        const match = contentDisp.match(/filename=(.+)/);
        if (match) filename = match[1];
      }

      if (!isGmplSubmit) {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      const gmplSubmitted = res.headers['x-gmpl-submitted'];
      const gmplError = res.headers['x-gmpl-error'];
      const batchId = res.headers['x-batch-id'];
      const batchCount = parseInt(res.headers['x-batch-count'] || '1', 10);
      const batchIds = res.headers['x-batch-ids'] || batchId;
      const batchLabel = batchCount > 1 ? `${batchCount} batches (${batchIds})` : `#${batchId || '—'}`;

      if (isGmplSubmit) {
        if (gmplSubmitted === 'true') {
          Swal.fire({
            title: 'Sent to GMPL',
            text: `${batchLabel}: ${count} ${network} item(s) submitted — one batch per order.`,
            icon: 'success',
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonColor: '#10b981',
          });
        } else if (gmplSubmitted === 'partial') {
          const submittedN = res.headers['x-gmpl-submitted-count'] || '?';
          const failedN = res.headers['x-gmpl-failed-count'] || '?';
          const errMsg = gmplError ? decodeURIComponent(gmplError) : '';
          Swal.fire({
            title: 'GMPL partially failed',
            html: `<p>${batchLabel} created.</p><p class="text-sm mt-2">${submittedN} sent, ${failedN} failed.</p>${errMsg ? `<p class="text-sm mt-2 text-red-300">${errMsg}</p>` : ''}<p class="text-sm mt-2">Use <b>Retry GMPL</b> on failed batches.</p>`,
            icon: 'warning',
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonColor: '#10b981',
          });
        } else if (gmplSubmitted === 'false' && gmplError) {
          const errMsg = decodeURIComponent(gmplError);
          Swal.fire({
            title: 'GMPL failed',
            html: `<p>${batchLabel} created.</p><p class="text-sm mt-2 text-red-300">${errMsg}</p><p class="text-sm mt-2">Use <b>Retry GMPL</b> on the batch to try again.</p>`,
            icon: 'warning',
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonColor: '#10b981',
          });
        } else {
          Swal.fire({
            title: 'GMPL skipped',
            text: `${batchLabel} created but GMPL is not configured (GMPL_API_KEY missing).`,
            icon: 'info',
            background: '#1a1a2e',
            color: '#fff',
            confirmButtonColor: '#10b981',
          });
        }
      } else if (gmplSubmitted === 'true' || gmplSubmitted === 'partial' || (gmplSubmitted === 'false' && gmplError)) {
        // Legacy path if backend still submits — should not happen with submitToGmpl: false
        Swal.fire({
          title: 'Exported',
          text: `${batchLabel}: Excel downloaded.`,
          icon: 'success',
          background: '#1a1a2e',
          color: '#fff',
          confirmButtonColor: '#06b6d4',
          timer: 3000,
        });
      } else {
        Swal.fire({
          title: 'Exported',
          text: `${batchLabel}: ${count} ${network} item(s) — Excel downloaded. One batch per order.`,
          icon: 'success',
          background: '#1a1a2e',
          color: '#fff',
          confirmButtonColor: '#06b6d4',
          timer: 3000,
        });
      }
      fetchBatches(1, true);
    } catch (err) {
      const msg = err.response?.status === 404 ? `No pending orders for ${network}` : isGmplSubmit ? 'GMPL submit failed' : 'Export failed';
      Swal.fire({ title: 'Error', text: msg, icon: 'error', background: '#1a1a2e', color: '#fff' });
    } finally {
      clearBusy();
    }
  };

  const handleSubmitBatchToGmpl = async (batchId) => {
    try {
      setSubmittingGmplBatchId(batchId);
      const res = await axios.post(
        `${BASE_URL}/order/admin/batches/${batchId}/submit-gmpl`,
        {},
        { headers: getAuthHeaders() }
      );
      if (res.data.success) {
        Swal.fire({
          title: 'Sent to GMPL',
          text: res.data.message || 'Supplier accepted the batch file.',
          icon: 'success',
          background: '#1a1a2e',
          color: '#fff',
          confirmButtonColor: '#06b6d4',
        });
        fetchBatches(page, true);
        if (selectedBatch === batchId) fetchBatchDetail(batchId);
      }
    } catch (err) {
      Swal.fire({
        title: 'GMPL failed',
        text: err.response?.data?.message || 'Could not submit batch to GMPL.',
        icon: 'error',
        background: '#1a1a2e',
        color: '#fff',
      });
    } finally {
      setSubmittingGmplBatchId(null);
    }
  };

  const handleSyncGmplBatchStatus = async (batchId) => {
    try {
      setSyncingGmplBatchId(batchId);
      const res = await axios.post(
        `${BASE_URL}/order/admin/batches/${batchId}/sync-gmpl-status`,
        {},
        { headers: getAuthHeaders() }
      );
      if (res.data.success) {
        const updated = res.data.updatedItems ?? 0;
        const status = res.data.batchStatus || res.data.status;
        Swal.fire({
          title: 'Synced from GMPL',
          text: updated > 0
            ? `Updated ${updated} item(s)${status ? ` — batch now ${status}` : ''}.`
            : res.data.reason === 'no_remote_data'
              ? 'No status update available from GMPL yet.'
              : 'Batch is already up to date.',
          icon: updated > 0 ? 'success' : 'info',
          background: '#1a1a2e',
          color: '#fff',
          confirmButtonColor: '#06b6d4',
        });
        fetchBatches(page, true);
        if (selectedBatch === batchId) fetchBatchDetail(batchId);
      }
    } catch (err) {
      Swal.fire({
        title: 'Sync failed',
        text: err.response?.data?.message || 'Could not sync batch status from GMPL.',
        icon: 'error',
        background: '#1a1a2e',
        color: '#fff',
      });
    } finally {
      setSyncingGmplBatchId(null);
    }
  };

  const handleAdminGmplUpload = async () => {
    if (!gmplFile) {
      Swal.fire({ title: 'Missing file', text: 'Select an Excel file to upload.', icon: 'warning', background: '#1a1a2e', color: '#fff' });
      return;
    }
    const network = 'MTN';
    if (!isMtnNetwork(network)) {
      Swal.fire({ title: 'MTN only', text: 'GMPL manual upload supports MTN orders only.', icon: 'warning', background: '#1a1a2e', color: '#fff' });
      return;
    }
    const formData = new FormData();
    formData.append('orderFile', gmplFile);
    formData.append('network', network);

    try {
      setGmplUploading(true);
      const res = await axios.post(`${BASE_URL}/order/admin/gmpl/submit`, formData, {
        headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        Swal.fire({
          title: 'GMPL accepted file',
          text: res.data.message || 'Order file submitted to supplier.',
          icon: 'success',
          background: '#1a1a2e',
          color: '#fff',
          confirmButtonColor: '#06b6d4',
        });
        setGmplFile(null);
      }
    } catch (err) {
      Swal.fire({
        title: 'GMPL upload failed',
        text: err.response?.data?.message || 'Supplier rejected the file.',
        icon: 'error',
        background: '#1a1a2e',
        color: '#fff',
      });
    } finally {
      setGmplUploading(false);
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
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <GmplStatusBadge status={batchDetail.gmplStatus} autoExport={batchDetail.gmplAutoExport} />
                {batchDetail.gmplSubmittedAt && (
                  <span className="text-dark-500 text-xs">Submitted {formatDate(batchDetail.gmplSubmittedAt)}</span>
                )}
              </div>
              {batchDetail.gmplStatus === 'failed' && batchDetail.gmplError && (
                <p className="text-red-400 text-xs mt-1 max-w-xl">{batchDetail.gmplError}</p>
              )}
              {formatStatusCounts(batchDetail.statusCounts) && (
                <p className="text-dark-400 text-xs mt-1">{formatStatusCounts(batchDetail.statusCounts)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canSendGmpl(batchDetail) && (
              <button
                onClick={() => handleSubmitBatchToGmpl(batchDetail.id)}
                disabled={submittingGmplBatchId === batchDetail.id}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 hover:bg-emerald-500/20 text-sm disabled:opacity-50"
              >
                {submittingGmplBatchId === batchDetail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send to GMPL
              </button>
            )}
            {canRetryGmpl(batchDetail) && (
              <button
                onClick={() => handleSubmitBatchToGmpl(batchDetail.id)}
                disabled={submittingGmplBatchId === batchDetail.id}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 hover:bg-emerald-500/20 text-sm disabled:opacity-50"
              >
                {submittingGmplBatchId === batchDetail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Retry GMPL
              </button>
            )}
            {isMtnNetwork(batchDetail.network) && batchDetail.gmplStatus === 'submitted' && !isGmplClosed(batchDetail) && (
              <button
                onClick={() => handleSyncGmplBatchStatus(batchDetail.id)}
                disabled={syncingGmplBatchId === batchDetail.id}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 hover:bg-cyan-500/20 text-sm disabled:opacity-50"
              >
                {syncingGmplBatchId === batchDetail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync from GMPL
              </button>
            )}
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
          <p className="text-dark-400 text-sm mt-1">Export pending orders, submit to GMPL, and manage batches</p>
        </div>
        <button onClick={() => fetchBatches(page)} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-600 rounded-xl text-dark-300 hover:text-white hover:bg-dark-700 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {autoExportConfig?.enabled && autoExportConfig?.configured && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Zap className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium text-sm">GMPL auto-export is active (MTN only)</p>
            <p className="text-dark-400 text-xs mt-1">
              Pending MTN orders are exported as <b className="text-white">one batch per purchaser order</b> every {Math.round(autoExportConfig.intervalMs / 60000)} min
              {autoExportConfig.maxOrdersPerCycle > 0 ? (
                <> — up to <b className="text-white">{autoExportConfig.maxOrdersPerCycle}</b> orders per cycle (oldest first). The next cycle sends more without waiting for GMPL to complete earlier batches.</>
              ) : (
                <> (all pending orders each cycle).</>
              )}
              {' '}A single pending order is exported immediately (no need to wait for 3).
              {' '}Min {autoExportConfig.minPendingCount} pending order(s) to trigger scheduled cycles.
              Telecel and Airtel Tigo are export-only — no GMPL submit.
              {autoExportConfig.statusSyncEnabled !== false && ' Status sync from GMPL runs automatically on submitted MTN batches.'}
              {' '}Failed batches auto-retry up to {autoExportConfig.maxRetries} times.
            </p>
          </div>
        </div>
      )}

      {/* Live pending queue — updates instantly via WebSocket when agents place orders */}
      {(() => {
        const mtnQueue = pendingQueue.MTN || { count: 0, total: 0, items: [] };
        const otherPending = Object.entries(pendingQueue)
          .filter(([net]) => net !== 'MTN')
          .reduce((sum, [, q]) => sum + (q?.count || 0), 0);

        if (mtnQueue.count === 0 && otherPending === 0) return null;

        return (
          <div className="bg-dark-800 border border-yellow-500/20 rounded-2xl p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-400" />
                  Pending purchaser orders
                  <span className="text-dark-500 text-xs font-normal">Live</span>
                </h3>
                <p className="text-dark-400 text-sm mt-1">
                  New wallet orders appear here immediately — export from the MTN card when ready for GMPL.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium">
                  MTN: {mtnQueue.count} pending · GHS {(mtnQueue.total || 0).toFixed(2)}
                </span>
                {otherPending > 0 && (
                  <span className="px-3 py-1.5 rounded-xl bg-dark-700 border border-dark-600 text-dark-300 text-sm">
                    Other networks: {otherPending}
                  </span>
                )}
              </div>
            </div>

            {mtnQueue.items?.length > 0 ? (
              <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-xl border border-dark-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-dark-900/95">
                    <tr className="border-b border-dark-700">
                      <th className="px-3 py-2 text-left text-dark-400 font-medium">Time</th>
                      <th className="px-3 py-2 text-left text-dark-400 font-medium">Agent</th>
                      <th className="px-3 py-2 text-left text-dark-400 font-medium">Phone</th>
                      <th className="px-3 py-2 text-left text-dark-400 font-medium">Product</th>
                      <th className="px-3 py-2 text-right text-dark-400 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    {mtnQueue.items.slice(0, 50).map((item) => (
                      <tr key={item.itemId} className="hover:bg-dark-700/30">
                        <td className="px-3 py-2 text-dark-400 whitespace-nowrap text-xs">
                          {item.createdAt ? formatDate(item.createdAt) : '—'}
                        </td>
                        <td className="px-3 py-2 text-dark-300">{item.agentName}</td>
                        <td className="px-3 py-2 text-white font-mono text-xs">{item.phone || '—'}</td>
                        <td className="px-3 py-2 text-dark-300 max-w-[200px] truncate" title={item.product}>{item.product}</td>
                        <td className="px-3 py-2 text-right text-white">GHS {(item.price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-dark-500 text-sm">No MTN pending orders right now.</p>
            )}
          </div>
        );
      })()}

      {/* Direct GMPL upload (admin) — manual fallback */}
      <div className="bg-dark-800 border border-emerald-500/20 rounded-2xl p-5 mb-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Upload className="w-5 h-5 text-emerald-400" />
          Submit Excel to GMPL
          <span className="text-dark-500 text-xs font-normal ml-1">Manual fallback</span>
        </h3>
        <p className="text-dark-400 text-sm mb-4">Upload a supplier-format MTN file (Phone + Data Size) when auto-export or batch retry did not go through.</p>
        <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
          <div className="px-3 py-2.5 bg-dark-900 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm min-w-[140px] flex items-center">
            MTN <span className="text-dark-500 text-xs ml-2">GMPL only</span>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setGmplFile(e.target.files?.[0] || null)}
            className="text-sm text-dark-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-dark-700 file:text-white"
          />
          <button
            type="button"
            onClick={handleAdminGmplUpload}
            disabled={gmplUploading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl text-sm font-medium disabled:opacity-50"
          >
            {gmplUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {gmplUploading ? 'Sending...' : 'Send to GMPL'}
          </button>
        </div>
      </div>

      {/* Network export cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Object.entries(networkColors).map(([network, colors]) => {
          const data = pendingCounts[network] || { count: 0, total: 0 };
          const isExporting = exporting === network;
          const isSendingGmpl = sendingGmplNetwork === network;
          const usesGmpl = isMtnNetwork(network);
          const busy = isExporting || isSendingGmpl;
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
              <div className={`flex gap-2 ${usesGmpl ? 'flex-col sm:flex-row' : ''}`}>
                <button
                  onClick={() => handleExportNetwork(network, { submitToGmpl: false })}
                  disabled={busy || data.count === 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r ${colors.btn} text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity`}
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExporting ? 'Exporting...' : 'Export Excel'}
                </button>
                {usesGmpl && (
                  <button
                    onClick={() => handleExportNetwork(network, { submitToGmpl: true })}
                    disabled={busy || data.count === 0}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    {isSendingGmpl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {isSendingGmpl ? 'Sending...' : 'Send to GMPL'}
                  </button>
                )}
              </div>
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
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">GMPL</th>
                  <th className="px-4 py-3 text-center text-dark-400 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {filteredBatches.map((batch) => {
                  const statusBreakdown = formatStatusCounts(batch.statusCounts);
                  const agentNames = batch.agents?.map(a => a.name).join(', ') || '-';
                  const showGmpl = isMtnNetwork(batch.network);
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
                        {statusBreakdown ? (
                          <span className="text-dark-300 text-xs leading-relaxed">{statusBreakdown}</span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${statusColors[batch.status] || statusColors.Pending}`}>
                            {(() => { const StatusIcon = statusIcons[batch.status] || Clock; return <StatusIcon className="w-3 h-3" />; })()}
                            {batch.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {showGmpl ? (
                          <GmplStatusBadge status={batch.gmplStatus} autoExport={batch.gmplAutoExport} />
                        ) : (
                          <span className="text-dark-500 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => fetchBatchDetail(batch.id)} className="px-2.5 py-1.5 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600 hover:text-white text-xs transition-colors">View</button>
                          {canRetryGmpl(batch) && (
                            <button
                              onClick={() => handleSubmitBatchToGmpl(batch.id)}
                              disabled={submittingGmplBatchId === batch.id}
                              className="px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 text-xs transition-colors disabled:opacity-50"
                              title={batch.gmplError || 'Retry GMPL'}
                            >
                              {submittingGmplBatchId === batch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {isMtnNetwork(batch.network) && batch.gmplStatus === 'submitted' && !isGmplClosed(batch) && (
                            <button
                              onClick={() => handleSyncGmplBatchStatus(batch.id)}
                              disabled={syncingGmplBatchId === batch.id}
                              className="px-2.5 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 text-xs transition-colors disabled:opacity-50"
                              title="Sync status from GMPL"
                            >
                              {syncingGmplBatchId === batch.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                          )}
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

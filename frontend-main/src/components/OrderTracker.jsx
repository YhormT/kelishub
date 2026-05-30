import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { X, RefreshCw, Loader2, Search, Calendar, Clock, Filter, AlertTriangle, Volume2, VolumeX, ChevronDown, ChevronUp, Wifi } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import getSocket from '../utils/socket';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const formatGHS = (amount) => {
  const num = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  return `GHS ${num.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const NETWORK_CONFIG = {
  mtn: { label: 'MTN', color: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', icon: '📡' },
  telecel: { label: 'TELECEL', color: 'from-red-500 to-red-600', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', icon: '📡' },
  airteltigo: { label: 'AIRTELTIGO', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: '📡' }
};

const OrderTracker = ({ isOpen, onClose, onFraudDetected }) => {
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [networkSummary, setNetworkSummary] = useState({ mtn: { count: 0, total: 0 }, telecel: { count: 0, total: 0 }, airteltigo: { count: 0, total: 0 } });
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [agents, setAgents] = useState([]);
  const [products, setProducts] = useState([]);
  const [resolvedIds, setResolvedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('resolvedFraudAlerts') || '[]');
    } catch { return []; }
  });

  const [selectedAgent, setSelectedAgent] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [sortField, setSortField] = useState('dateTime');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const [showFraudPanel, setShowFraudPanel] = useState(false);
  const [fraudSoundEnabled, setFraudSoundEnabled] = useState(true);
  const fraudAudioRef = useRef(null);
  const agentDropdownRef = useRef(null);
  const prevFraudCountRef = useRef(0);
  const fraudSoundEnabledRef = useRef(true);

  const fetchFilters = useCallback(async () => {
    try {
      const [usersRes, productsRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/users`, { headers: getAuthHeaders() }).catch(() => ({ data: [] })),
        axios.get(`${BASE_URL}/products`, { headers: getAuthHeaders() }).catch(() => ({ data: [] }))
      ]);
      setAgents(Array.isArray(usersRes.data) ? usersRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch (e) {
      console.error('Error fetching filters:', e);
    }
  }, []);

  useEffect(() => {
    fraudSoundEnabledRef.current = fraudSoundEnabled;
  }, [fraudSoundEnabled]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedAgent) params.agentId = selectedAgent;
      if (selectedProduct) params.productId = selectedProduct;
      if (selectedDate) {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      }
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const res = await axios.get(`${BASE_URL}/order/admin/order-tracker`, { headers: getAuthHeaders(), params });
      if (res.data.success) {
        setTableData(res.data.tableData || []);
        setNetworkSummary(res.data.networkSummary || { mtn: { count: 0, total: 0 }, telecel: { count: 0, total: 0 }, airteltigo: { count: 0, total: 0 } });
        const allAlerts = res.data.fraudAlerts || [];
        setFraudAlerts(allAlerts);

        // Filter out resolved alerts
        const resolvedList = JSON.parse(localStorage.getItem('resolvedFraudAlerts') || '[]');
        setResolvedIds(resolvedList);
        const activeAlerts = allAlerts.filter(a => !resolvedList.includes(`${a.orderId}-${a.itemId}`));

        if (activeAlerts.length > 0 && activeAlerts.length > prevFraudCountRef.current) {
          if (onFraudDetected) onFraudDetected(activeAlerts);
          if (fraudSoundEnabledRef.current && fraudAudioRef.current) {
            fraudAudioRef.current.currentTime = 0;
            fraudAudioRef.current.play().catch(() => {});
          }
          setShowFraudPanel(true);
        }
        prevFraudCountRef.current = activeAlerts.length;
      }
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to fetch order tracker data', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setLoading(false);
    }
  }, [selectedAgent, selectedProduct, selectedDate, startTime, endTime, onFraudDetected]);

  // Load data on open + when filters change
  useEffect(() => {
    if (isOpen) {
      fetchFilters();
      fetchData();
    }
  }, [isOpen, fetchFilters, fetchData]);

  // Listen for new orders via socket and auto-reload
  useEffect(() => {
    if (!isOpen) return;
    const socket = getSocket();
    const handleNewOrder = () => {
      fetchData();
    };
    socket.on('new-order', handleNewOrder);
    
    // Safety net: background periodic refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    
    return () => {
      socket.off('new-order', handleNewOrder);
      clearInterval(interval);
    };
  }, [isOpen, fetchData]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target)) {
        setShowAgentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredAgents = useMemo(() => {
    if (!agentSearch) return agents;
    const s = agentSearch.toLowerCase();
    return agents.filter(a => a.name?.toLowerCase().includes(s) || a.email?.toLowerCase().includes(s) || a.phone?.includes(s));
  }, [agents, agentSearch]);

  const sorted = useMemo(() => {
    const copy = [...tableData];
    copy.sort((a, b) => {
      let va = a[sortField], vb = b[sortField];
      if (sortField === 'dateTime') { va = new Date(va); vb = new Date(vb); }
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va;
      if (va instanceof Date && vb instanceof Date) return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc' ? String(va || '').localeCompare(String(vb || '')) : String(vb || '').localeCompare(String(va || ''));
    });
    return copy;
  }, [tableData, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const handleSort = (field) => {
    if (sortField === field) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortField(field); setSortDir('desc'); }
  };

  const clearFilters = () => {
    setSelectedAgent(''); setAgentSearch(''); setSelectedProduct('');
    setSelectedDate(''); setStartTime(''); setEndTime(''); setPage(1);
  };

  const handleToggleFraudSound = () => {
    const nextEnabled = !fraudSoundEnabled;
    setFraudSoundEnabled(nextEnabled);
    if (!nextEnabled && fraudAudioRef.current) {
      fraudAudioRef.current.pause();
      fraudAudioRef.current.currentTime = 0;
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-cyan-400" /> : <ChevronDown className="w-3 h-3 text-cyan-400" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
      {/* Fraud Alert Sound */}
      <audio ref={fraudAudioRef} loop preload="auto">
        <source src="/fraud.mp3" type="audio/mpeg" />
      </audio>

      {/* Header */}
      <div className="bg-dark-900 border-b border-dark-700 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-xl">
            <Wifi className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Order Tracker</h2>
            <p className="text-dark-400 text-xs">{tableData.length} order items tracked</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fraudAlerts.filter(a => !resolvedIds.includes(`${a.orderId}-${a.itemId}`)).length > 0 && (
            <button
              onClick={() => setShowFraudPanel(!showFraudPanel)}
              className="relative flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 font-bold text-sm animate-pulse hover:bg-red-500/30"
            >
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <span>Fraud Alert ({fraudAlerts.filter(a => !resolvedIds.includes(`${a.orderId}-${a.itemId}`)).length})</span>
            </button>
          )}
          <button onClick={handleToggleFraudSound} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700" title={fraudSoundEnabled ? 'Mute alerts' : 'Unmute alerts'}>
            {fraudSoundEnabled ? <Volume2 className="w-4 h-4 text-dark-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </button>
          <button onClick={fetchData} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700">
            <RefreshCw className={`w-4 h-4 text-dark-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700">
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {/* Fraud Alert Panel */}
        {showFraudPanel && fraudAlerts.filter(a => !resolvedIds.includes(`${a.orderId}-${a.itemId}`)).length > 0 && (
          <div className="bg-red-900/30 border-2 border-red-500 rounded-2xl p-4 animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-red-400 animate-bounce" />
                <h3 className="text-red-400 font-bold text-lg">⚠️ SUSPICIOUS ACTIVITY DETECTED ⚠️</h3>
                <AlertTriangle className="w-6 h-6 text-red-400 animate-bounce" />
              </div>
              <button onClick={() => { setShowFraudPanel(false); if (fraudAudioRef.current) fraudAudioRef.current.pause(); }} className="px-3 py-1 bg-red-500/30 text-red-300 rounded-lg text-sm hover:bg-red-500/50">
                Dismiss
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {fraudAlerts.filter(a => !resolvedIds.includes(`${a.orderId}-${a.itemId}`)).map((alert, i) => (
                <div key={i} className="flex items-center justify-between bg-red-950/50 rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-red-400 font-bold">#{alert.orderId}</span>
                    <span className="text-white">{alert.agentName}</span>
                    <span className="text-dark-300">{alert.product}</span>
                    <span className="text-red-300 font-semibold">{formatGHS(alert.orderPrice)}</span>
                  </div>
                  <span className="text-red-400 text-xs font-medium bg-red-500/20 px-2 py-1 rounded">{alert.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Network Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(NETWORK_CONFIG).map(([key, cfg]) => {
            const data = networkSummary[key] || { count: 0, total: 0 };
            return (
              <div key={key} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5 transition-all hover:scale-[1.02]`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{cfg.icon}</span>
                    <h3 className={`font-bold text-lg ${cfg.text}`}>{cfg.label}</h3>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                    {data.count} orders
                  </div>
                </div>
                <p className="text-2xl font-bold text-white">{formatGHS(data.total)}</p>
                <p className="text-dark-400 text-xs mt-1">Total order value</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-dark-400" />
            <span className="text-dark-300 text-sm font-medium">Filters</span>
            {(selectedAgent || selectedProduct || selectedDate || startTime || endTime) && (
              <button onClick={clearFilters} className="ml-auto text-xs text-cyan-400 hover:text-cyan-300">Clear all</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Agent dropdown with search */}
            <div className="relative" ref={agentDropdownRef}>
              <label className="text-dark-500 text-xs mb-1 block">Agent</label>
              <div
                className="bg-dark-900 border border-dark-600 rounded-xl px-3 py-2 text-sm text-white cursor-pointer flex items-center justify-between"
                onClick={() => setShowAgentDropdown(!showAgentDropdown)}
              >
                <span className={selectedAgent ? 'text-white' : 'text-dark-500'}>
                  {selectedAgent ? agents.find(a => a.id === parseInt(selectedAgent))?.name || 'Agent' : 'All Agents'}
                </span>
                <ChevronDown className="w-4 h-4 text-dark-500" />
              </div>
              {showAgentDropdown && (
                <div className="absolute z-20 top-full mt-1 w-full bg-dark-800 border border-dark-600 rounded-xl shadow-2xl max-h-60 overflow-hidden">
                  <div className="p-2 border-b border-dark-700">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                      <input
                        type="text"
                        value={agentSearch}
                        onChange={(e) => setAgentSearch(e.target.value)}
                        placeholder="Search agent..."
                        className="w-full bg-dark-900 border border-dark-600 rounded-lg pl-7 pr-3 py-1.5 text-white text-xs placeholder-dark-500 focus:border-cyan-500 focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-44 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedAgent(''); setShowAgentDropdown(false); setAgentSearch(''); setPage(1); }}
                      className="w-full px-3 py-2 text-left text-sm text-dark-300 hover:bg-dark-700/50"
                    >
                      All Agents
                    </button>
                    {filteredAgents.map(agent => (
                      <button
                        key={agent.id}
                        onClick={() => { setSelectedAgent(String(agent.id)); setShowAgentDropdown(false); setAgentSearch(''); setPage(1); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-dark-700/50 ${selectedAgent === String(agent.id) ? 'text-cyan-400 bg-cyan-500/10' : 'text-dark-300'}`}
                      >
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-dark-500 text-xs ml-2">{agent.phone || agent.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Product dropdown */}
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Product</label>
              <select
                value={selectedProduct}
                onChange={(e) => { setSelectedProduct(e.target.value); setPage(1); }}
                className="w-full bg-dark-900 border border-dark-600 rounded-xl px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">All Products</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Date */}
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => { setSelectedDate(e.target.value); setPage(1); }}
                  className="w-full bg-dark-900 border border-dark-600 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Start Time */}
            <div>
              <label className="text-dark-500 text-xs mb-1 block">Start Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => { setStartTime(e.target.value); setPage(1); }}
                  className="w-full bg-dark-900 border border-dark-600 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* End Time */}
            <div>
              <label className="text-dark-500 text-xs mb-1 block">End Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-500" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => { setEndTime(e.target.value); setPage(1); }}
                  className="w-full bg-dark-900 border border-dark-600 rounded-xl pl-8 pr-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-dark-800/50 border border-dark-700 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <span className="ml-3 text-dark-400">Loading order data...</span>
            </div>
          ) : tableData.length === 0 ? (
            <div className="text-center py-20">
              <Wifi className="w-12 h-12 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400">No orders found with current filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-dark-400 text-xs border-b border-dark-700 bg-dark-900/50">
                      {[
                        { key: 'agentName', label: 'Agent Name' },
                        { key: 'orderId', label: 'Order ID' },
                        { key: 'product', label: 'Product' },
                        { key: 'data', label: 'Data' },
                        { key: 'balanceBefore', label: 'Balance Before' },
                        { key: 'orderPrice', label: 'Order Price' },
                        { key: 'balanceAfter', label: 'Balance After' },
                        { key: 'dateTime', label: 'Date & Time' }
                      ].map(col => (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.key)}
                          className="px-4 py-3 font-medium cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                        >
                          <div className="flex items-center gap-1">
                            {col.label}
                            <SortIcon field={col.key} />
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row, i) => {
                      const isFraud = fraudAlerts.some(f => f.orderId === row.orderId && f.itemId === row.itemId && !resolvedIds.includes(`${f.orderId}-${f.itemId}`));
                      return (
                        <tr
                          key={`${row.orderId}-${row.itemId}-${i}`}
                          className={`border-b border-dark-700/50 text-sm transition-colors ${
                            isFraud ? 'bg-red-900/20 hover:bg-red-900/30' : 'hover:bg-dark-800/50'
                          }`}
                        >
                          <td className="px-4 py-3 text-white font-medium">
                            {isFraud && <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline mr-1.5" />}
                            {row.agentName}
                          </td>
                          <td className="px-4 py-3 text-cyan-400 font-mono">#{row.orderId}</td>
                          <td className="px-4 py-3 text-dark-300">{row.product}</td>
                          <td className="px-4 py-3 text-dark-300">{row.data?.replace(/\D+$/, '') || 'N/A'}</td>
                          <td className="px-4 py-3 text-emerald-400 font-medium">
                            {row.balanceBefore != null ? formatGHS(row.balanceBefore) : <span className="text-dark-600">N/A</span>}
                          </td>
                          <td className="px-4 py-3 text-amber-400 font-semibold">{formatGHS(row.orderPrice)}</td>
                          <td className="px-4 py-3 font-medium">
                            {row.balanceAfter != null ? (
                              <span className={row.balanceBefore != null && Math.abs(row.balanceBefore - row.balanceAfter) < 0.01 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                                {formatGHS(row.balanceAfter)}
                              </span>
                            ) : <span className="text-dark-600">N/A</span>}
                          </td>
                          <td className="px-4 py-3 text-dark-400 whitespace-nowrap text-xs">{formatDateTime(row.dateTime)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-dark-700">
                  <span className="text-dark-400 text-sm">
                    Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, sorted.length)} of {sorted.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 bg-dark-700 rounded text-dark-300 text-xs disabled:opacity-30">First</button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 bg-dark-700 rounded text-dark-300 text-xs disabled:opacity-30">Prev</button>
                    <span className="text-white text-sm px-2">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 bg-dark-700 rounded text-dark-300 text-xs disabled:opacity-30">Next</button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 bg-dark-700 rounded text-dark-300 text-xs disabled:opacity-30">Last</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderTracker;

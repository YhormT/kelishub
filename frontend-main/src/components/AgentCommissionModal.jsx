import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, Loader2, DollarSign, Users, TrendingUp, CheckCircle, Clock, Search, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Wallet, Award, BarChart3, PieChart, FileText, ThumbsUp, ThumbsDown } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const formatAmount = (amount) => {
  const num = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);
  return `GHS ${num.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const AgentCommissionModal = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ orders: [], stats: {}, agentSummary: [] });
  const [weeklyData, setWeeklyData] = useState({ agents: [], totalCommission: 0, totalUnpaid: 0 });
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAgent] = useState(null);
  const [expandedAgent, setExpandedAgent] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [payingCommission, setPayingCommission] = useState(false);
  const [dateRange] = useState({ start: '', end: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const ordersPerPage = 30;

  // Commission requests
  const [commissionRequests, setCommissionRequests] = useState([]);
  const [requestsFilter, setRequestsFilter] = useState('all');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const [ordersRes, allOrdersRes, weeklyRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/storefront/admin/referrals`, {
          headers,
          params: {
            startDate: dateRange.start || undefined,
            endDate: dateRange.end || undefined,
            page,
            limit: ordersPerPage
          }
        }),
        axios.get(`${BASE_URL}/api/storefront/admin/referrals`, {
          headers,
          params: {
            startDate: dateRange.start || undefined,
            endDate: dateRange.end || undefined,
            limit: 10000
          }
        }),
        axios.get(`${BASE_URL}/api/storefront/admin/commissions/weekly`, { headers })
      ]);

      if (ordersRes.data.success) {
        setData({
          orders: allOrdersRes.data.orders || [],
          paginatedOrders: ordersRes.data.orders || [],
          stats: ordersRes.data.stats || {},
          agentSummary: ordersRes.data.agentSummary || []
        });
        if (ordersRes.data.pagination) {
          setPagination(ordersRes.data.pagination);
          setCurrentPage(ordersRes.data.pagination.page);
        }
      }

      if (weeklyRes.data.success) {
        setWeeklyData({
          agents: weeklyRes.data.agents || [],
          totalCommission: weeklyRes.data.totalCommission || 0,
          totalUnpaid: weeklyRes.data.totalUnpaid || 0,
          weekStart: weeklyRes.data.weekStart,
          weekEnd: weeklyRes.data.weekEnd
        });
      }
    } catch (error) {
      console.error('Error fetching commission data:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to fetch commission data',
        background: '#1e293b',
        color: '#f1f5f9'
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const fetchCommissionRequests = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [allRes, countRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/commission-requests/all`, { headers, params: { status: requestsFilter } }),
        axios.get(`${BASE_URL}/api/commission-requests/pending-count`, { headers })
      ]);
      if (allRes.data.success) setCommissionRequests(allRes.data.data);
      if (countRes.data.success) setPendingCount(countRes.data.count);
    } catch (error) {
      console.error('Error fetching commission requests:', error);
    }
  }, [requestsFilter]);

  const handleApproveRequest = async (request) => {
    const { value: formValues } = await Swal.fire({
      title: 'Approve Commission Request',
      html: `
        <div style="text-align: left; padding: 10px 0;">
          <div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 4px 0;"><strong>Agent:</strong> ${request.agent?.name || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>Customer:</strong> ${request.customerPhone}</p>
            <p style="margin: 4px 0;"><strong>Network:</strong> ${request.network}</p>
            <p style="margin: 4px 0;"><strong>Data Size:</strong> ${request.dataSize}</p>
            <p style="margin: 4px 0;"><strong>Price Paid:</strong> ${formatAmount(request.price)}</p>
          </div>
          ${request.adminNotes ? `<div style="background: #422006; border: 1px solid #92400e; padding: 10px; border-radius: 8px; margin-bottom: 12px; color: #fbbf24; font-size: 13px;">${request.adminNotes}</div>` : ''}
          <label style="display: block; margin-bottom: 6px; font-weight: 600;">Commission Amount (GHS) ${request.commission != null ? '<span style="color:#10b981;font-weight:400;font-size:12px;">(auto-suggested)</span>' : ''}</label>
          <input id="swal-commission" type="number" step="0.01" min="0" value="${request.commission != null ? request.commission : ''}" placeholder="e.g. 2.50" class="swal2-input" style="margin: 0; width: 100%;" />
          <label style="display: block; margin: 12px 0 6px 0; font-weight: 600;">Admin Notes (optional)</label>
          <textarea id="swal-notes" class="swal2-textarea" placeholder="Optional notes..." style="margin: 0; width: 100%;"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Approve',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      background: '#1e293b',
      color: '#f1f5f9',
      preConfirm: () => {
        const commission = document.getElementById('swal-commission').value;
        const notes = document.getElementById('swal-notes').value;
        if (!commission || parseFloat(commission) <= 0) {
          Swal.showValidationMessage('Commission amount must be greater than 0');
          return false;
        }
        return { commission: parseFloat(commission), adminNotes: notes };
      }
    });

    if (formValues) {
      try {
        await axios.put(`${BASE_URL}/api/commission-requests/${request.id}/approve`, formValues, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Approved!', text: 'Commission request approved', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
        fetchCommissionRequests();
        fetchData();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to approve', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const handleDeclineRequest = async (request) => {
    const { value: notes } = await Swal.fire({
      title: 'Decline Commission Request',
      html: `
        <div style="text-align: left; padding: 10px 0;">
          <div style="background: #0f172a; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin: 4px 0;"><strong>Agent:</strong> ${request.agent?.name || 'Unknown'}</p>
            <p style="margin: 4px 0;"><strong>Customer:</strong> ${request.customerPhone}</p>
            <p style="margin: 4px 0;"><strong>Price:</strong> ${formatAmount(request.price)}</p>
          </div>
        </div>
      `,
      input: 'textarea',
      inputLabel: 'Reason for declining (optional)',
      inputPlaceholder: 'Enter reason...',
      showCancelButton: true,
      confirmButtonText: 'Decline',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (notes !== undefined) {
      try {
        await axios.put(`${BASE_URL}/api/commission-requests/${request.id}/decline`, { adminNotes: notes }, { headers: getAuthHeaders() });
        Swal.fire({ icon: 'success', title: 'Declined', text: 'Commission request declined', timer: 1500, background: '#1e293b', color: '#f1f5f9', showConfirmButton: false });
        fetchCommissionRequests();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to decline', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData(1);
      fetchCommissionRequests();
    }
  }, [isOpen, fetchData, fetchCommissionRequests]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchData(newPage);
    }
  };

  const filteredOrders = useMemo(() => {
    let filtered = data.paginatedOrders || data.orders;

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.agent?.name?.toLowerCase().includes(search) ||
        order.customerName?.toLowerCase().includes(search) ||
        order.product?.name?.toLowerCase().includes(search) ||
        order.customerPhone?.includes(search)
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'paid') {
        filtered = filtered.filter(o => o.paymentStatus === 'Paid' && o.commissionPaid);
      } else if (statusFilter === 'unpaid') {
        filtered = filtered.filter(o => o.paymentStatus === 'Paid' && !o.commissionPaid);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(o => o.paymentStatus === 'Pending');
      }
    }

    if (selectedAgent) {
      filtered = filtered.filter(o => o.agentId === selectedAgent);
    }

    return filtered;
  }, [data.paginatedOrders, data.orders, searchTerm, statusFilter, selectedAgent]);

  const agentOrders = useMemo(() => {
    const grouped = {};
    data.orders.forEach(order => {
      if (!grouped[order.agentId]) {
        grouped[order.agentId] = {
          agent: order.agent,
          orders: [],
          totalCommission: 0,
          unpaidCommission: 0,
          paidCommission: 0
        };
      }
      grouped[order.agentId].orders.push(order);
      if (order.paymentStatus === 'Paid') {
        grouped[order.agentId].totalCommission += order.commission;
        if (order.commissionPaid) {
          grouped[order.agentId].paidCommission += order.commission;
        } else {
          grouped[order.agentId].unpaidCommission += order.commission;
        }
      }
    });
    return Object.values(grouped).sort((a, b) => b.unpaidCommission - a.unpaidCommission);
  }, [data.orders]);

  const handleSelectOrder = (orderId) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleSelectAllUnpaid = (agentId) => {
    const unpaidOrders = data.orders.filter(
      o => o.agentId === agentId && o.paymentStatus === 'Paid' && !o.commissionPaid
    );
    const unpaidIds = unpaidOrders.map(o => o.id);
    
    const allSelected = unpaidIds.every(id => selectedOrders.includes(id));
    if (allSelected) {
      setSelectedOrders(prev => prev.filter(id => !unpaidIds.includes(id)));
    } else {
      setSelectedOrders(prev => [...new Set([...prev, ...unpaidIds])]);
    }
  };

  const handlePayCommission = async (agentId) => {
    const ordersToPay = selectedOrders.filter(orderId => {
      const order = data.orders.find(o => o.id === orderId);
      return order && order.agentId === agentId && order.paymentStatus === 'Paid' && !order.commissionPaid;
    });

    if (ordersToPay.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Orders Selected',
        text: 'Please select unpaid orders to pay commission',
        background: '#1e293b',
        color: '#f1f5f9'
      });
      return;
    }

    const totalAmount = ordersToPay.reduce((sum, orderId) => {
      const order = data.orders.find(o => o.id === orderId);
      return sum + (order?.commission || 0);
    }, 0);

    const agent = data.orders.find(o => o.agentId === agentId)?.agent;

    const result = await Swal.fire({
      title: 'Confirm Commission Payment',
      html: `
        <div style="text-align: left; padding: 10px 0;">
          <p><strong>Agent:</strong> ${agent?.name || 'Unknown'}</p>
          <p><strong>Phone:</strong> ${agent?.phone || 'N/A'}</p>
          <p><strong>Orders:</strong> ${ordersToPay.length}</p>
          <p><strong>Total Amount:</strong> ${formatAmount(totalAmount)}</p>
          <div style="margin-top: 15px; padding: 10px; background: #0f172a; border-radius: 8px;">
            <p style="margin-bottom: 10px; font-weight: 600;">Payment Method:</p>
            <div style="display: flex; gap: 10px;">
              <label style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px; background: #1e293b; border: 2px solid #10b981; border-radius: 8px; cursor: pointer;">
                <input type="radio" name="paymentMethod" value="momo" checked style="accent-color: #10b981;">
                <span>📱 MoMo</span>
              </label>
              <label style="flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px; background: #1e293b; border: 2px solid #64748b; border-radius: 8px; cursor: pointer;">
                <input type="radio" name="paymentMethod" value="wallet" style="accent-color: #10b981;">
                <span>💳 Wallet</span>
              </label>
            </div>
            <p id="paymentMethodNote" style="margin-top: 10px; font-size: 12px; color: #fbbf24;">MoMo: Commission paid directly, not added to wallet</p>
          </div>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Pay Commission',
      background: '#1e293b',
      color: '#f1f5f9',
      didOpen: () => {
        const radios = document.querySelectorAll('input[name="paymentMethod"]');
        const noteEl = document.getElementById('paymentMethodNote');
        radios.forEach(radio => {
          radio.addEventListener('change', (e) => {
            radios.forEach(r => {
              r.closest('label').style.borderColor = r.checked ? '#10b981' : '#64748b';
            });
            if (e.target.value === 'momo') {
              noteEl.textContent = 'MoMo: Commission paid directly, not added to wallet';
              noteEl.style.color = '#fbbf24';
            } else {
              noteEl.textContent = 'Wallet: Commission will be added to agent\'s wallet balance';
              noteEl.style.color = '#10b981';
            }
          });
        });
      },
      preConfirm: () => {
        const selected = document.querySelector('input[name="paymentMethod"]:checked');
        return selected ? selected.value : 'momo';
      }
    });

    if (result.isConfirmed) {
      const paymentMethod = result.value || 'momo';
      setPayingCommission(true);
      try {
        const res = await axios.post(`${BASE_URL}/api/storefront/admin/commissions/pay`, {
          agentId,
          orderIds: ordersToPay,
          paymentMethod
        }, { headers: getAuthHeaders() });

        if (res.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Commission Paid!',
            text: res.data.message || `${formatAmount(totalAmount)} paid ${paymentMethod === 'momo' ? 'via MoMo' : "to agent's wallet"}`,
            background: '#1e293b',
            color: '#f1f5f9',
            timer: 2000,
            showConfirmButton: false
          });
          setSelectedOrders([]);
          fetchData();
        } else {
          throw new Error(res.data.message || 'Payment failed');
        }
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Payment Failed',
          text: error.response?.data?.message || error.message || 'Failed to pay commission',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      } finally {
        setPayingCommission(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white">Agent Commission Summary</h2>
              <p className="text-emerald-100 text-xs sm:text-sm">Manage and pay agent commissions</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
              <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 p-3 sm:p-4 bg-dark-900/50">
          <div className="bg-dark-800 border border-cyan-500/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              <p className="text-cyan-400 text-xs">Total Orders</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{data.stats.totalOrders || 0}</p>
            <p className="text-dark-400 text-xs mt-1">{data.stats.paidOrders || 0} paid</p>
          </div>
          <div className="bg-dark-800 border border-emerald-500/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <p className="text-emerald-400 text-xs">Total Commission</p>
            </div>
            <p className="text-lg sm:text-xl font-bold text-emerald-400">{formatAmount(data.stats.totalCommission || 0)}</p>
          </div>
          <div className="bg-dark-800 border border-amber-500/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <p className="text-amber-400 text-xs">Unpaid Commission</p>
            </div>
            <p className="text-lg sm:text-xl font-bold text-amber-400">{formatAmount(data.stats.unpaidCommission || 0)}</p>
          </div>
          <div className="bg-dark-800 border border-violet-500/30 rounded-xl p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-violet-400" />
              <p className="text-violet-400 text-xs">Active Agents</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-white">{data.agentSummary?.length || 0}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-3 border-b border-dark-700 gap-2 overflow-x-auto">
          <button onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-emerald-500 text-white' : 'bg-dark-700 text-dark-300 hover:text-white'}`}>
            <PieChart className="w-4 h-4" /> Overview
          </button>
          <button onClick={() => setActiveTab('agents')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'agents' ? 'bg-emerald-500 text-white' : 'bg-dark-700 text-dark-300 hover:text-white'}`}>
            <Users className="w-4 h-4" /> By Agent
          </button>
          <button onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'orders' ? 'bg-emerald-500 text-white' : 'bg-dark-700 text-dark-300 hover:text-white'}`}>
            <DollarSign className="w-4 h-4" /> All Orders
          </button>
          <button onClick={() => setActiveTab('requests')}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'requests' ? 'bg-emerald-500 text-white' : 'bg-dark-700 text-dark-300 hover:text-white'}`}>
            <FileText className="w-4 h-4" /> Requests
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-6">
              {/* Weekly Summary */}
              <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-4 sm:p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-white font-semibold">This Week's Summary</h3>
                  {weeklyData.weekStart && (
                    <span className="text-dark-400 text-sm">
                      ({new Date(weeklyData.weekStart).toLocaleDateString()} - {new Date(weeklyData.weekEnd).toLocaleDateString()})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-dark-400 text-sm">Total Commission</p>
                    <p className="text-2xl font-bold text-emerald-400">{formatAmount(weeklyData.totalCommission)}</p>
                  </div>
                  <div>
                    <p className="text-dark-400 text-sm">Unpaid Commission</p>
                    <p className="text-2xl font-bold text-amber-400">{formatAmount(weeklyData.totalUnpaid)}</p>
                  </div>
                </div>
              </div>

              {/* Top Agents */}
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" /> Top Earning Agents
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentOrders.slice(0, 6).map((item, index) => (
                    <div key={item.agent?.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-emerald-500/30 transition-all">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-dark-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.agent?.name || 'Unknown'}</p>
                          <p className="text-dark-400 text-xs">{item.agent?.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-dark-500 text-xs">Orders</p>
                          <p className="text-white font-medium">{item.orders.length}</p>
                        </div>
                        <div>
                          <p className="text-dark-500 text-xs">Total Earned</p>
                          <p className="text-emerald-400 font-medium">{formatAmount(item.totalCommission)}</p>
                        </div>
                        <div>
                          <p className="text-dark-500 text-xs">Paid</p>
                          <p className="text-cyan-400 font-medium">{formatAmount(item.paidCommission)}</p>
                        </div>
                        <div>
                          <p className="text-dark-500 text-xs">Unpaid</p>
                          <p className="text-amber-400 font-medium">{formatAmount(item.unpaidCommission)}</p>
                        </div>
                      </div>
                      {item.unpaidCommission > 0 && (
                        <button
                          onClick={() => { setActiveTab('agents'); setExpandedAgent(item.agent?.id); }}
                          className="w-full mt-3 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
                        >
                          Pay Commission
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'agents' ? (
            <div className="space-y-4">
              {agentOrders.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No agent commissions found</p>
                </div>
              ) : (
                agentOrders.map((item) => (
                  <div key={item.agent?.id} className="bg-dark-900/50 border border-dark-700 rounded-xl overflow-hidden">
                    {/* Agent Header */}
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-dark-800/50 transition-colors"
                      onClick={() => setExpandedAgent(expandedAgent === item.agent?.id ? null : item.agent?.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                          {item.agent?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{item.agent?.name || 'Unknown Agent'}</p>
                          <p className="text-dark-400 text-sm">{item.orders.length} orders • {item.agent?.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right hidden sm:block">
                          <p className="text-emerald-400 font-semibold">{formatAmount(item.totalCommission)}</p>
                          <p className="text-amber-400 text-sm">{formatAmount(item.unpaidCommission)} unpaid</p>
                        </div>
                        {expandedAgent === item.agent?.id ? (
                          <ChevronUp className="w-5 h-5 text-dark-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-dark-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {expandedAgent === item.agent?.id && (
                      <div className="border-t border-dark-700 p-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div className="bg-dark-800 rounded-lg p-3">
                            <p className="text-dark-400 text-xs">Total Earned</p>
                            <p className="text-emerald-400 font-bold">{formatAmount(item.totalCommission)}</p>
                          </div>
                          <div className="bg-dark-800 rounded-lg p-3">
                            <p className="text-dark-400 text-xs">Paid</p>
                            <p className="text-cyan-400 font-bold">{formatAmount(item.paidCommission)}</p>
                          </div>
                          <div className="bg-dark-800 rounded-lg p-3">
                            <p className="text-dark-400 text-xs">Unpaid</p>
                            <p className="text-amber-400 font-bold">{formatAmount(item.unpaidCommission)}</p>
                          </div>
                        </div>

                        {/* Pay All Button */}
                        {item.unpaidCommission > 0 && (
                          <div className="flex items-center justify-between mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.orders.filter(o => o.paymentStatus === 'Paid' && !o.commissionPaid).every(o => selectedOrders.includes(o.id))}
                                onChange={() => handleSelectAllUnpaid(item.agent?.id)}
                                className="w-4 h-4 rounded text-emerald-500"
                              />
                              <span className="text-dark-300 text-sm">Select all unpaid orders</span>
                            </div>
                            <button
                              onClick={() => handlePayCommission(item.agent?.id)}
                              disabled={payingCommission || !selectedOrders.some(id => item.orders.find(o => o.id === id && !o.commissionPaid))}
                              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {payingCommission ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                              Pay Selected
                            </button>
                          </div>
                        )}

                        {/* Orders Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-dark-800">
                              <tr className="text-left text-dark-400 text-xs">
                                <th className="px-3 py-2">Select</th>
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Product</th>
                                <th className="px-3 py-2">Customer</th>
                                <th className="px-3 py-2">Amount</th>
                                <th className="px-3 py-2">Commission</th>
                                <th className="px-3 py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.orders.map((order) => (
                                <tr key={order.id} className="border-t border-dark-700/50 hover:bg-dark-800/50">
                                  <td className="px-3 py-2">
                                    {order.paymentStatus === 'Paid' && !order.commissionPaid && (
                                      <input
                                        type="checkbox"
                                        checked={selectedOrders.includes(order.id)}
                                        onChange={() => handleSelectOrder(order.id)}
                                        className="w-4 h-4 rounded text-emerald-500"
                                      />
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-dark-300 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                                  <td className="px-3 py-2 text-white text-sm">{order.product?.name}</td>
                                  <td className="px-3 py-2 text-dark-300 text-sm">{order.customerName}</td>
                                  <td className="px-3 py-2 text-cyan-400 text-sm">{formatAmount(order.agentPrice)}</td>
                                  <td className="px-3 py-2 text-emerald-400 font-medium text-sm">{formatAmount(order.commission)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        order.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                        order.paymentStatus === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                                        'bg-red-500/20 text-red-400'
                                      }`}>
                                        {order.paymentStatus}
                                      </span>
                                      {order.commissionPaid && (
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-violet-500/20 text-violet-400 flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" /> Paid
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'orders' ? (
            <div>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search orders..."
                    className="w-full bg-dark-900 border border-dark-600 rounded-lg pl-10 pr-4 py-2 text-white text-sm placeholder-dark-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="paid">Commission Paid</option>
                    <option value="unpaid">Commission Unpaid</option>
                    <option value="pending">Payment Pending</option>
                  </select>
                </div>
              </div>

              {/* Orders Table */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No orders found</p>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-900">
                      <tr className="text-left text-dark-400 text-sm">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Commission</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="border-t border-dark-700 hover:bg-dark-800/50">
                          <td className="px-4 py-3 text-dark-300 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-white">{order.agent?.name}</td>
                          <td className="px-4 py-3 text-dark-300">{order.product?.name}</td>
                          <td className="px-4 py-3 text-dark-300">{order.customerName}</td>
                          <td className="px-4 py-3 text-cyan-400">{formatAmount(order.agentPrice)}</td>
                          <td className="px-4 py-3 text-emerald-400 font-medium">{formatAmount(order.commission)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                order.paymentStatus === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                                order.paymentStatus === 'Pending' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {order.paymentStatus}
                              </span>
                              {order.commissionPaid && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-violet-500/20 text-violet-400">
                                  Commission Paid
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-700">
                    <p className="text-dark-400 text-sm">
                      Showing page {currentPage} of {pagination.totalPages} ({pagination.total} total orders)
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className="p-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === pageNum
                                ? 'bg-emerald-500 text-white'
                                : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= pagination.totalPages}
                        className="p-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center justify-between">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" /> Commission Requests
                </h3>
                <select
                  value={requestsFilter}
                  onChange={(e) => setRequestsFilter(e.target.value)}
                  className="bg-dark-900 border border-dark-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="all">All Requests</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="DECLINED">Declined</option>
                </select>
              </div>

              {commissionRequests.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No commission requests</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-dark-900">
                      <tr className="text-left text-dark-400 text-sm">
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Agent</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Network</th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Commission</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {commissionRequests.map((req) => (
                        <tr key={req.id} className="border-t border-dark-700 hover:bg-dark-800/50">
                          <td className="px-4 py-3 text-dark-300 text-sm">{new Date(req.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-white text-sm">
                            <div>{req.agent?.name || 'Unknown'}</div>
                            <div className="text-dark-500 text-xs">{req.agent?.phone}</div>
                          </td>
                          <td className="px-4 py-3 text-dark-300 text-sm">{req.customerPhone}</td>
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
                          </td>
                          <td className="px-4 py-3">
                            {req.status === 'PENDING' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveRequest(req)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors"
                                  title="Approve"
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  onClick={() => handleDeclineRequest(req)}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-medium transition-colors"
                                  title="Decline"
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" /> Decline
                                </button>
                              </div>
                            ) : (
                              <span className="text-dark-500 text-xs">
                                {req.adminNotes ? req.adminNotes.slice(0, 40) : '-'}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCommissionModal;

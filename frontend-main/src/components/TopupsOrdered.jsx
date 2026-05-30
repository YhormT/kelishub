import React, { useState, useEffect, useCallback } from 'react';
import { X, Wallet, CheckCircle, XCircle, Clock, Loader2, RefreshCw, Search, Filter, Trash2 } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

const TopupsOrdered = ({ isOpen = false, onClose, justCount = 0, hasNewTopups = false, setHasNewTopups }) => {
  const [topups, setTopups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTopups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/topups?startDate=2024-03-01&endDate=2030-03-14`, { headers: getAuthHeaders() });
      setTopups(response.data || []);
      if (setHasNewTopups) setHasNewTopups(false);
    } catch (error) {
      console.error('Error fetching topups:', error);
    } finally {
      setLoading(false);
    }
  }, [setHasNewTopups]);

  useEffect(() => {
    if (isOpen) fetchTopups();
  }, [isOpen, fetchTopups]);

  const handleDelete = async (topupId) => {
    const result = await Swal.fire({
      title: 'Delete Top-up?',
      text: 'This action cannot be undone. Are you sure?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it',
      background: '#1e293b',
      color: '#f1f5f9'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`${BASE_URL}/api/topups/${topupId}`, { headers: getAuthHeaders() });
        Swal.fire({
          icon: 'success',
          title: 'Deleted!',
          text: 'Top-up record has been deleted.',
          timer: 1500,
          background: '#1e293b',
          color: '#f1f5f9',
          showConfirmButton: false
        });
        fetchTopups();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'Failed to delete top-up',
          background: '#1e293b',
          color: '#f1f5f9'
        });
      }
    }
  };

  const filteredTopups = topups.filter(t => {
    const matchesSearch = t.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.user?.phone?.includes(searchQuery) ||
      t.referenceId?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      t.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'failed': case 'rejected': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved': return <CheckCircle className="w-3 h-3" />;
      case 'failed': case 'rejected': return <XCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  // Calculate stats
  const stats = {
    total: topups.length,
    approved: topups.filter(t => t.status?.toLowerCase() === 'approved').length,
    pending: topups.filter(t => t.status?.toLowerCase() === 'pending').length,
    failed: topups.filter(t => ['failed', 'rejected'].includes(t.status?.toLowerCase())).length,
    totalAmount: topups.filter(t => t.status?.toLowerCase() === 'approved').reduce((sum, t) => sum + (t.amount || 0), 0)
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wallet className="w-8 h-8 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Top-up History</h2>
                  <p className="text-emerald-100 text-sm">{stats.total} total • GHS {stats.totalAmount.toFixed(2)} credited</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchTopups} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                  <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="p-4 border-b border-dark-700 grid grid-cols-4 gap-3">
              <div className="bg-dark-900/50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-dark-400 text-xs">Total</p>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{stats.approved}</p>
                <p className="text-dark-400 text-xs">Approved</p>
              </div>
              <div className="bg-amber-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                <p className="text-dark-400 text-xs">Pending</p>
              </div>
              <div className="bg-red-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
                <p className="text-dark-400 text-xs">Failed</p>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="p-4 border-b border-dark-700 flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input type="text" placeholder="Search by name, phone, or reference..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-600 rounded-xl pl-10 pr-4 py-3 text-white placeholder-dark-500 focus:border-emerald-500 focus:outline-none" />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-dark-900 border border-dark-600 rounded-xl pl-9 pr-4 py-3 text-white focus:border-emerald-500 focus:outline-none appearance-none cursor-pointer">
                  <option value="all">All Status</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
              ) : filteredTopups.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No top-ups found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTopups.map((topup) => (
                    <div key={topup.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-white font-semibold">{topup.user?.name || 'Unknown'}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusStyle(topup.status)}`}>
                              {getStatusIcon(topup.status)}
                              {topup.status || 'Pending'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-dark-400">
                            <span>Phone: {topup.user?.phone || 'N/A'}</span>
                            <span className="text-emerald-400 font-semibold">GHS {topup.amount?.toFixed(2)}</span>
                            <span>{new Date(topup.createdAt).toLocaleString()}</span>
                          </div>
                          {topup.referenceId && (
                            <p className="text-dark-500 text-xs mt-1 font-mono">Ref: {topup.referenceId}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDelete(topup.id)}
                          className="ml-4 p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors group"
                          title="Delete top-up"
                        >
                          <Trash2 className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopupsOrdered;

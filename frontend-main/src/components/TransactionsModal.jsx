import React, { useState, useEffect, useMemo } from 'react';
import { History, X, Search, Loader2, Filter, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';

const TransactionsModal = ({ isOpen, onClose }) => {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    amountType: '' // 'credit', 'debit', or ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  useEffect(() => {
    if (isOpen) {
      fetchTransactions();
    }
  }, [isOpen]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/users/${userId}/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const txData = Array.isArray(response.data?.data) 
        ? response.data.data 
        : (Array.isArray(response.data) ? response.data : []);
      setTransactions(txData);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesSearch = !filters.search || 
        tx.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
        tx.reference?.toLowerCase().includes(filters.search.toLowerCase()) ||
        tx.type?.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesType = !filters.type || tx.type === filters.type;
      
      const matchesAmountType = !filters.amountType || 
        (filters.amountType === 'credit' && tx.amount >= 0) ||
        (filters.amountType === 'debit' && tx.amount < 0);
      
      const txDate = new Date(tx.createdAt);
      const matchesDateFrom = !filters.dateFrom || txDate >= new Date(filters.dateFrom);
      const matchesDateTo = !filters.dateTo || txDate <= new Date(filters.dateTo + 'T23:59:59');
      
      return matchesSearch && matchesType && matchesAmountType && matchesDateFrom && matchesDateTo;
    });
  }, [transactions, filters]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const transactionTypes = useMemo(() => {
    return [...new Set(transactions.map(tx => tx.type).filter(Boolean))];
  }, [transactions]);

  const stats = useMemo(() => {
    const credits = transactions.filter(tx => tx.amount >= 0);
    const debits = transactions.filter(tx => tx.amount < 0);
    return {
      totalCredits: credits.reduce((sum, tx) => sum + (tx.amount || 0), 0),
      totalDebits: Math.abs(debits.reduce((sum, tx) => sum + (tx.amount || 0), 0)),
      count: transactions.length
    };
  }, [transactions]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const resetFilters = () => {
    setFilters({ type: '', dateFrom: '', dateTo: '', search: '', amountType: '' });
    setCurrentPage(1);
  };

  const getTypeColor = (type) => {
    switch (type?.toUpperCase()) {
      case 'TOPUP_APPROVED': case 'TOPUP': case 'CREDIT': return 'bg-emerald-500/10 text-emerald-400';
      case 'TOPUP_REJECTED': case 'LOAN_DEDUCTION': return 'bg-red-500/10 text-red-400';
      case 'ORDER': return 'bg-blue-500/10 text-blue-400';
      case 'CART_ADD': return 'bg-orange-500/10 text-orange-400';
      case 'CART_REMOVE': return 'bg-purple-500/10 text-purple-400';
      case 'CANCELLED': return 'bg-purple-500/10 text-purple-400';
      default: return 'bg-dark-700 text-dark-300';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">Transactions</h2>
              <p className="text-cyan-100 text-xs">{stats.count} total</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg active:scale-95">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Stats - Compact on mobile */}
        <div className="p-3 border-b border-dark-700 flex gap-2">
          <div className="flex-1 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
            <p className="text-emerald-400 font-bold text-sm">+GHS {stats.totalCredits.toFixed(2)}</p>
            <p className="text-dark-400 text-xs">Credits</p>
          </div>
          <div className="flex-1 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <p className="text-red-400 font-bold text-sm">-GHS {stats.totalDebits.toFixed(2)}</p>
            <p className="text-dark-400 text-xs">Debits</p>
          </div>
        </div>

        {/* Filters - Mobile optimized */}
        <div className="p-3 border-b border-dark-700 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setCurrentPage(1); }}
              placeholder="Search transactions..."
              className="w-full bg-dark-900/50 border border-dark-600 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filters.type}
              onChange={(e) => { setFilters(f => ({ ...f, type: e.target.value })); setCurrentPage(1); }}
              className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Types</option>
              {transactionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
              {!transactionTypes.includes('CANCELLED') && <option value="CANCELLED">CANCELLED</option>}
            </select>
            <select
              value={filters.amountType}
              onChange={(e) => { setFilters(f => ({ ...f, amountType: e.target.value })); setCurrentPage(1); }}
              className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Amounts</option>
              <option value="credit">Credits Only</option>
              <option value="debit">Debits Only</option>
            </select>
            <button onClick={resetFilters} className="p-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl text-dark-300 active:scale-95" title="Reset">
              <Filter className="w-4 h-4" />
            </button>
            <button onClick={fetchTransactions} className="p-2.5 bg-dark-700 hover:bg-dark-600 rounded-xl text-dark-300 active:scale-95">
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Date filters - hidden on mobile, shown on larger screens */}
          <div className="hidden sm:flex gap-2">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setCurrentPage(1); }}
              className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => { setFilters(f => ({ ...f, dateTo: e.target.value })); setCurrentPage(1); }}
              className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-3 py-2 text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Transaction List - Card layout on mobile, table on desktop */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-dark-600 mx-auto mb-4" />
              <p className="text-dark-400">No transactions found</p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden divide-y divide-dark-700">
                {paginatedTransactions.map((tx) => (
                  <div key={tx.id} className="p-3 hover:bg-dark-700/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(tx.type)}`}>
                            {tx.type || 'N/A'}
                          </span>
                          <span className="text-dark-500 text-xs">#{tx.id}</span>
                        </div>
                        <p className="text-dark-300 text-sm truncate">{tx.description || 'No description'}</p>
                        <p className="text-dark-500 text-xs mt-1">{formatDate(tx.createdAt)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {tx.amount >= 0 ? '+' : ''}GHS {(tx.amount || 0).toFixed(2)}
                        </p>
                        <p className="text-dark-500 text-xs">Bal: GHS {(tx.balance || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <table className="hidden sm:table w-full">
                <thead className="sticky top-0 bg-dark-800">
                  <tr className="text-left text-dark-400 text-sm border-b border-dark-700">
                    <th className="p-3 font-medium">ID</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Description</th>
                    <th className="p-3 font-medium text-right">Amount</th>
                    <th className="p-3 font-medium text-right">Balance</th>
                    <th className="p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors">
                      <td className="p-3 text-white font-medium">#{tx.id}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(tx.type)}`}>
                          {tx.type || 'N/A'}
                        </span>
                      </td>
                      <td className="p-3 text-dark-300 max-w-xs truncate">{tx.description || 'N/A'}</td>
                      <td className={`p-3 text-right font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {tx.amount >= 0 ? '+' : ''}GHS {(tx.amount || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-dark-400">
                        GHS {(tx.balance || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-dark-500 text-sm">{formatDate(tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Pagination - Compact on mobile */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-dark-700 flex items-center justify-between">
            <p className="text-dark-400 text-xs sm:text-sm hidden sm:block">
              {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <p className="text-dark-400 text-xs sm:hidden">
              {currentPage}/{totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 disabled:opacity-50 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="px-3 py-2 text-white text-sm hidden sm:block">Page {currentPage}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-300 disabled:opacity-50 active:scale-95"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsModal;

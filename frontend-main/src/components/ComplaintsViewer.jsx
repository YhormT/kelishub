import React, { useState, useEffect, useRef, memo } from 'react';
import { MessageSquareWarning, X, CheckCircle, Clock, AlertCircle, Phone, Loader2, RefreshCw, Trash2, MessageCircle, Copy } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';
import socketIO from 'socket.io-client';

// Isolated update-status dialog. Owns its own `notes` input state so typing here
// does NOT re-render the parent ComplaintsViewer (and its long list of complaints).
// Without this isolation, every keystroke was reconciling 50+ complaint rows.
const UpdateStatusDialog = memo(({ complaint, initialNotes, onClose, onUpdate }) => {
  const [notes, setNotes] = useState(initialNotes || '');
  if (!complaint) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-white mb-4">Update Complaint Status</h3>
        <textarea className="w-full bg-dark-900 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 resize-none mb-4"
          placeholder="Admin notes (optional)" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-3 mb-3">
          <button onClick={() => onUpdate(complaint.id, 'reviewed', notes)}
            className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg font-medium hover:bg-cyan-600">Mark Reviewed</button>
          <button onClick={() => onUpdate(complaint.id, 'resolved', notes)}
            className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600">Mark Resolved</button>
        </div>
        <button onClick={onClose} className="w-full px-4 py-2 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600">Cancel</button>
      </div>
    </div>
  );
});

const ComplaintsViewer = ({ isOpen, onClose }) => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const statusFilterRef = useRef(statusFilter);
  const socketRef = useRef(null);

  // Keep ref in sync so fetch always uses latest filter
  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

  const fetchComplaints = async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role?.toUpperCase() !== 'ADMIN') return;

    setLoading(true);
    try {
      const currentFilter = statusFilterRef.current;
      const statusParam = currentFilter !== 'all' ? `?status=${currentFilter}` : '';
      const res = await axios.get(`${BASE_URL}/api/complaints${statusParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComplaints(res.data.data || []);
    } catch (err) {
      console.error('Error fetching complaints:', err);
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingCount = async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role?.toUpperCase() !== 'ADMIN') return;

    try {
      const res = await axios.get(`${BASE_URL}/api/complaints/pending/count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPendingCount(res.data.data?.count || 0);
    } catch (err) {
      // Silently fail - token may be expired
    }
  };

  // Pending count polling (always runs for admin)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (!token || role?.toUpperCase() !== 'ADMIN') return;

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch complaints every time modal opens or filter changes
  useEffect(() => {
    if (isOpen) {
      fetchComplaints();
    }
  }, [isOpen, statusFilter]);

  // Socket: single persistent connection while modal is open
  useEffect(() => {
    if (!isOpen) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('new-complaint', () => {
      fetchComplaints();
      fetchPendingCount();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOpen]);

  const handleUpdateStatus = async (id, newStatus, adminNotes = '') => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${BASE_URL}/api/complaints/${id}`, { status: newStatus, adminNotes }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      Swal.fire({ icon: 'success', title: 'Status Updated', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      setSelectedComplaint(null);
      fetchComplaints();
      fetchPendingCount();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Update Failed', text: err.response?.data?.message || 'Failed to update', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Complaint?', text: 'This action cannot be undone', icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${BASE_URL}/api/complaints/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        fetchComplaints();
        fetchPendingCount();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'Delete Failed', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'reviewed': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'resolved': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-dark-700 text-dark-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'reviewed': return <AlertCircle className="w-3 h-3" />;
      case 'resolved': return <CheckCircle className="w-3 h-3" />;
      default: return <Clock className="w-3 h-3" />;
    }
  };

  const openWhatsApp = (complaint) => {
    const phone = complaint.whatsappNumber || complaint.mobileNumber;
    if (!phone) return;
    let formatted = phone.replace(/\D/g, '');
    if (formatted.startsWith('0')) formatted = '233' + formatted.slice(1);
    const message = `Hello! Regarding your complaint (ID: ${complaint.id}):\n"${complaint.message.slice(0, 100)}..."`;
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <>
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageSquareWarning className="w-8 h-8 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Customer Complaints</h2>
                  <p className="text-white/80 text-sm">{pendingCount} pending</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={fetchComplaints} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                  <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-b border-dark-700 bg-dark-900/50">
              {['all', 'pending', 'reviewed', 'resolved'].map((filter) => (
                <button key={filter} onClick={() => setStatusFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === filter ? 'bg-red-500 text-white' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                  }`}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto flex-1 min-h-[60vh]">
              {loading ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-red-500" /></div>
              ) : complaints.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquareWarning className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                  <p className="text-dark-400">No complaints found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {complaints.map((complaint) => (
                    <div key={complaint.id} className="bg-dark-900/50 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusStyle(complaint.status)}`}>
                              {getStatusIcon(complaint.status)} {complaint.status}
                            </span>
                            <span className="text-xs text-dark-500">
                              Submitted: {new Date(complaint.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}, {new Date(complaint.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                            </span>
                            {(complaint.complaintTime || complaint.complaintDate) && (
                              <span className="text-xs text-amber-400">
                                Issue Time: {complaint.complaintTime || '--:--'}{complaint.complaintDate ? `, ${new Date(complaint.complaintDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric', year: 'numeric' })}` : ''}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mb-2 text-sm">
                            <span className="text-cyan-400 font-medium">ID: #{complaint.id}</span>
                            <span className="flex items-center gap-1 text-dark-400">
                              <Phone className="w-4 h-4" /> {complaint.mobileNumber}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(complaint.mobileNumber);
                                  const btn = e.currentTarget;
                                  btn.classList.add('text-emerald-400');
                                  setTimeout(() => btn.classList.remove('text-emerald-400'), 1500);
                                }}
                                title="Copy number"
                                className="p-1 hover:bg-dark-700 rounded transition-colors"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </span>
                            {complaint.orderId && <span className="text-dark-500">Order: #{complaint.orderId}</span>}
                          </div>
                          <p className="text-dark-200">{complaint.message}</p>
                          {complaint.adminNotes && (
                            <div className="mt-2 p-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-sm">
                              <span className="font-medium text-cyan-400">Admin Notes:</span>
                              <p className="text-cyan-300">{complaint.adminNotes}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openWhatsApp(complaint)} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30">
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          {complaint.status !== 'resolved' && (
                            <button onClick={() => setSelectedComplaint(complaint)}
                              className="px-3 py-2 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600">Update</button>
                          )}
                          <button onClick={() => handleDelete(complaint.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      <UpdateStatusDialog
        complaint={selectedComplaint}
        initialNotes={selectedComplaint?.adminNotes || ''}
        onClose={() => setSelectedComplaint(null)}
        onUpdate={handleUpdateStatus}
      />
    </>
  );
};

export default ComplaintsViewer;

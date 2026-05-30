import React, { useState } from 'react';
import { ClipboardList, X, Send, Loader2 } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const PasteOrders = ({ isOpen, onClose, onUploadSuccess }) => {
  const [orderText, setOrderText] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);

  const networks = [
    { value: 'MTN', label: 'MTN' },
    { value: 'AIRTEL TIGO', label: 'Airtel Tigo' },
    { value: 'TELECEL', label: 'Telecel' }
  ];

  const handleSubmit = async () => {
    if (!orderText.trim()) {
      Swal.fire({
        title: 'No Data',
        text: 'Please paste your order data.',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    if (!selectedNetwork) {
      Swal.fire({
        title: 'Network Required',
        text: 'Please select a network.',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setIsSubmitting(true);
    setErrors([]);

    try {
      const token = localStorage.getItem('token');
      const agentId = localStorage.getItem('userId');

      const response = await axios.post(
        `${BASE_URL}/api/order/paste-orders`,
        { agentId, network: selectedNetwork, textData: orderText },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        title: 'Orders Submitted',
        text: response.data.message || 'Your orders have been submitted successfully.',
        icon: 'success',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });

      setOrderText('');
      setSelectedNetwork('');
      if (onClose) onClose();
      if (onUploadSuccess) onUploadSuccess();
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData && errorData.errorReport) {
        setErrors(errorData.errorReport);
        Swal.fire({
          title: 'Validation Errors',
          text: 'Some entries have errors. Please check and try again.',
          icon: 'error',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
      } else {
        Swal.fire({
          title: 'Submission Failed',
          text: errorData?.message || 'Failed to submit orders.',
          icon: 'error',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
        <div className="p-6 border-b border-dark-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <ClipboardList className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Paste Orders</h2>
          </div>
          <button onClick={() => { if (onClose) onClose(); setOrderText(''); setSelectedNetwork(''); }} className="text-dark-500 hover:text-dark-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-dark-400 text-sm mb-4">
            Paste phone numbers and bundle amounts below. Each entry on a new line: <code className="bg-dark-700 px-1 rounded">0244123456 50</code>
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-300 mb-2">Select Network</label>
            <select
              value={selectedNetwork}
              onChange={(e) => setSelectedNetwork(e.target.value)}
              className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-all"
            >
              <option value="">-- Select a Network --</option>
              {networks.map((net) => (
                <option key={net.value} value={net.value}>{net.label}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-300 mb-2">Phone Numbers & Bundle Amounts</label>
            <textarea
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              placeholder="0241234567 10&#10;0551234567 20&#10;0201234567 100"
              rows={8}
              className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all resize-none font-mono text-sm"
            />
          </div>

          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <h3 className="text-sm font-bold text-red-400 mb-2">Validation Errors</h3>
              <ul className="text-sm text-red-300 space-y-1 max-h-24 overflow-y-auto">
                {errors.map((err, index) => (
                  <li key={index}>Row {err.row}: {err.errors?.join(', ') || err.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { if (onClose) onClose(); setOrderText(''); setSelectedNetwork(''); }}
              className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-xl font-semibold transition-all border border-dark-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !orderText.trim() || !selectedNetwork}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="w-5 h-5" /> Submit</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasteOrders;

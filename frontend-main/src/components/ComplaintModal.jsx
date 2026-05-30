import React, { useState } from 'react';
import { X, MessageSquareWarning, Phone, Send, Loader2 } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const ComplaintModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    orderId: '',
    mobileNumber: '',
    whatsappNumber: '',
    message: '',
    complaintDate: '',
    complaintTime: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.mobileNumber || !formData.message) {
      Swal.fire({
        title: 'Missing Information',
        text: 'Please fill in all required fields.',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await axios.post(`${BASE_URL}/api/complaints`, formData);
      
      Swal.fire({
        title: 'Complaint Submitted',
        text: 'Your complaint has been submitted successfully. We will review it shortly.',
        icon: 'success',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      
      setFormData({
        orderId: '',
        mobileNumber: '',
        whatsappNumber: '',
        message: '',
        complaintDate: '',
        complaintTime: ''
      });
      onClose();
    } catch (error) {
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.message || 'Failed to submit complaint.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-dark-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-xl">
              <MessageSquareWarning className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">File a Complaint</h2>
          </div>
          <button onClick={onClose} className="text-dark-500 hover:text-dark-300 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Order ID (Optional)</label>
            <input
              type="text"
              name="orderId"
              value={formData.orderId}
              onChange={handleChange}
              placeholder="Enter order ID if available"
              className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-dark-300 mb-2">
              <Phone className="w-4 h-4 text-cyan-500" />
              Mobile Number *
            </label>
            <input
              type="tel"
              name="mobileNumber"
              value={formData.mobileNumber}
              onChange={(e) => handleChange({ target: { name: 'mobileNumber', value: e.target.value.replace(/\D/g, '') } })}
              placeholder="0XX XXX XXXX"
              maxLength={10}
              required
              className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">WhatsApp Number (Optional)</label>
            <input
              type="tel"
              name="whatsappNumber"
              value={formData.whatsappNumber}
              onChange={(e) => handleChange({ target: { name: 'whatsappNumber', value: e.target.value.replace(/\D/g, '') } })}
              placeholder="0XX XXX XXXX"
              maxLength={10}
              className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Date of Issue</label>
              <input
                type="date"
                name="complaintDate"
                value={formData.complaintDate}
                onChange={handleChange}
                className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Time of Issue</label>
              <input
                type="time"
                name="complaintTime"
                value={formData.complaintTime}
                onChange={handleChange}
                className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white focus:border-cyan-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Complaint Details *</label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleChange}
              placeholder="Please describe your issue in detail..."
              rows={4}
              required
              className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-xl font-semibold transition-all border border-dark-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
              ) : (
                <><Send className="w-5 h-5" /> Submit</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ComplaintModal;

import React, { useState } from 'react';
import { X, Plus, Table2 } from 'lucide-react';

const BeneficiaryTableModal = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState([]);
  const [formData, setFormData] = useState({
    beneficiaryNumber: '',
    minutes: '',
    sms: '',
    dataSize: '',
    processingReport: 'Validating...',
    failureReason: '',
    uploadedDateTime: ''
  });

  // Format date as "20th, Feb. 2026 01:11PM"
  const formatDate = (dateInput) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const day = date.getDate();
    const suffix = (day === 1 || day === 21 || day === 31) ? 'st' 
      : (day === 2 || day === 22) ? 'nd' 
      : (day === 3 || day === 23) ? 'rd' : 'th';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}${suffix}, ${month}. ${year} ${hours}:${minutes}${ampm}`;
  };

  // Convert phone number: if starts with 0, replace with 233
  const formatPhoneNumber = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      return '233' + digits.slice(1);
    }
    return digits;
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, beneficiaryNumber: formatted }));
  };

  const handleMinutesChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, minutes: value }));
  };

  const handleSmsChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, sms: value }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.beneficiaryNumber.trim()) return;
    
    const newEntry = {
      id: Date.now(),
      beneficiaryNumber: formData.beneficiaryNumber,
      minutes: formData.minutes ? `${formData.minutes} Minutes` : '0 Minutes',
      sms: formData.sms ? `${formData.sms} SMS` : '0 SMS',
      dataSize: formData.dataSize || '-',
      processingReport: formData.processingReport || 'Validating...',
      failureReason: formData.failureReason || '',
      uploadedDateTime: formData.uploadedDateTime || ''
    };
    
    setEntries(prev => [newEntry, ...prev]);
    setFormData({
      beneficiaryNumber: '',
      minutes: '',
      sms: '',
      dataSize: '',
      processingReport: 'Validating...',
      failureReason: '',
      uploadedDateTime: ''
    });
  };

  // Generate data size options 1GB to 50GB
  const dataSizeOptions = Array.from({ length: 50 }, (_, i) => `${i + 1} GB`);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Table2 className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold text-white">Beneficiary Records</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-gray-50 border-b border-gray-300">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiary Number</label>
              <input
                type="text"
                value={formData.beneficiaryNumber}
                onChange={handlePhoneChange}
                placeholder="0244450003"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minutes</label>
              <input
                type="text"
                value={formData.minutes}
                onChange={handleMinutesChange}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">SMS</label>
              <input
                type="text"
                value={formData.sms}
                onChange={handleSmsChange}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data Size</label>
              <select
                name="dataSize"
                value={formData.dataSize}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
              >
                <option value="">Select</option>
                {dataSizeOptions.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Processing Report</label>
              <select
                name="processingReport"
                value={formData.processingReport}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
              >
                <option value="Validating...">Validating...</option>
                <option value="Failed">Failed</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Failure Reason</label>
              <input
                type="text"
                name="failureReason"
                value={formData.failureReason}
                onChange={handleInputChange}
                placeholder="N/A"
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:border-gray-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                name="uploadedDateTime"
                value={formData.uploadedDateTime}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-800 focus:border-gray-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
        </form>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse border border-gray-300" style={{fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'}}>
            <thead className="bg-gray-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">Beneficiary Number</th>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">Minutes</th>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">SMS</th>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">Data Size</th>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">Processing Report</th>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">Failure Reason</th>
                <th className="px-3 py-2 text-left text-xs font-normal text-gray-700 border border-gray-300">Uploaded Date & Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-400 border border-gray-300">
                    <Table2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No entries yet. Add a beneficiary record above.</p>
                  </td>
                </tr>
              ) : (
                entries.map((entry, index) => (
                  <tr key={entry.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{entry.beneficiaryNumber}</td>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{entry.minutes}</td>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{entry.sms}</td>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{entry.dataSize}</td>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{entry.processingReport}</td>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{entry.failureReason}</td>
                    <td className="px-3 py-2 text-sm font-normal text-gray-800 border border-gray-300">{formatDate(entry.uploadedDateTime)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="p-3 bg-gray-50 border-t border-gray-300 flex justify-between items-center">
            <span className="text-sm text-gray-500">{entries.length} record(s)</span>
            <button
              onClick={() => setEntries([])}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeneficiaryTableModal;

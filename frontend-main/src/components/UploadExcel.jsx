import React, { useState, useRef } from 'react';
import { Upload, X, FileSpreadsheet, Loader2, CheckCircle, Download } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const UploadExcel = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);

  const networks = [
    { value: 'MTN', label: 'MTN' },
    { value: 'AIRTEL TIGO', label: 'Airtel Tigo' },
    { value: 'TELECEL', label: 'Telecel' }
  ];

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      if (!validTypes.includes(selectedFile.type)) {
        Swal.fire({
          title: 'Invalid File',
          text: 'Please select an Excel or CSV file.',
          icon: 'error',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    // Use backend endpoint for template download - include token for auth
    const token = localStorage.getItem('token');
    window.open(`${BASE_URL}/order/download-simplified-template?token=${token}`, '_blank');
  };

  const handleUpload = async () => {
    if (!file) {
      Swal.fire({
        title: 'No File Selected',
        text: 'Please choose an Excel file to upload.',
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
        text: 'Please select a network before uploading.',
        icon: 'warning',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrors([]);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('agentId', localStorage.getItem('userId'));
    formData.append('network', selectedNetwork);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${BASE_URL}/order/upload-simplified`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      const result = response.data;
      if (response.status === 200 && result.success) {
        Swal.fire({
          title: 'Upload Successful',
          html: `<div class="text-left"><p><strong>Total Rows:</strong> ${result.summary?.total || 0}</p><p><strong>Added to Cart:</strong> ${result.summary?.successful || 0}</p></div>`,
          icon: 'success',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
        setFile(null);
        setSelectedNetwork('');
        if (onClose) onClose();
        if (onUploadSuccess) onUploadSuccess();
      } else {
        Swal.fire({
          title: 'Upload Failed',
          text: result.message || 'Failed to upload file.',
          icon: 'error',
          background: '#1e293b',
          color: '#f1f5f9',
          confirmButtonColor: '#06b6d4'
        });
      }
    } catch (error) {
      const errorData = error.response?.data;
      const errorItems = errorData?.errors || errorData?.errorReport || [];
      setErrors(errorItems);
      
      Swal.fire({
        title: 'Upload Failed',
        text: errorData?.message || 'Failed to upload file.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="p-6 border-b border-dark-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Upload Excel File</h2>
          </div>
          <button onClick={() => { if (onClose) onClose(); setFile(null); setSelectedNetwork(''); }} className="text-dark-500 hover:text-dark-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-dark-400 text-sm">Upload an Excel file with phone numbers and bundle amounts</p>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-all text-sm"
            >
              <Download className="w-4 h-4" />
              Template
            </button>
          </div>

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

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-dark-600 hover:border-cyan-500/50 hover:bg-dark-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {file ? (
              <div className="flex flex-col items-center">
                <CheckCircle className="w-12 h-12 text-emerald-400 mb-4" />
                <p className="text-white font-medium mb-1">{file.name}</p>
                <p className="text-dark-500 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Upload className="w-12 h-12 text-dark-500 mb-4" />
                <p className="text-white font-medium mb-1">Click to upload</p>
                <p className="text-dark-500 text-sm">Excel or CSV files only</p>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <h3 className="text-sm font-bold text-red-400 mb-2">Validation Errors</h3>
              <ul className="text-sm text-red-300 space-y-1 max-h-24 overflow-y-auto">
                {errors.map((err, index) => (
                  <li key={index}>Row {err.row}: {err.errors?.join(', ') || err.message}</li>
                ))}
              </ul>
            </div>
          )}

          {isUploading && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-dark-400 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { if (onClose) onClose(); setFile(null); setSelectedNetwork(''); }}
              className="flex-1 py-3 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-xl font-semibold transition-all border border-dark-600"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !selectedNetwork || isUploading}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-5 h-5" /> Upload</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadExcel;

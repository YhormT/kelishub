import React, { useState, useEffect, useCallback } from 'react';
import { X, Key, Plus, Trash2, Loader2, Copy, Check, Shield, ShieldOff, Globe, Clock, Hash, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const ExternalApiKeys = ({ isOpen, onClose }) => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);

  const getHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/external/admin/keys`, { headers: getHeaders() });
      setApiKeys(res.data?.data || []);
    } catch (error) {
      console.error('Error fetching API keys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchApiKeys();
      setNewlyCreatedKey(null);
      setShowCreateForm(false);
      setPartnerName('');
    }
  }, [isOpen, fetchApiKeys]);

  const handleCreate = async () => {
    if (!partnerName.trim()) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Partner name is required', background: '#1e293b', color: '#f1f5f9' });
      return;
    }
    setCreating(true);
    try {
      const res = await axios.post(`${BASE_URL}/api/external/admin/keys`, { partnerName: partnerName.trim() }, { headers: getHeaders() });
      setNewlyCreatedKey(res.data?.data);
      setPartnerName('');
      setShowCreateForm(false);
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'API Key Created!', text: 'Copy the key now — it won\'t be shown again.', background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'Failed to create API key', background: '#1e293b', color: '#f1f5f9' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id, name) => {
    const result = await Swal.fire({
      title: 'Revoke API Key?',
      text: `This will disable the key for "${name}". They won't be able to send orders.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Revoke',
      background: '#1e293b',
      color: '#f1f5f9'
    });
    if (!result.isConfirmed) return;

    try {
      await axios.patch(`${BASE_URL}/api/external/admin/keys/${id}/revoke`, {}, { headers: getHeaders() });
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'Revoked', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to revoke key', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleActivate = async (id) => {
    try {
      await axios.patch(`${BASE_URL}/api/external/admin/keys/${id}/activate`, {}, { headers: getHeaders() });
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'Reactivated', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to activate key', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Delete API Key Permanently?',
      text: `This will permanently delete the key for "${name}". This cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Delete Permanently',
      background: '#1e293b',
      color: '#f1f5f9'
    });
    if (!result.isConfirmed) return;

    try {
      await axios.delete(`${BASE_URL}/api/external/admin/keys/${id}`, { headers: getHeaders() });
      fetchApiKeys();
      Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to delete key', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  if (!isOpen) return null;

  const baseUrl = BASE_URL.replace(/\/$/, '');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Key className="w-6 h-6 text-white" />
            <div>
              <h2 className="text-lg font-bold text-white">External API Keys</h2>
              <p className="text-white/70 text-xs">Manage partner API access for order integration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Newly Created Key Banner */}
          {newlyCreatedKey && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-5 h-5 text-emerald-400" />
                <h3 className="text-emerald-400 font-semibold">New API Key Created for "{newlyCreatedKey.partnerName}"</h3>
              </div>
              <p className="text-amber-400 text-xs mb-3">⚠️ Copy this key now — it will NOT be shown again!</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-dark-900 text-emerald-300 px-3 py-2 rounded-lg text-sm font-mono break-all">
                  {newlyCreatedKey.apiKey}
                </code>
                <button
                  onClick={() => copyToClipboard(newlyCreatedKey.apiKey, 'new')}
                  className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors flex-shrink-0"
                >
                  {copiedKeyId === 'new' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setShowCreateForm(!showCreateForm); setNewlyCreatedKey(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 transition-all"
            >
              <Plus className="w-4 h-4" /> Generate New Key
            </button>
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="flex items-center gap-2 px-4 py-2 bg-dark-700 text-dark-300 hover:text-white rounded-xl text-sm font-medium hover:bg-dark-600 transition-all"
            >
              <Globe className="w-4 h-4" /> {showDocs ? 'Hide' : 'Show'} API Docs
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="bg-dark-900 border border-dark-600 rounded-xl p-4">
              <h3 className="text-white font-semibold mb-3">Generate API Key for Partner</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Partner name (e.g. Friend's Website)"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="flex-1 bg-dark-800 border border-dark-600 rounded-xl px-4 py-2.5 text-white placeholder-dark-500 focus:border-violet-500 focus:outline-none text-sm"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-sm font-medium hover:from-violet-600 hover:to-purple-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          )}

          {/* API Docs Section */}
          {showDocs && (
            <div className="bg-dark-900 border border-dark-600 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-400" /> API Documentation (share with your partner)
              </h3>
              <div className="text-dark-300 text-sm space-y-3">
                <div>
                  <p className="text-white font-medium mb-1">Base URL:</p>
                  <code className="bg-dark-800 text-violet-300 px-2 py-1 rounded text-xs">{baseUrl}/api/external</code>
                </div>
                <div>
                  <p className="text-white font-medium mb-1">Authentication:</p>
                  <p>Include header: <code className="bg-dark-800 text-violet-300 px-2 py-1 rounded text-xs">x-api-key: YOUR_API_KEY</code></p>
                </div>
                <div>
                  <p className="text-white font-medium mb-2">Endpoints:</p>
                  <div className="space-y-1.5">
                    {/* GET /products */}
                    <div className="bg-dark-800 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedEndpoint(expandedEndpoint === 'products' ? null : 'products')} className="w-full p-2.5 flex items-center gap-2 hover:bg-dark-700/50 transition-colors">
                        {expandedEndpoint === 'products' ? <ChevronDown className="w-3.5 h-3.5 text-dark-400" /> : <ChevronRight className="w-3.5 h-3.5 text-dark-400" />}
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                        <code className="text-dark-200 text-xs">/products</code>
                        <span className="text-dark-500 text-xs ml-auto">List products</span>
                      </button>
                      {expandedEndpoint === 'products' && (
                        <div className="px-3 pb-3 pt-0 border-t border-dark-700 space-y-2">
                          <p className="text-dark-400 text-xs mt-2">Returns all available products with current prices and stock.</p>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Response:</p>
                            <pre className="bg-dark-900 text-violet-300 text-xs p-2 rounded overflow-x-auto">{`{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "MTN 1GB Daily",
      "description": "1GB data valid for 24hrs",
      "price": 5.00,
      "stock": 100
    }
  ]
}`}</pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* POST /orders */}
                    <div className="bg-dark-800 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedEndpoint(expandedEndpoint === 'orders' ? null : 'orders')} className="w-full p-2.5 flex items-center gap-2 hover:bg-dark-700/50 transition-colors">
                        {expandedEndpoint === 'orders' ? <ChevronDown className="w-3.5 h-3.5 text-dark-400" /> : <ChevronRight className="w-3.5 h-3.5 text-dark-400" />}
                        <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">POST</span>
                        <code className="text-dark-200 text-xs">/orders</code>
                        <span className="text-dark-500 text-xs ml-auto">Place order</span>
                      </button>
                      {expandedEndpoint === 'orders' && (
                        <div className="px-3 pb-3 pt-0 border-t border-dark-700 space-y-2">
                          <p className="text-dark-400 text-xs mt-2">Submit one or more items for processing. Each item needs a productId, quantity, and mobileNumber.</p>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Request Body:</p>
                            <pre className="bg-dark-900 text-blue-300 text-xs p-2 rounded overflow-x-auto">{`{
  "items": [
    {
      "productId": 1,
      "quantity": 1,
      "mobileNumber": "0241234567"
    }
  ]
}`}</pre>
                          </div>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Response (201):</p>
                            <pre className="bg-dark-900 text-violet-300 text-xs p-2 rounded overflow-x-auto">{`{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "orderId": 456,
    "status": "Pending",
    "totalPrice": 5.00,
    "items": [...],
    "createdAt": "2025-03-03T10:30:00.000Z"
  }
}`}</pre>
                          </div>
                          <p className="text-amber-400/80 text-xs">Save the orderId to check status later.</p>
                        </div>
                      )}
                    </div>

                    {/* GET /orders/:orderId */}
                    <div className="bg-dark-800 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedEndpoint(expandedEndpoint === 'order-status' ? null : 'order-status')} className="w-full p-2.5 flex items-center gap-2 hover:bg-dark-700/50 transition-colors">
                        {expandedEndpoint === 'order-status' ? <ChevronDown className="w-3.5 h-3.5 text-dark-400" /> : <ChevronRight className="w-3.5 h-3.5 text-dark-400" />}
                        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-mono px-2 py-0.5 rounded">GET</span>
                        <code className="text-dark-200 text-xs">/orders/:orderId</code>
                        <span className="text-dark-500 text-xs ml-auto">Check status</span>
                      </button>
                      {expandedEndpoint === 'order-status' && (
                        <div className="px-3 pb-3 pt-0 border-t border-dark-700 space-y-2">
                          <p className="text-dark-400 text-xs mt-2">Check the status of a single order by its ID.</p>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Example: <code className="text-violet-300">GET /orders/456</code></p>
                          </div>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Response:</p>
                            <pre className="bg-dark-900 text-violet-300 text-xs p-2 rounded overflow-x-auto">{`{
  "success": true,
  "data": {
    "orderId": 456,
    "status": "Pending",
    "items": [
      {
        "productName": "MTN 1GB Daily",
        "mobileNumber": "0241234567",
        "status": "Completed"
      }
    ]
  }
}`}</pre>
                          </div>
                          <p className="text-dark-500 text-xs">Possible statuses: Pending, Processing, Completed, Cancelled</p>
                        </div>
                      )}
                    </div>

                    {/* POST /orders/status */}
                    <div className="bg-dark-800 rounded-lg overflow-hidden">
                      <button onClick={() => setExpandedEndpoint(expandedEndpoint === 'bulk-status' ? null : 'bulk-status')} className="w-full p-2.5 flex items-center gap-2 hover:bg-dark-700/50 transition-colors">
                        {expandedEndpoint === 'bulk-status' ? <ChevronDown className="w-3.5 h-3.5 text-dark-400" /> : <ChevronRight className="w-3.5 h-3.5 text-dark-400" />}
                        <span className="bg-blue-500/20 text-blue-400 text-xs font-mono px-2 py-0.5 rounded">POST</span>
                        <code className="text-dark-200 text-xs">/orders/status</code>
                        <span className="text-dark-500 text-xs ml-auto">Bulk check</span>
                      </button>
                      {expandedEndpoint === 'bulk-status' && (
                        <div className="px-3 pb-3 pt-0 border-t border-dark-700 space-y-2">
                          <p className="text-dark-400 text-xs mt-2">Check the status of multiple orders at once (max 50).</p>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Request Body:</p>
                            <pre className="bg-dark-900 text-blue-300 text-xs p-2 rounded overflow-x-auto">{`{
  "orderIds": [456, 457, 458]
}`}</pre>
                          </div>
                          <div>
                            <p className="text-dark-300 text-xs font-medium mb-1">Response:</p>
                            <pre className="bg-dark-900 text-violet-300 text-xs p-2 rounded overflow-x-auto">{`{
  "success": true,
  "data": [
    { "orderId": 456, "status": "Pending", "items": [...] },
    { "orderId": 457, "status": "Completed", "items": [...] }
  ]
}`}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* API Keys List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-12">
              <Key className="w-12 h-12 text-dark-600 mx-auto mb-3" />
              <p className="text-dark-400">No API keys generated yet</p>
              <p className="text-dark-500 text-sm">Click "Generate New Key" to create one for your partner</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-dark-400 text-sm font-medium uppercase tracking-wider">Active Keys ({apiKeys.length})</h3>
              {apiKeys.map((key) => (
                <div key={key.id} className={`bg-dark-900 border rounded-xl p-4 transition-all ${key.isActive ? 'border-dark-600 hover:border-violet-500/30' : 'border-red-500/20 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {key.isActive ? (
                          <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <ShieldOff className="w-4 h-4 text-red-400 flex-shrink-0" />
                        )}
                        <h4 className="text-white font-semibold truncate">{key.partnerName}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${key.isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                          {key.isActive ? 'Active' : 'Revoked'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-2">
                        <code className="text-dark-400 text-xs font-mono">{key.apiKeyPreview}</code>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-dark-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Created: {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                        {key.lastUsedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Hash className="w-3 h-3" />
                          {key.totalOrders} orders
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {key.isActive ? (
                        <button
                          onClick={() => handleRevoke(key.id, key.partnerName)}
                          className="p-2 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Revoke key"
                        >
                          <ShieldOff className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(key.id)}
                          className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                          title="Reactivate key"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(key.id, key.partnerName)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete permanently"
                      >
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
  );
};

export default ExternalApiKeys;

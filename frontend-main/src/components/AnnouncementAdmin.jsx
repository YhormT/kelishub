import React, { useState, useEffect } from 'react';
import { X, Megaphone, Plus, Edit, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const AnnouncementAdmin = ({ isOpen, onClose }) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ title: '', message: '', isActive: true, target: 'agents', priority: 1, targetAudience: 'all' });

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/announcement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(Array.isArray(response.data) ? response.data : (response.data?.data || []));
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (isOpen && role?.toUpperCase() === 'ADMIN') fetchAnnouncements();
  }, [isOpen]);

  const resetForm = () => {
    setFormData({ title: '', message: '', isActive: true, target: 'agents', priority: 1, targetAudience: 'all' });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) {
      Swal.fire({ icon: 'error', title: 'Validation Error', text: 'Please fill in all fields', background: '#1e293b', color: '#f1f5f9' });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (editingId) {
        await axios.put(`${BASE_URL}/api/announcement/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        Swal.fire({ icon: 'success', title: 'Updated!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      } else {
        await axios.post(`${BASE_URL}/api/announcement`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        Swal.fire({ icon: 'success', title: 'Created!', timer: 1500, background: '#1e293b', color: '#f1f5f9' });
      }
      resetForm();
      fetchAnnouncements();
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Operation failed', background: '#1e293b', color: '#f1f5f9' });
    }
  };

  const handleEdit = (announcement) => {
    setFormData({ title: announcement.title, message: announcement.message, isActive: announcement.isActive, target: announcement.target || 'agents', priority: announcement.priority || 1, targetAudience: announcement.targetAudience || 'all' });
    setEditingId(announcement.id);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Announcement?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', background: '#1e293b', color: '#f1f5f9'
    });
    if (result.isConfirmed) {
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`${BASE_URL}/api/announcement/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchAnnouncements();
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', background: '#1e293b', color: '#f1f5f9' });
      }
    }
  };

  const toggleActive = async (id, currentState) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${BASE_URL}/api/announcement/${id}`, { isActive: !currentState }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAnnouncements();
    } catch (error) {
      console.error('Error toggling announcement:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Megaphone className="w-8 h-8 text-white" />
                <div>
                  <h2 className="text-xl font-bold text-white">Manage Announcements</h2>
                  <p className="text-amber-100 text-sm">{announcements.length} announcements</p>
                </div>
              </div>
              <button onClick={() => { onClose(); resetForm(); }} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Form */}
              <div className="bg-dark-900/50 rounded-xl p-4 mb-6 border border-dark-700">
                <h3 className="text-white font-semibold mb-4">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
                <div className="space-y-4">
                  <input type="text" placeholder="Title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-dark-400 focus:border-amber-500 focus:outline-none" />
                  <textarea placeholder="Message" value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} rows={3}
                    className="w-full bg-dark-800 border border-dark-600 rounded-lg px-4 py-3 text-white placeholder-dark-400 resize-none focus:border-amber-500 focus:outline-none" />
                  <div className="flex flex-wrap gap-4">
                    <label className="text-dark-300 text-sm self-center">Display on:</label>
                    <label className="flex items-center gap-2 text-dark-300">
                      <input type="radio" name="target" value="agents" checked={formData.target === 'agents'} onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                        className="w-4 h-4 text-amber-500 focus:ring-amber-500" />
                      Agent Notifications
                    </label>
                    <label className="flex items-center gap-2 text-dark-300">
                      <input type="radio" name="target" value="shop" checked={formData.target === 'shop'} onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                        className="w-4 h-4 text-amber-500 focus:ring-amber-500" />
                      Shop Banner
                    </label>
                    <label className="flex items-center gap-2 text-red-300 font-medium">
                      <input type="radio" name="target" value="shop-alert" checked={formData.target === 'shop-alert'} onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                        className="w-4 h-4 text-red-500 focus:ring-red-500" />
                      Shop Alert (Popup)
                    </label>
                    <label className="flex items-center gap-2 text-emerald-300 font-medium">
                      <input type="radio" name="target" value="product-card" checked={formData.target === 'product-card'} onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                        className="w-4 h-4 text-emerald-500 focus:ring-emerald-500" />
                      Product Card Popup
                    </label>
                  </div>
                  {formData.target === 'product-card' && (
                    <div className="flex flex-wrap gap-3 items-center">
                      <label className="text-dark-300 text-sm">Network:</label>
                      {['all', 'mtn', 'telecel', 'airtel tigo'].map(net => (
                        <label key={net} className="flex items-center gap-1.5 text-dark-300 text-sm">
                          <input type="radio" name="targetAudience" value={net} checked={formData.targetAudience === net}
                            onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                            className="w-3.5 h-3.5 text-emerald-500 focus:ring-emerald-500" />
                          {net === 'all' ? 'All Networks' : net.toUpperCase()}
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-dark-300">
                      <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500" />
                      Active
                    </label>
                    <div className="flex gap-3">
                      {editingId && <button onClick={resetForm} className="px-4 py-2 bg-dark-700 text-dark-300 rounded-lg hover:bg-dark-600">Cancel</button>}
                      <button onClick={handleSubmit} className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> {editingId ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* List */}
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
              ) : announcements.length === 0 ? (
                <div className="text-center py-8 text-dark-400">No announcements yet</div>
              ) : (
                <div className="space-y-3">
                  {announcements.map((ann) => (
                    <div key={ann.id} className={`bg-dark-900/50 border rounded-xl p-4 ${ann.isActive ? 'border-amber-500/30' : 'border-dark-700'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-white font-semibold">{ann.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${ann.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-dark-700 text-dark-400'}`}>
                              {ann.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${
                              ann.target === 'shop-alert' ? 'bg-red-500/20 text-red-400' :
                              ann.target === 'shop' ? 'bg-cyan-500/20 text-cyan-400' :
                              'bg-purple-500/20 text-purple-400'
                            }`}>
                              {ann.target === 'shop-alert' ? '🚨 Shop Alert' : ann.target === 'shop' ? 'Shop Banner' : ann.target === 'product-card' ? `📦 Product Card${ann.targetAudience !== 'all' ? ` (${ann.targetAudience.toUpperCase()})` : ''}` : 'Agents'}
                            </span>
                          </div>
                          <p className="text-dark-400 text-sm">{ann.message}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => toggleActive(ann.id, ann.isActive)} className="p-2 text-dark-400 hover:bg-dark-700 rounded-lg">
                            {ann.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => handleEdit(ann)} className="p-2 text-cyan-400 hover:bg-cyan-500/20 rounded-lg"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(ann.id)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
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

export default AnnouncementAdmin;

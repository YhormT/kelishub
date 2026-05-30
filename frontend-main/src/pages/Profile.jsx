import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, ArrowLeft, Save, Loader2, Eye, EyeOff, Shield, Key } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    name: '',
    email: '',
    phone: '',
    role: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser({
        name: localStorage.getItem('name') || '',
        email: localStorage.getItem('email') || '',
        phone: '',
        role: localStorage.getItem('role') || ''
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/users/${userId}/profile`,
        { name: user.name, phone: user.phone },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem('name', user.name);

      Swal.fire({
        title: 'Profile Updated',
        text: 'Your profile has been updated successfully.',
        icon: 'success',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } catch (error) {
      Swal.fire({
        title: 'Update Failed',
        text: error.response?.data?.message || 'Failed to update profile.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Swal.fire({
        title: 'Password Mismatch',
        text: 'New passwords do not match.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      Swal.fire({
        title: 'Weak Password',
        text: 'Password must be at least 6 characters.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
      return;
    }

    setIsSaving(true);

    try {
      const userId = localStorage.getItem('userId');
      const token = localStorage.getItem('token');
      await axios.put(
        `${BASE_URL}/api/users/${userId}/password`,
        {
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Swal.fire({
        title: 'Password Changed',
        text: 'Your password has been changed successfully.',
        icon: 'success',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
    } catch (error) {
      Swal.fire({
        title: 'Change Failed',
        text: error.response?.data?.message || 'Failed to change password.',
        icon: 'error',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    const role = localStorage.getItem('role');
    switch (role) {
      case 'ADMIN': navigate('/admin'); break;
      case 'USER': navigate('/user'); break;
      case 'PREMIUM': navigate('/premium'); break;
      case 'SUPER': navigate('/superagent'); break;
      case 'NORMAL': navigate('/normalagent'); break;
      case 'OTHER': navigate('/otherdashboard'); break;
      default: navigate('/');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-dark-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <div className="glass border-b border-dark-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={goBack}
              className="p-2 bg-dark-800 hover:bg-dark-700 rounded-xl transition-colors active:scale-95"
            >
              <ArrowLeft className="w-5 h-5 text-dark-300" />
            </button>
            <div className="flex items-center gap-2 sm:gap-3">
              <img src="/logo-icon.png" alt="kellishub" className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl" />
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white">Profile Settings</h1>
                <p className="text-xs text-dark-400">Manage your account</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-4 sm:p-6 text-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <span className="text-2xl sm:text-3xl font-bold text-white">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-1">{user.name}</h2>
              <p className="text-dark-400 text-xs sm:text-sm mb-3 sm:mb-4 truncate">{user.email}</p>
              <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-cyan-500/10 text-cyan-400 rounded-full text-xs sm:text-sm font-medium border border-cyan-500/20">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                {user.role}
              </span>
            </div>
          </div>

          {/* Forms */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Profile Form */}
            <form onSubmit={handleUpdateProfile} className="bg-dark-800/50 backdrop-blur rounded-xl sm:rounded-2xl border border-dark-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-white mb-4 sm:mb-6 flex items-center gap-2">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-500" />
                Personal Information
              </h3>

              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-dark-300 mb-1.5 sm:mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type="text"
                      value={user.name}
                      onChange={(e) => setUser({ ...user, name: e.target.value })}
                      className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all text-base"
                      placeholder="Your name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="w-full bg-dark-900/30 border-2 border-dark-700 rounded-xl pl-12 pr-4 py-3 text-dark-400 cursor-not-allowed"
                    />
                  </div>
                  <p className="text-dark-600 text-xs mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                    <input
                      type="tel"
                      value={user.phone || ''}
                      onChange={(e) => setUser({ ...user, phone: e.target.value.replace(/\D/g, '') })}
                      className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl pl-12 pr-4 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
                      placeholder="0XX XXX XXXX"
                      maxLength={10}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-5 h-5" /> Save Changes</>
                  )}
                </button>
              </div>
            </form>

            {/* Password Section */}
            <div className="bg-dark-800/50 backdrop-blur rounded-2xl border border-dark-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-cyan-500" />
                  Security
                </h3>
                <button
                  onClick={() => setShowPasswordSection(!showPasswordSection)}
                  className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {showPasswordSection ? 'Cancel' : 'Change Password'}
                </button>
              </div>

              {showPasswordSection ? (
                <form onSubmit={handleChangePassword} className="space-y-5">
                  {['current', 'new', 'confirm'].map((field) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-dark-300 mb-2">
                        {field === 'current' ? 'Current Password' : field === 'new' ? 'New Password' : 'Confirm New Password'}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                        <input
                          type={showPasswords[field] ? 'text' : 'password'}
                          value={passwordData[`${field}Password`]}
                          onChange={(e) => setPasswordData({ ...passwordData, [`${field}Password`]: e.target.value })}
                          className="w-full bg-dark-900/50 border-2 border-dark-600 rounded-xl pl-12 pr-12 py-3 text-white placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all"
                          placeholder={`Enter ${field} password`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] })}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-dark-500 hover:text-dark-300"
                        >
                          {showPasswords[field] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Changing...</>
                    ) : (
                      <><Key className="w-5 h-5" /> Change Password</>
                    )}
                  </button>
                </form>
              ) : (
                <p className="text-dark-400 text-sm">Click "Change Password" to update your password.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Bell, X, CheckCircle, Megaphone, Loader2 } from 'lucide-react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';
import getSocket from '../utils/socket';

// Notification sound
const notificationSound = new Audio('/notification-sound.mp3');
notificationSound.volume = 0.5;

const AgentNotifications = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const userRole = localStorage.getItem('role') || 'user';
  const userId = localStorage.getItem('userId');

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const res = await axios.get(
        `${BASE_URL}/api/announcement/audience/${userRole.toLowerCase()}?userId=${userId}`
      );
      setNotifications(res.data.data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userRole, userId]);

  const prevUnreadCountRef = useRef(0);

  const playNotificationSound = useCallback(() => {
    try {
      notificationSound.currentTime = 0;
      notificationSound.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    
    try {
      const res = await axios.get(
        `${BASE_URL}/api/announcement/unread/${userRole.toLowerCase()}?userId=${userId}`
      );
      const newCount = res.data.data?.unreadCount || 0;
      
      // Play sound if new notifications arrived
      if (newCount > prevUnreadCountRef.current && prevUnreadCountRef.current !== 0) {
        playNotificationSound();
      }
      prevUnreadCountRef.current = newCount;
      setUnreadCount(newCount);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [userRole, userId, playNotificationSound]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Real-time announcement updates via socket
  useEffect(() => {
    const socket = getSocket();
    const handleAnnouncementUpdate = () => {
      fetchUnreadCount();
      if (isOpen) fetchNotifications();
    };
    socket.on('announcement:new', handleAnnouncementUpdate);
    return () => socket.off('announcement:new', handleAnnouncementUpdate);
  }, [fetchUnreadCount, fetchNotifications, isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAsRead = async (announcementId) => {
    if (!userId) return;
    
    try {
      await axios.post(`${BASE_URL}/api/announcement/read/${announcementId}`, {
        userId: parseInt(userId)
      });
      
      setNotifications(prev => 
        prev.map(n => n.id === announcementId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const handleViewNotification = (notification) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      handleMarkAsRead(notification.id);
    }
  };

  return (
    <>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="relative p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 transition-all shadow-lg"
        title="View Notifications"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Modal - Using Portal to render at body level */}
      {isOpen && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-6 h-6 text-white" />
                <div>
                  <h2 className="text-lg font-bold text-white">Notifications</h2>
                  <p className="text-white/80 text-sm">{unreadCount} unread</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Bell className="w-12 h-12 text-dark-600 mb-3" />
                  <p className="text-dark-400">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-dark-700">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      onClick={() => handleViewNotification(notification)}
                      className={`w-full p-4 text-left hover:bg-dark-700/50 transition-colors ${
                        !notification.isRead ? 'bg-cyan-500/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${notification.isRead ? 'bg-dark-700' : 'bg-cyan-500/20'}`}>
                          <Megaphone className={`w-4 h-4 ${notification.isRead ? 'text-dark-400' : 'text-cyan-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className={`font-semibold truncate ${notification.isRead ? 'text-dark-300' : 'text-white'}`}>
                              {notification.title}
                            </h3>
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-cyan-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-dark-400 text-sm truncate">{notification.message}</p>
                          <p className="text-dark-500 text-xs mt-1">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notification Detail Modal - Also using Portal */}
      {selectedNotification && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[10000] p-4" onClick={() => setSelectedNotification(null)}>
          <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-white" />
                <h3 className="font-bold text-white">Announcement</h3>
              </div>
              <button onClick={() => setSelectedNotification(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <h2 className="text-xl font-bold text-white mb-2">{selectedNotification.title}</h2>
              <p className="text-dark-300 whitespace-pre-wrap">{selectedNotification.message}</p>
              <div className="flex items-center gap-2 mt-4 text-dark-500 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Read on {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AgentNotifications;

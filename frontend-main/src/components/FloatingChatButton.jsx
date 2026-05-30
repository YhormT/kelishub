import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';
import ChatWindow from './ChatWindow';

const FloatingChatButton = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const token = localStorage.getItem('token');
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      let total = res.data.success ? res.data.count : 0;
      if (isAdmin) {
        try {
          const shopRes = await axios.get(`${BASE_URL}/api/shop-chat/admin-unread-count`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (shopRes.data.success) total += shopRes.data.count;
        } catch (e) {}
      }
      setUnreadCount(total);
    } catch (e) {}
  }, [token, isAdmin]);

  useEffect(() => {
    if (!currentUser) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [currentUser, fetchUnreadCount]);

  // Refresh count when chat closes
  useEffect(() => {
    if (!isOpen) fetchUnreadCount();
  }, [isOpen, fetchUnreadCount]);

  if (!currentUser) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); try { const a = new Audio('/chat-alert.mp3'); a.volume = 0; a.play().then(() => a.pause()).catch(() => {}); } catch(e) {} }}
          className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full shadow-lg shadow-emerald-500/25 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <MessageCircle className="w-7 h-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      <ChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} currentUser={currentUser} />
    </>
  );
};

export default FloatingChatButton;

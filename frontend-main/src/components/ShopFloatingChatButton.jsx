import React, { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';
import ShopChatWindow from './ShopChatWindow';

const ShopFloatingChatButton = ({ agentId = null, agentName = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const phone = localStorage.getItem('shopChatPhone');

  const fetchUnreadCount = useCallback(async () => {
    if (!phone) { setUnreadCount(0); return; }
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/unread-count?phone=${phone}`);
      if (res.data.success) setUnreadCount(res.data.count);
    } catch (e) {}
  }, [phone]);

  useEffect(() => {
    if (!phone) return;
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount, phone]);

  useEffect(() => {
    if (!isOpen) fetchUnreadCount();
  }, [isOpen, fetchUnreadCount]);

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); try { const a = new Audio('/chat-alert.mp3'); a.volume = 0; a.play().then(() => a.pause()).catch(() => {}); } catch(e) {} }}
          className="fixed bottom-6 right-4 sm:right-6 z-50 w-14 h-14 bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white rounded-full shadow-lg shadow-cyan-500/25 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
        >
          <MessageCircle className="w-7 h-7" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse shadow-lg">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      <ShopChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} targetAgentId={agentId} targetAgentName={agentName} />
    </>
  );
};

export default ShopFloatingChatButton;

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Search, ArrowLeft, MessageCircle, Check, CheckCheck, Reply, Trash2, ChevronDown, Phone } from 'lucide-react';
import axios from 'axios';
import { io as socketIO } from 'socket.io-client';
import BASE_URL from '../endpoints/endpoints';

let chatAlert = null;
const getChatAlert = () => {
  if (!chatAlert) {
    chatAlert = new Audio('/chat-alert.mp3');
    chatAlert.volume = 0.6;
  }
  return chatAlert;
};
const playChatAlert = () => {
  try {
    const audio = getChatAlert();
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch(e) {}
};

const ShopChatWindow = ({ isOpen, onClose, targetAgentId = null, targetAgentName = null }) => {
  const [phone, setPhone] = useState(() => localStorage.getItem('shopChatPhone') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('shopChatPhone'));
  const [admins, setAdmins] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeAdmin, setActiveAdmin] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [chatSearch, setChatSearch] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [view, setView] = useState('list'); // list | chat
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const activeConversationRef = useRef(activeConversation);
  activeConversationRef.current = activeConversation;

  const validPrefixes = ['024', '025', '053', '054', '055', '059', '020', '050', '027', '057', '026', '056', '028'];

  const validatePhone = (p) => {
    if (!p || p.length !== 10) return false;
    return validPrefixes.includes(p.substring(0, 3));
  };

  const handlePhoneSubmit = () => {
    if (!validatePhone(phone)) {
      setPhoneError('Enter a valid 10-digit mobile number');
      return;
    }
    setPhoneError('');
    localStorage.setItem('shopChatPhone', phone);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('shopChatPhone');
    setIsAuthenticated(false);
    setPhone('');
    setConversations([]);
    setAdmins([]);
    setActiveConversation(null);
    setActiveAdmin(null);
    setMessages([]);
    setView('list');
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Socket connection
  useEffect(() => {
    if (!isOpen || !isAuthenticated || !phone) return;
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });
    socket.emit('shop-chat:register', { phone });
    socketRef.current = socket;

    socket.on('shop-chat:receive', (data) => {
      if (data.conversationId === activeConversationRef.current) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
        axios.put(`${BASE_URL}/api/shop-chat/conversations/${data.conversationId}/read`, { readerType: 'customer' }).catch(() => {});
        socket.emit('shop-chat:read', {
          recipientKey: String(data.message.senderId),
          conversationId: data.conversationId
        });
      }
      playChatAlert();
      fetchConversations();
    });

    socket.on('shop-chat:typing', (data) => {
      if (data.conversationId === activeConversationRef.current) setTyping(true);
    });

    socket.on('shop-chat:stop-typing', (data) => {
      if (data.conversationId === activeConversationRef.current) setTyping(false);
    });

    socket.on('shop-chat:read', (data) => {
      if (data.conversationId === activeConversationRef.current) {
        setMessages(prev => prev.map(m => m.senderType === 'customer' ? { ...m, readAt: new Date().toISOString() } : m));
      }
    });

    socket.on('shop-chat:delete', (data) => {
      if (data.forAll) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isDeleted: true, deletedForAll: true, decryptedContent: '' } : m));
      }
      fetchConversations();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAuthenticated, phone]);

  const fetchConversations = useCallback(async () => {
    if (!phone) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/conversations?phone=${phone}`);
      if (res.data.success) setConversations(res.data.conversations);
    } catch (e) { console.error('Error fetching shop conversations:', e); }
  }, [phone]);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/admins`);
      if (res.data.success) setAdmins(res.data.admins);
    } catch (e) { console.error('Error fetching admins:', e); }
  }, []);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      fetchConversations();
      if (!targetAgentId) fetchAdmins();
    }
  }, [isOpen, isAuthenticated, fetchConversations, fetchAdmins, targetAgentId]);

  // Auto-open chat with storefront agent when targetAgentId provided
  useEffect(() => {
    if (isOpen && isAuthenticated && targetAgentId && view === 'list' && !activeConversation) {
      openChat(targetAgentId, { id: targetAgentId, name: targetAgentName || 'Agent' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isAuthenticated, targetAgentId]);

  // Poll for updates
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [isOpen, isAuthenticated, fetchConversations]);

  const openChat = async (adminId, admin) => {
    setActiveAdmin(admin);
    setMsgLoading(true);
    setMessages([]);
    setPage(1);
    setView('chat');
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/conversations/${adminId}/messages?phone=${phone}&page=1`);
      if (res.data.success) {
        setMessages(res.data.messages);
        setActiveConversation(res.data.conversationId);
        setHasMore(res.data.hasMore);
        setTimeout(scrollToBottom, 100);
        await axios.put(`${BASE_URL}/api/shop-chat/conversations/${res.data.conversationId}/read`, { readerType: 'customer' });
        if (socketRef.current) {
          socketRef.current.emit('shop-chat:read', { recipientKey: String(adminId), conversationId: res.data.conversationId });
        }
        fetchConversations();
      }
    } catch (e) { console.error('Error opening chat:', e); }
    finally { setMsgLoading(false); }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || !activeAdmin) return;
    const nextPage = page + 1;
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/conversations/${activeAdmin.id}/messages?phone=${phone}&page=${nextPage}`);
      if (res.data.success) {
        setMessages(prev => [...res.data.messages, ...prev]);
        setPage(nextPage);
        setHasMore(res.data.hasMore);
      }
    } catch (e) { console.error('Error loading more:', e); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeAdmin) return;
    const text = newMessage.trim();
    const currentReplyTo = replyTo;
    setNewMessage('');
    setReplyTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      senderId: phone,
      senderType: 'customer',
      decryptedContent: text,
      createdAt: new Date().toISOString(),
      readAt: null,
      isDeleted: false,
      deletedForAll: false,
      replyTo: currentReplyTo ? { id: currentReplyTo.id, senderId: currentReplyTo.senderId, senderType: currentReplyTo.senderType, decryptedContent: currentReplyTo.decryptedContent, createdAt: currentReplyTo.createdAt, isDeleted: false } : null,
      _optimistic: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      const res = await axios.post(`${BASE_URL}/api/shop-chat/conversations/${activeAdmin.id}/messages`, {
        phone, text, replyToId: currentReplyTo?.id || null
      });
      if (res.data.success) {
        setMessages(prev => prev.map(m => m.id === tempId ? res.data.message : m));
        if (socketRef.current) {
          socketRef.current.emit('shop-chat:send', {
            recipientKey: String(activeAdmin.id),
            message: res.data.message,
            conversationId: res.data.conversationId
          });
          socketRef.current.emit('shop-chat:stop-typing', {
            recipientKey: String(activeAdmin.id),
            senderKey: `shop:${phone}`,
            conversationId: activeConversation
          });
        }
        fetchConversations();
      }
    } catch (e) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error('Error sending message:', e);
    }
  };

  const deleteMessage = async (msgId, forAll = false) => {
    try {
      await axios.delete(`${BASE_URL}/api/shop-chat/messages/${msgId}`, { data: { senderId: phone, forAll } });
      if (forAll) {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, deletedForAll: true, decryptedContent: '' } : m));
        if (socketRef.current && activeAdmin) {
          socketRef.current.emit('shop-chat:delete', { recipientKey: String(activeAdmin.id), messageId: msgId, forAll: true });
        }
      } else {
        setMessages(prev => prev.filter(m => m.id !== msgId));
      }
      setContextMenu(null);
      fetchConversations();
    } catch (e) { console.error('Error deleting:', e); }
  };

  const handleTyping = () => {
    if (socketRef.current && activeAdmin) {
      socketRef.current.emit('shop-chat:typing', { recipientKey: String(activeAdmin.id), senderKey: `shop:${phone}`, conversationId: activeConversation });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('shop-chat:stop-typing', { recipientKey: String(activeAdmin.id), senderKey: `shop:${phone}`, conversationId: activeConversation });
      }, 2000);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };

  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDateGroups = () => {
    const groups = [];
    let lastDate = '';
    messages.forEach(msg => {
      const date = new Date(msg.createdAt).toDateString();
      if (date !== lastDate) {
        groups.push({ type: 'date', date: formatDate(msg.createdAt) });
        lastDate = date;
      }
      groups.push({ type: 'message', ...msg });
    });
    return groups;
  };

  const existingAdminIds = new Set(conversations.map(c => c.adminId));
  const newAdmins = admins.filter(a => !existingAdminIds.has(a.id));

  const highlightedMessages = chatSearch
    ? messages.filter(m => m.decryptedContent?.toLowerCase().includes(chatSearch.toLowerCase()))
    : [];

  if (!isOpen) return null;

  // Phone number entry screen
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[600px] bg-dark-800 sm:border sm:border-dark-600 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[60]">
        <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-white" />
            <h2 className="text-lg font-bold text-white">Chat with Us</h2>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center mb-6">
            <Phone className="w-10 h-10 text-cyan-400" />
          </div>
          <h3 className="text-white text-lg font-bold mb-2">Enter Your Number</h3>
          <p className="text-dark-400 text-sm text-center mb-6">Use the mobile number you used for ordering to start or continue a chat.</p>
          <div className="w-full max-w-xs">
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setPhoneError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePhoneSubmit(); }}
              placeholder="0XX XXX XXXX"
              className="w-full bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-3 text-white text-center text-lg placeholder-dark-500 focus:border-cyan-500 focus:outline-none transition-all tracking-wider"
              maxLength={10}
              autoFocus
            />
            {phoneError && <p className="text-red-400 text-xs mt-2 text-center">{phoneError}</p>}
            <button
              onClick={handlePhoneSubmit}
              disabled={phone.length !== 10}
              className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 hover:shadow-lg active:scale-95"
            >
              Continue to Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[600px] bg-dark-800 sm:border sm:border-dark-600 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[60]">
      {view === 'list' ? (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-white" />
              <div>
                <h2 className="text-lg font-bold text-white">Messages</h2>
                <p className="text-cyan-100 text-xs">{phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleLogout} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs px-2">Switch</button>
              <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
            </div>
          </div>

          {/* Conversations + Admin list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.map(conv => (
              <div key={conv.id} onClick={() => openChat(conv.adminId, { id: conv.adminId, name: conv.partnerName || 'Support' })}
                className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 cursor-pointer border-b border-dark-700/30 transition-colors">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                    {(conv.partnerName || 'S').charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="text-white font-medium text-sm truncate">{conv.partnerName || 'Support'}</p>
                    <span className="text-dark-500 text-xs flex-shrink-0 ml-2">{conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <p className="text-dark-400 text-xs truncate">{conv.lastMessage?.decryptedContent || 'No messages yet'}</p>
                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 ml-2 w-5 h-5 bg-cyan-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* New admin contacts */}
            {newAdmins.length > 0 && (
              <>
                {conversations.length > 0 && (
                  <div className="px-4 py-2 bg-dark-900/30">
                    <p className="text-dark-500 text-xs font-medium uppercase tracking-wide">Start New Chat</p>
                  </div>
                )}
                {newAdmins.map(admin => (
                  <div key={admin.id} onClick={() => openChat(admin.id, admin)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 cursor-pointer border-b border-dark-700/30 transition-colors">
                    <div className="relative flex-shrink-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                        A
                      </div>
                      {admin.isLoggedIn && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-dark-800 rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{admin.name || 'Admin'}</p>
                      <p className="text-dark-500 text-xs">Tap to start chatting</p>
                    </div>
                  </div>
                ))}
              </>
            )}

            {conversations.length === 0 && newAdmins.length === 0 && (
              <div className="text-center py-12 px-4">
                <MessageCircle className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                <p className="text-dark-400 text-sm">No conversations yet</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Chat header */}
          <div className="bg-gradient-to-r from-cyan-600 to-teal-600 p-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => { setView('list'); setActiveConversation(null); setActiveAdmin(null); setMessages([]); setReplyTo(null); setShowChatSearch(false); setChatSearch(''); }}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><ArrowLeft className="w-5 h-5 text-white" /></button>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {(activeAdmin?.name || 'S').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{activeAdmin?.name || 'Support'}</p>
              <p className="text-cyan-100 text-xs">{typing ? 'typing...' : (activeAdmin?.isLoggedIn ? 'Online' : '')}</p>
            </div>
            <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearch(''); }}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><Search className="w-4 h-4 text-white" /></button>
            <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
          </div>

          {/* Chat search bar */}
          {showChatSearch && (
            <div className="p-2 border-b border-dark-700 bg-dark-900/50">
              <input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} autoFocus
                placeholder="Search in chat..." className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-dark-500 focus:border-cyan-500 focus:outline-none" />
              {chatSearch && <p className="text-dark-500 text-xs mt-1">{highlightedMessages.length} result{highlightedMessages.length !== 1 ? 's' : ''}</p>}
            </div>
          )}

          {/* Messages area */}
          <div ref={messagesContainerRef} onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 space-y-1 bg-dark-900/30 relative" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23374151\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
            {msgLoading ? (
              <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                {hasMore && (
                  <div className="text-center py-2">
                    <button onClick={loadMoreMessages} className="text-cyan-400 text-xs hover:underline">Load older messages</button>
                  </div>
                )}
                {getDateGroups().map((item, i) => {
                  if (item.type === 'date') {
                    return (
                      <div key={`date-${i}`} className="flex justify-center py-2">
                        <span className="bg-dark-700/80 text-dark-400 text-xs px-3 py-1 rounded-full">{item.date}</span>
                      </div>
                    );
                  }
                  const isMe = item.senderType === 'customer';
                  const isHighlighted = chatSearch && item.decryptedContent?.toLowerCase().includes(chatSearch.toLowerCase());
                  return (
                    <div key={item.id} id={`msg-${item.id}`}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ msg: item }); }}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 relative ${isHighlighted ? 'ring-2 ring-yellow-400' : ''} ${
                        item.isDeleted || item.deletedForAll
                          ? 'bg-dark-700/50 border border-dark-600'
                          : isMe ? 'bg-cyan-600/90 text-white rounded-br-md' : 'bg-dark-700 text-white rounded-bl-md'
                      }`}>
                        {item.replyTo && !item.isDeleted && (
                          <div className={`text-xs mb-1.5 rounded-lg px-2 py-1 border-l-2 ${isMe ? 'bg-cyan-700/50 border-cyan-300' : 'bg-dark-600/50 border-dark-400'}`}>
                            <p className={`font-medium ${isMe ? 'text-cyan-200' : 'text-dark-300'}`}>{item.replyTo.senderType === 'customer' ? 'You' : (activeAdmin?.name || 'Support')}</p>
                            <p className={`truncate ${isMe ? 'text-cyan-100/70' : 'text-dark-400'}`}>{item.replyTo.isDeleted ? 'Deleted message' : item.replyTo.decryptedContent}</p>
                          </div>
                        )}
                        {item.isDeleted || item.deletedForAll ? (
                          <p className="text-dark-500 text-sm italic flex items-center gap-1"><Trash2 className="w-3 h-3" /> This message was deleted</p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{item.decryptedContent}</p>
                        )}
                        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                          <span className={`text-[10px] ${isMe ? 'text-cyan-200/60' : 'text-dark-500'}`}>{formatTime(item.createdAt)}</span>
                          {isMe && !item.isDeleted && (
                            item.readAt ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3 text-cyan-200/60" />
                          )}
                        </div>
                        {/* Quick action buttons on hover */}
                        {!item.isDeleted && !item.deletedForAll && (
                          <div className={`absolute top-1 ${isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} hidden group-hover:flex items-center gap-0.5 bg-dark-800 border border-dark-600 rounded-lg px-1 py-0.5 shadow-lg`}>
                            <button onClick={() => { setReplyTo(item); inputRef.current?.focus(); }} className="p-1 hover:bg-dark-700 rounded" title="Reply"><Reply className="w-3.5 h-3.5 text-dark-400" /></button>
                            <button onClick={() => setContextMenu({ msg: item })} className="p-1 hover:bg-dark-700 rounded" title="More"><ChevronDown className="w-3.5 h-3.5 text-dark-400" /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button onClick={scrollToBottom} className="absolute bottom-24 right-6 w-9 h-9 bg-dark-700 border border-dark-600 rounded-full flex items-center justify-center shadow-lg hover:bg-dark-600 z-10">
              <ChevronDown className="w-5 h-5 text-dark-300" />
            </button>
          )}

          {/* Reply bar */}
          {replyTo && (
            <div className="px-3 py-2 bg-dark-800 border-t border-dark-700 flex items-center gap-2">
              <div className="flex-1 border-l-2 border-cyan-500 pl-2">
                <p className="text-cyan-400 text-xs font-medium">{replyTo.senderType === 'customer' ? 'You' : (activeAdmin?.name || 'Support')}</p>
                <p className="text-dark-400 text-xs truncate">{replyTo.decryptedContent}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-dark-500 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-dark-700 bg-dark-800 flex items-end gap-2 flex-shrink-0">
            <textarea ref={inputRef} value={newMessage} onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Type a message..." rows={1}
              className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-dark-500 focus:border-cyan-500 focus:outline-none resize-none max-h-24"
              style={{ minHeight: '40px' }} />
            <button onClick={sendMessage} disabled={!newMessage.trim()}
              className="p-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-xl transition-colors flex-shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="absolute inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div className="absolute z-50 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl py-1 min-w-[160px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); inputRef.current?.focus(); }}
              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-dark-700 flex items-center gap-2"><Reply className="w-4 h-4 text-dark-400" /> Reply</button>
            <button onClick={() => { navigator.clipboard.writeText(contextMenu.msg.decryptedContent); setContextMenu(null); }}
              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-dark-700 flex items-center gap-2">📋 Copy</button>
            {contextMenu.msg.senderType === 'customer' && (
              <button onClick={() => deleteMessage(contextMenu.msg.id, true)}
                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete for everyone</button>
            )}
            <button onClick={() => deleteMessage(contextMenu.msg.id, false)}
              className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-dark-700 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete for me</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ShopChatWindow;

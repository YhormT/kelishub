import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Search, ArrowLeft, MessageCircle, Check, CheckCheck, Reply, Trash2, Forward, CornerUpRight, ChevronDown, Users } from 'lucide-react';
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

const ChatWindow = ({ isOpen, onClose, currentUser }) => {
  const [conversations, setConversations] = useState([]);
  const [shopConversations, setShopConversations] = useState([]);
  const [agents, setAgents] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [isShopChat, setIsShopChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [msgLoading, setMsgLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatSearch, setChatSearch] = useState('');
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [selectedForward, setSelectedForward] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [view, setView] = useState('list'); // list | chat
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const socketRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const token = localStorage.getItem('token');
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  const activeConversationRef = useRef(activeConversation);
  activeConversationRef.current = activeConversation;

  // Socket connection
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    const socket = socketIO(BASE_URL, { transports: ['websocket', 'polling'] });
    socket.emit('register', { userId: currentUser.id });
    socketRef.current = socket;

    socket.on('chat:receive', (data) => {
      if (data.conversationId === activeConversationRef.current) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
        // Mark as read immediately
        axios.put(`${BASE_URL}/api/chat/conversations/${data.conversationId}/read`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).catch(() => {});
        socket.emit('chat:read', {
          recipientId: data.message.senderId,
          conversationId: data.conversationId,
          readBy: currentUser.id
        });
      }
      playChatAlert();
      fetchConversations();
    });

    socket.on('chat:typing', (data) => {
      if (data.conversationId === activeConversationRef.current) setTyping(true);
    });

    socket.on('chat:stop-typing', (data) => {
      if (data.conversationId === activeConversationRef.current) setTyping(false);
    });

    socket.on('chat:read', (data) => {
      if (data.conversationId === activeConversationRef.current) {
        setMessages(prev => prev.map(m => m.senderId === currentUser.id ? { ...m, readAt: new Date().toISOString() } : m));
      }
    });

    socket.on('chat:delete', (data) => {
      if (data.forAll) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isDeleted: true, deletedForAll: true, decryptedContent: '' } : m));
      }
      fetchConversations();
    });

    // Shop chat socket listeners (for admin receiving shop customer messages)
    socket.on('shop-chat:receive', (data) => {
      if (data.conversationId === activeConversationRef.current) {
        setMessages(prev => [...prev, data.message]);
        scrollToBottom();
        axios.put(`${BASE_URL}/api/shop-chat/conversations/${data.conversationId}/read`, { readerType: 'admin' }).catch(() => {});
      }
      playChatAlert();
      fetchShopConversations();
    });

    socket.on('shop-chat:typing', (data) => {
      if (data.conversationId === activeConversationRef.current) setTyping(true);
    });

    socket.on('shop-chat:stop-typing', (data) => {
      if (data.conversationId === activeConversationRef.current) setTyping(false);
    });

    socket.on('shop-chat:read', (data) => {
      if (data.conversationId === activeConversationRef.current) {
        setMessages(prev => prev.map(m => m.senderType === 'admin' ? { ...m, readAt: new Date().toISOString() } : m));
      }
    });

    socket.on('shop-chat:delete', (data) => {
      if (data.forAll) {
        setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isDeleted: true, deletedForAll: true, decryptedContent: '' } : m));
      }
      fetchShopConversations();
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/chat/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setConversations(res.data.conversations);
    } catch (e) { console.error('Error fetching conversations:', e); }
  }, [token]);

  const fetchShopConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/conversations/admin`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setShopConversations(res.data.conversations);
    } catch (e) { console.error('Error fetching shop conversations:', e); }
  }, [token]);

  const fetchAgents = useCallback(async () => {
    try {
      const endpoint = isAdmin ? `${BASE_URL}/api/chat/agents` : `${BASE_URL}/api/chat/admins`;
      const res = await axios.get(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) setAgents(isAdmin ? res.data.agents : res.data.admins);
    } catch (e) { console.error('Error fetching contacts:', e); }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isOpen) { fetchConversations(); fetchAgents(); fetchShopConversations(); }
  }, [isOpen, fetchConversations, fetchAgents, fetchShopConversations]);

  // Poll for unread updates
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => { fetchConversations(); fetchShopConversations(); }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, fetchConversations, fetchShopConversations]);

  const openChat = async (userId, user) => {
    setActiveUser(user);
    setIsShopChat(false);
    setMsgLoading(true);
    setMessages([]);
    setPage(1);
    setView('chat');
    try {
      const res = await axios.get(`${BASE_URL}/api/chat/conversations/${userId}/messages?page=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setMessages(res.data.messages);
        setActiveConversation(res.data.conversationId);
        setHasMore(res.data.hasMore);
        setTimeout(scrollToBottom, 100);
        if (socketRef.current) {
          socketRef.current.emit('chat:read', { recipientId: userId, conversationId: res.data.conversationId, readBy: currentUser.id });
        }
        fetchConversations();
      }
    } catch (e) { console.error('Error opening chat:', e); }
    finally { setMsgLoading(false); }
  };

  const openShopChat = async (conv) => {
    setActiveUser({ name: conv.displayName, customerPhone: conv.customerPhone, isShop: true });
    setIsShopChat(true);
    setMsgLoading(true);
    setMessages([]);
    setPage(1);
    setView('chat');
    try {
      const res = await axios.get(`${BASE_URL}/api/shop-chat/conversations/${conv.id}/messages-by-id?page=1`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        setMessages(res.data.messages);
        setActiveConversation(conv.id);
        setHasMore(res.data.hasMore);
        setTimeout(scrollToBottom, 100);
        await axios.put(`${BASE_URL}/api/shop-chat/conversations/${conv.id}/read`, { readerType: 'admin' });
        if (socketRef.current) {
          socketRef.current.emit('shop-chat:read', { recipientKey: `shop:${conv.customerPhone}`, conversationId: conv.id });
        }
        fetchShopConversations();
      }
    } catch (e) { console.error('Error opening shop chat:', e); }
    finally { setMsgLoading(false); }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || !activeUser) return;
    const nextPage = page + 1;
    try {
      let res;
      if (isShopChat) {
        res = await axios.get(`${BASE_URL}/api/shop-chat/conversations/${activeConversation}/messages-by-id?page=${nextPage}`, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        res = await axios.get(`${BASE_URL}/api/chat/conversations/${activeUser.id}/messages?page=${nextPage}`, { headers: { Authorization: `Bearer ${token}` } });
      }
      if (res.data.success) {
        setMessages(prev => [...res.data.messages, ...prev]);
        setPage(nextPage);
        setHasMore(res.data.hasMore);
      }
    } catch (e) { console.error('Error loading more:', e); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeUser) return;
    const text = newMessage.trim();
    const currentReplyTo = replyTo;
    setNewMessage('');
    setReplyTo(null);

    // Optimistic: add message immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      senderId: isShopChat ? String(currentUser.id) : currentUser.id,
      senderType: isShopChat ? 'admin' : undefined,
      decryptedContent: text,
      createdAt: new Date().toISOString(),
      readAt: null,
      isDeleted: false,
      deletedForAll: false,
      forwardedFrom: null,
      replyTo: currentReplyTo ? { id: currentReplyTo.id, senderId: currentReplyTo.senderId, senderType: currentReplyTo.senderType, decryptedContent: currentReplyTo.decryptedContent, createdAt: currentReplyTo.createdAt, isDeleted: false } : null,
      _optimistic: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    if (isShopChat) {
      try {
        const res = await axios.post(`${BASE_URL}/api/shop-chat/conversations/${activeConversation}/admin-message`, {
          text, replyToId: currentReplyTo?.id || null
        }, { headers: { Authorization: `Bearer ${token}` } });
        if (res.data.success) {
          setMessages(prev => prev.map(m => m.id === tempId ? res.data.message : m));
          if (socketRef.current) {
            socketRef.current.emit('shop-chat:send', {
              recipientKey: `shop:${activeUser.customerPhone}`,
              message: res.data.message,
              conversationId: res.data.conversationId
            });
          }
          fetchShopConversations();
        }
      } catch (e) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        console.error('Error sending shop message:', e);
      }
      return;
    }

    try {
      const res = await axios.post(`${BASE_URL}/api/chat/conversations/${activeUser.id}/messages`, {
        text, replyToId: currentReplyTo?.id || null
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data.success) {
        // Replace optimistic message with real one
        setMessages(prev => prev.map(m => m.id === tempId ? res.data.message : m));
        // Emit via socket for real-time
        if (socketRef.current) {
          socketRef.current.emit('chat:send', {
            recipientId: activeUser.id,
            message: res.data.message,
            conversationId: res.data.conversationId
          });
          socketRef.current.emit('chat:stop-typing', {
            recipientId: activeUser.id,
            senderId: currentUser.id,
            conversationId: activeConversation
          });
        }
        fetchConversations();
      }
    } catch (e) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
      console.error('Error sending message:', e);
    }
  };

  const deleteMessage = async (msgId, forAll = false) => {
    try {
      if (isShopChat) {
        await axios.delete(`${BASE_URL}/api/shop-chat/messages/${msgId}`, { data: { senderId: String(currentUser.id), forAll } });
        if (forAll) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, deletedForAll: true, decryptedContent: '' } : m));
          if (socketRef.current && activeUser) {
            socketRef.current.emit('shop-chat:delete', { recipientKey: `shop:${activeUser.customerPhone}`, messageId: msgId, forAll: true });
          }
        } else {
          setMessages(prev => prev.filter(m => m.id !== msgId));
        }
      } else {
        await axios.delete(`${BASE_URL}/api/chat/messages/${msgId}`, {
          headers: { Authorization: `Bearer ${token}` }, data: { forAll }
        });
        if (forAll) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isDeleted: true, deletedForAll: true, decryptedContent: '' } : m));
          if (socketRef.current && activeUser) {
            socketRef.current.emit('chat:delete', { recipientId: activeUser.id, messageId: msgId, forAll: true });
          }
        } else {
          setMessages(prev => prev.filter(m => m.id !== msgId));
        }
      }
      setContextMenu(null);
      fetchConversations();
      fetchShopConversations();
    } catch (e) { console.error('Error deleting:', e); }
  };

  const forwardMessage = async () => {
    if (!forwardMsg || selectedForward.length === 0) return;
    try {
      await axios.post(`${BASE_URL}/api/chat/forward`, {
        messageId: forwardMsg.id, targetUserIds: selectedForward
      }, { headers: { Authorization: `Bearer ${token}` } });
      setShowForwardModal(false);
      setForwardMsg(null);
      setSelectedForward([]);
      fetchConversations();
    } catch (e) { console.error('Error forwarding:', e); }
  };

  const handleTyping = () => {
    if (socketRef.current && activeUser) {
      if (isShopChat) {
        socketRef.current.emit('shop-chat:typing', { recipientKey: `shop:${activeUser.customerPhone}`, senderKey: String(currentUser.id), conversationId: activeConversation });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socketRef.current?.emit('shop-chat:stop-typing', { recipientKey: `shop:${activeUser.customerPhone}`, senderKey: String(currentUser.id), conversationId: activeConversation });
        }, 2000);
      } else {
        socketRef.current.emit('chat:typing', { recipientId: activeUser.id, senderId: currentUser.id, conversationId: activeConversation });
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          socketRef.current?.emit('chat:stop-typing', { recipientId: activeUser.id, senderId: currentUser.id, conversationId: activeConversation });
        }, 2000);
      }
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

  // Merge agent conversations and shop conversations into one sorted list
  const allConversations = [
    ...conversations.map(c => ({ ...c, _isShop: false })),
    ...(shopConversations.length ? shopConversations.map(c => ({
      ...c,
      _isShop: true,
      otherUser: { name: c.displayName, id: `shop-${c.id}`, isLoggedIn: false },
      lastMessage: c.lastMessage
    })) : [])
  ].sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.lastMessageAt || a.createdAt || '';
    const bTime = b.lastMessage?.createdAt || b.lastMessageAt || b.createdAt || '';
    return new Date(bTime) - new Date(aTime);
  });

  // Filter merged conversations and agents based on search
  const filteredConversations = allConversations.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    if (c._isShop) return c.displayName?.toLowerCase().includes(term) || c.customerPhone?.includes(searchTerm);
    return c.otherUser?.name?.toLowerCase().includes(term);
  });
  const filteredAgents = agents.filter(a =>
    !searchTerm || a.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const existingChatUserIds = new Set(conversations.map(c => c.otherUser?.id));
  const newAgents = filteredAgents.filter(a => !existingChatUserIds.has(a.id));

  // Filter messages in chat search
  const highlightedMessages = chatSearch
    ? messages.filter(m => m.decryptedContent?.toLowerCase().includes(chatSearch.toLowerCase()))
    : [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[420px] sm:h-[600px] bg-dark-800 sm:border sm:border-dark-600 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[60]">
      {/* Forward Modal */}
      {showForwardModal && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-xl w-full max-w-sm max-h-[400px] flex flex-col">
            <div className="p-4 border-b border-dark-700 flex justify-between items-center">
              <h3 className="text-white font-semibold">Forward to...</h3>
              <button onClick={() => { setShowForwardModal(false); setForwardMsg(null); setSelectedForward([]); }} className="text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.map(c => (
                <label key={c.id} className="flex items-center gap-3 p-3 hover:bg-dark-700/50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={selectedForward.includes(c.otherUser?.id)} onChange={(e) => {
                    setSelectedForward(prev => e.target.checked ? [...prev, c.otherUser?.id] : prev.filter(id => id !== c.otherUser?.id));
                  }} className="accent-emerald-500" />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold">{c.otherUser?.name?.charAt(0)?.toUpperCase()}</div>
                  <span className="text-white text-sm">{c.otherUser?.name}</span>
                </label>
              ))}
              {agents.filter(a => !existingChatUserIds.has(a.id)).map(a => (
                <label key={a.id} className="flex items-center gap-3 p-3 hover:bg-dark-700/50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={selectedForward.includes(a.id)} onChange={(e) => {
                    setSelectedForward(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id));
                  }} className="accent-emerald-500" />
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">{a.name?.charAt(0)?.toUpperCase()}</div>
                  <span className="text-white text-sm">{a.name}</span>
                </label>
              ))}
            </div>
            {selectedForward.length > 0 && (
              <div className="p-3 border-t border-dark-700">
                <button onClick={forwardMessage} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">
                  Forward to {selectedForward.length} chat{selectedForward.length > 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'list' ? (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-white" />
              <h2 className="text-lg font-bold text-white">Messages</h2>
            </div>
            <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
          </div>

          {/* Search */}
          <div className="p-3 border-b border-dark-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search contacts..." className="w-full bg-dark-900/50 border border-dark-600 rounded-xl pl-10 pr-4 py-2 text-white text-sm placeholder-dark-500 focus:border-emerald-500 focus:outline-none" />
            </div>
          </div>

          {/* Conversations + New agents */}
          <div className="flex-1 overflow-y-auto">
            {false ? (
              <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                {filteredConversations.map(conv => (
                  <div key={conv._isShop ? `shop-${conv.id}` : conv.id} onClick={() => conv._isShop ? openShopChat(conv) : openChat(conv.otherUser?.id, conv.otherUser)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 cursor-pointer border-b border-dark-700/30 transition-colors">
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm ${conv._isShop ? 'bg-gradient-to-br from-orange-500 to-amber-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                        {conv._isShop ? 'S' : conv.otherUser?.name?.charAt(0)?.toUpperCase()}
                      </div>
                      {!conv._isShop && conv.otherUser?.isLoggedIn && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-dark-800 rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="text-white font-medium text-sm truncate">{conv._isShop ? conv.displayName : conv.otherUser?.name}</p>
                        <span className="text-dark-500 text-xs flex-shrink-0 ml-2">{conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}</span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <p className="text-dark-400 text-xs truncate">{conv.lastMessage?.decryptedContent || 'No messages yet'}</p>
                        {conv.unreadCount > 0 && (
                          <span className={`flex-shrink-0 ml-2 w-5 h-5 text-white text-xs font-bold rounded-full flex items-center justify-center ${conv._isShop ? 'bg-orange-500' : 'bg-emerald-500'}`}>{conv.unreadCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* New contacts */}
                {newAgents.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-dark-900/30">
                      <p className="text-dark-500 text-xs font-medium uppercase tracking-wide flex items-center gap-1"><Users className="w-3 h-3" /> {isAdmin ? 'All Agents' : 'Admin'}</p>
                    </div>
                    {newAgents.map(agent => (
                      <div key={agent.id} onClick={() => openChat(agent.id, agent)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-dark-700/50 cursor-pointer border-b border-dark-700/30 transition-colors">
                        <div className="relative flex-shrink-0">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                            {agent.name?.charAt(0)?.toUpperCase()}
                          </div>
                          {agent.isLoggedIn && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-dark-800 rounded-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium text-sm">{agent.name}</p>
                          <p className="text-dark-500 text-xs capitalize">{agent.role}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {filteredConversations.length === 0 && newAgents.length === 0 && (
                  <div className="text-center py-12 px-4">
                    <MessageCircle className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                    <p className="text-dark-400 text-sm">No conversations yet</p>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Chat header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => { setView('list'); setActiveConversation(null); setActiveUser(null); setIsShopChat(false); setMessages([]); setReplyTo(null); setShowChatSearch(false); setChatSearch(''); }}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><ArrowLeft className="w-5 h-5 text-white" /></button>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {activeUser?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{activeUser?.name}</p>
              <p className="text-emerald-100 text-xs">{typing ? 'typing...' : (activeUser?.isLoggedIn ? 'Online' : 'Offline')}</p>
            </div>
            <button onClick={() => { setShowChatSearch(!showChatSearch); setChatSearch(''); }}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><Search className="w-4 h-4 text-white" /></button>
            <button onClick={onClose} className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg"><X className="w-5 h-5 text-white" /></button>
          </div>

          {/* Chat search bar */}
          {showChatSearch && (
            <div className="p-2 border-b border-dark-700 bg-dark-900/50">
              <input type="text" value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} autoFocus
                placeholder="Search in chat..." className="w-full bg-dark-800 border border-dark-600 rounded-lg px-3 py-1.5 text-white text-sm placeholder-dark-500 focus:border-emerald-500 focus:outline-none" />
              {chatSearch && <p className="text-dark-500 text-xs mt-1">{highlightedMessages.length} result{highlightedMessages.length !== 1 ? 's' : ''}</p>}
            </div>
          )}

          {/* Messages area */}
          <div ref={messagesContainerRef} onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 space-y-1 bg-dark-900/30 relative" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23374151\' fill-opacity=\'0.1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
            {msgLoading ? (
              <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
            ) : (
              <>
                {hasMore && (
                  <div className="text-center py-2">
                    <button onClick={loadMoreMessages} className="text-emerald-400 text-xs hover:underline">Load older messages</button>
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
                  const isMe = isShopChat ? item.senderType === 'admin' : item.senderId === currentUser?.id;
                  const isHighlighted = chatSearch && item.decryptedContent?.toLowerCase().includes(chatSearch.toLowerCase());
                  return (
                    <div key={item.id} id={`msg-${item.id}`}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ msg: item }); }}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 relative ${isHighlighted ? 'ring-2 ring-yellow-400' : ''} ${
                        item.isDeleted || item.deletedForAll
                          ? 'bg-dark-700/50 border border-dark-600'
                          : isMe ? 'bg-emerald-600/90 text-white rounded-br-md' : 'bg-dark-700 text-white rounded-bl-md'
                      }`}>
                        {item.forwardedFrom && !item.isDeleted && (
                          <div className={`flex items-center gap-1 text-xs mb-1 ${isMe ? 'text-emerald-200/70' : 'text-dark-400'}`}>
                            <CornerUpRight className="w-3 h-3" /> Forwarded
                          </div>
                        )}
                        {item.replyTo && !item.isDeleted && (
                          <div className={`text-xs mb-1.5 rounded-lg px-2 py-1 border-l-2 ${isMe ? 'bg-emerald-700/50 border-emerald-300' : 'bg-dark-600/50 border-dark-400'}`}>
                            <p className={`font-medium ${isMe ? 'text-emerald-200' : 'text-dark-300'}`}>{item.replyTo.senderId === currentUser?.id ? 'You' : activeUser?.name}</p>
                            <p className={`truncate ${isMe ? 'text-emerald-100/70' : 'text-dark-400'}`}>{item.replyTo.isDeleted ? 'Deleted message' : item.replyTo.decryptedContent}</p>
                          </div>
                        )}
                        {item.isDeleted || item.deletedForAll ? (
                          <p className="text-dark-500 text-sm italic flex items-center gap-1"><Trash2 className="w-3 h-3" /> This message was deleted</p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{item.decryptedContent}</p>
                        )}
                        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : ''}`}>
                          <span className={`text-[10px] ${isMe ? 'text-emerald-200/60' : 'text-dark-500'}`}>{formatTime(item.createdAt)}</span>
                          {isMe && !item.isDeleted && (
                            item.readAt ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3 text-emerald-200/60" />
                          )}
                        </div>
                        {/* Quick action buttons on hover */}
                        {!item.isDeleted && !item.deletedForAll && (
                          <div className={`absolute top-1 ${isMe ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'} hidden group-hover:flex items-center gap-0.5 bg-dark-800 border border-dark-600 rounded-lg px-1 py-0.5 shadow-lg`}>
                            <button onClick={() => { setReplyTo(item); inputRef.current?.focus(); }} className="p-1 hover:bg-dark-700 rounded" title="Reply"><Reply className="w-3.5 h-3.5 text-dark-400" /></button>
                            <button onClick={() => { setForwardMsg(item); setShowForwardModal(true); }} className="p-1 hover:bg-dark-700 rounded" title="Forward"><Forward className="w-3.5 h-3.5 text-dark-400" /></button>
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
              <div className="flex-1 border-l-2 border-emerald-500 pl-2">
                <p className="text-emerald-400 text-xs font-medium">{replyTo.senderId === currentUser?.id ? 'You' : activeUser?.name}</p>
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
              className="flex-1 bg-dark-900/50 border border-dark-600 rounded-xl px-4 py-2.5 text-white text-sm placeholder-dark-500 focus:border-emerald-500 focus:outline-none resize-none max-h-24"
              style={{ minHeight: '40px' }} />
            <button onClick={sendMessage} disabled={!newMessage.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-dark-700 disabled:text-dark-500 text-white rounded-xl transition-colors flex-shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      {/* Context Menu - inside chat window */}
      {contextMenu && (
        <>
          <div className="absolute inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div className="absolute z-50 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl py-1 min-w-[160px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <button onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); inputRef.current?.focus(); }}
              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-dark-700 flex items-center gap-2"><Reply className="w-4 h-4 text-dark-400" /> Reply</button>
            <button onClick={() => { setForwardMsg(contextMenu.msg); setShowForwardModal(true); setContextMenu(null); }}
              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-dark-700 flex items-center gap-2"><Forward className="w-4 h-4 text-dark-400" /> Forward</button>
            <button onClick={() => { navigator.clipboard.writeText(contextMenu.msg.decryptedContent); setContextMenu(null); }}
              className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-dark-700 flex items-center gap-2">📋 Copy</button>
            {(isShopChat ? contextMenu.msg.senderType === 'admin' : contextMenu.msg.senderId === currentUser?.id) && (
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

export default ChatWindow;

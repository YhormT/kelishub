import React, { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';

const Announcement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    if (announcements.length > 1) {
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % announcements.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [announcements.length]);

  const fetchAnnouncements = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${BASE_URL}/api/announcement`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activeAnnouncements = (response.data || []).filter(a => a.isActive);
      setAnnouncements(activeAnnouncements);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  if (!isVisible || announcements.length === 0) return null;

  const currentAnnouncement = announcements[currentIndex];

  return (
    <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-dark-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-1.5 bg-cyan-500/20 rounded-lg flex-shrink-0">
              <Megaphone className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-cyan-400 truncate">
                {currentAnnouncement.title}
              </p>
              <p className="text-xs text-dark-400 truncate">
                {currentAnnouncement.message}
              </p>
            </div>
          </div>
          
          {announcements.length > 1 && (
            <div className="flex gap-1">
              {announcements.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentIndex ? 'bg-cyan-500 w-4' : 'bg-dark-600'
                  }`}
                />
              ))}
            </div>
          )}
          
          <button
            onClick={() => setIsVisible(false)}
            className="text-dark-500 hover:text-dark-300 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Announcement;

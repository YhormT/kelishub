import React, { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';
import axios from 'axios';
import BASE_URL from '../endpoints/endpoints';

const ShopAnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/announcement/shop`);
      setAnnouncements(response.data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  if (!isVisible || announcements.length === 0) return null;

  // Create scrolling text from all announcements
  const scrollingText = announcements.map(a => `${a.title}: ${a.message}`).join('  •  ');

  return (
    <div className="bg-gradient-to-r from-amber-500/20 via-cyan-500/20 to-purple-500/20 border-b border-dark-700 overflow-hidden">
      <div className="flex items-center py-2 px-4">
        <div className="flex-shrink-0 p-1.5 bg-amber-500/20 rounded-lg mr-3">
          <Megaphone className="w-4 h-4 text-amber-400" />
        </div>
        
        <div className="flex-1 overflow-hidden relative">
          <div className="animate-marquee whitespace-nowrap">
            <span className="text-sm font-medium text-white">
              {scrollingText}
            </span>
            <span className="text-sm font-medium text-white ml-16">
              {scrollingText}
            </span>
          </div>
        </div>
        
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 ml-3 text-dark-500 hover:text-dark-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 20s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
};

export default ShopAnnouncementBanner;

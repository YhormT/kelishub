import React from "react";
import { useNavigate } from "react-router-dom";
import { Home, LogOut, User, Wifi, X, ChevronRight, Upload, ClipboardList, History, Store } from "lucide-react";

const Sidebar = ({
  isOpen,
  setIsOpen,
  selectedCategory,
  handleCategorySelect,
  logoutUser,
  onOpenTransactions,
  onOpenUploadExcel,
  onOpenPasteOrders,
  onOpenStorefront,
  isSuspended = false
}) => {
  const navigate = useNavigate();

  const networks = [
    { id: 'MTN', name: 'MTN', color: 'from-yellow-500 to-amber-600' },
    { id: 'TELECEL', name: 'TELECEL', color: 'from-red-500 to-rose-600' },
    { id: 'AIRTEL TIGO', name: 'AIRTEL TIGO', color: 'from-blue-500 to-indigo-600' }
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-dark-900 border-r border-dark-700 z-50 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-dark-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src="/logo-icon.png" alt="kellishub" className="w-10 h-10 rounded-xl" />
                <div>
                  <h1 className="text-lg font-bold text-white">kellishub</h1>
                  <p className="text-xs text-dark-400">Dashboard</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="md:hidden text-dark-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto p-4 ${isSuspended ? 'opacity-40 pointer-events-none' : ''}`}>
            <div className="space-y-2">
              {/* Home */}
              <button
                disabled={isSuspended}
                onClick={() => {
                  handleCategorySelect(null);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${isSuspended ? 'cursor-not-allowed' : ''} ${
                  !selectedCategory
                    ? "bg-gradient-to-r from-cyan-500/10 to-cyan-500/5 text-cyan-400 border border-cyan-500/20"
                    : "text-dark-300 hover:bg-dark-800 hover:text-white"
                }`}
              >
                <Home className="w-5 h-5" />
                <span>Home</span>
                {!selectedCategory && <ChevronRight className="w-4 h-4 ml-auto" />}
              </button>

              {/* Networks */}
              <div className="pt-4">
                <p className="px-4 text-xs font-semibold text-dark-500 uppercase tracking-wider mb-2">Networks</p>
                {networks.map((network) => (
                  <button
                    key={network.id}
                    onClick={() => {
                      handleCategorySelect(network.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                      selectedCategory === network.id
                        ? `bg-gradient-to-r ${network.color} text-white shadow-lg`
                        : "text-dark-300 hover:bg-dark-800 hover:text-white"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${network.color} flex items-center justify-center`}>
                      <Wifi className="w-4 h-4 text-white" />
                    </div>
                    <span>{network.name}</span>
                    {selectedCategory === network.id && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                ))}
              </div>

              {/* Tools */}
              <div className="pt-6 border-t border-dark-700 mt-6">
                <p className="px-4 text-xs font-semibold text-dark-500 uppercase tracking-wider mb-2">Tools</p>
                
                {onOpenTransactions && (
                  <button
                    onClick={() => { onOpenTransactions(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-all"
                  >
                    <History className="w-5 h-5" />
                    <span>Transactions</span>
                  </button>
                )}
                
                {onOpenUploadExcel && (
                  <button
                    onClick={() => { onOpenUploadExcel(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-all mt-2"
                  >
                    <Upload className="w-5 h-5" />
                    <span>Upload Excel</span>
                  </button>
                )}
                
                {onOpenPasteOrders && (
                  <button
                    onClick={() => { onOpenPasteOrders(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-all mt-2"
                  >
                    <ClipboardList className="w-5 h-5" />
                    <span>Paste Orders</span>
                  </button>
                )}
                
                {onOpenStorefront && (
                  <button
                    onClick={() => { onOpenStorefront(); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-all mt-2"
                  >
                    <Store className="w-5 h-5" />
                    <span>Storefront</span>
                  </button>
                )}
              </div>

              {/* Profile */}
              <div className="pt-6 border-t border-dark-700 mt-6">
                <button
                  disabled={isSuspended}
                  onClick={() => {
                    navigate("/profile");
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-dark-300 hover:bg-dark-800 hover:text-white transition-all ${isSuspended ? 'cursor-not-allowed' : ''}`}
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </button>
              </div>
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-dark-700">
            <button
              onClick={logoutUser}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  AlertTriangle,
  CheckCircle,
  Volume2,
  VolumeX,
  RefreshCw,
  Loader2,
  Clock,
  User,
  Hash,
  ShoppingCart,
} from "lucide-react";
import axios from "axios";
import getSocket from "../utils/socket";
import BASE_URL from "../endpoints/endpoints";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const formatGHS = (amount) => {
  const num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
  return `GHS ${num.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  );
};

const buildAlertKey = (orderId, itemId) => `${orderId}-${itemId}`;

const SuspiciousActivity = ({ isOpen, onClose, onAlertsUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [fraudAlerts, setFraudAlerts] = useState([]);
  const [resolvedIds, setResolvedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("resolvedFraudAlerts") || "[]");
    } catch {
      return [];
    }
  });
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef(null);
  const prevCountRef = useRef(0);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/order/admin/order-tracker`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        const alerts = res.data.fraudAlerts || [];
        setFraudAlerts(alerts);

        // Filter out resolved alerts for the count
        const activeAlerts = alerts.filter(
          (a) => !resolvedIds.includes(`${a.orderId}-${a.itemId}`),
        );

        if (
          activeAlerts.length > prevCountRef.current &&
          prevCountRef.current !== 0
        ) {
          if (soundEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          }
        }
        prevCountRef.current = activeAlerts.length;

        if (onAlertsUpdate) onAlertsUpdate(activeAlerts);
      }
    } catch (error) {
      console.error("Error fetching suspicious activity:", error);
    } finally {
      setLoading(false);
    }
  }, [resolvedIds, soundEnabled, onAlertsUpdate]);

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, fetchAlerts]);

  // Socket-based reload on new orders
  useEffect(() => {
    if (!isOpen) return;
    const socket = getSocket();
    const handleNewOrder = () => {
      fetchAlerts();
    };
    socket.on("new-order", handleNewOrder);

    // Safety net: background periodic refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000);

    return () => {
      socket.off("new-order", handleNewOrder);
      clearInterval(interval);
    };
  }, [isOpen, fetchAlerts]);

  const handleResolve = (orderId, itemId) => {
    const key = buildAlertKey(orderId, itemId);
    setResolvedIds((prev) => {
      const updated = Array.from(new Set([...prev, key]));
      localStorage.setItem("resolvedFraudAlerts", JSON.stringify(updated));
      return updated;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const activeAlerts = fraudAlerts.filter(
      (a) => !resolvedIds.includes(buildAlertKey(a.orderId, a.itemId)),
    );
    if (onAlertsUpdate) onAlertsUpdate(activeAlerts);
  }, [isOpen, fraudAlerts, resolvedIds, onAlertsUpdate]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (!next && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const activeAlerts = fraudAlerts.filter(
    (a) => !resolvedIds.includes(buildAlertKey(a.orderId, a.itemId)),
  );
  const resolvedAlerts = fraudAlerts.filter((a) =>
    resolvedIds.includes(buildAlertKey(a.orderId, a.itemId)),
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col">
      {/* Fraud Alert Sound */}
      <audio ref={audioRef} loop preload="auto">
        <source src="/fraud.mp3" type="audio/mpeg" />
      </audio>

      {/* Header */}
      <div className="bg-dark-900 border-b border-red-500/50 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              Suspicious Activity Monitor
            </h2>
            <p className="text-red-400 text-xs font-medium">
              {activeAlerts.length} active alert
              {activeAlerts.length !== 1 ? "s" : ""}
              {resolvedAlerts.length > 0 && (
                <span className="text-dark-500 ml-2">
                  ({resolvedAlerts.length} resolved)
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSound}
            className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700"
            title={soundEnabled ? "Mute alerts" : "Unmute alerts"}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-dark-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-red-400" />
            )}
          </button>
          <button
            onClick={fetchAlerts}
            className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 text-dark-400 ${loading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-dark-800 rounded-xl hover:bg-dark-700"
          >
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {loading && fraudAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
            <span className="ml-3 text-dark-400">
              Scanning for suspicious activity...
            </span>
          </div>
        ) : activeAlerts.length === 0 && resolvedAlerts.length === 0 ? (
          <div className="text-center py-20">
            <CheckCircle className="w-16 h-16 text-emerald-500/30 mx-auto mb-4" />
            <p className="text-dark-400 text-lg font-medium">
              No suspicious activity detected
            </p>
            <p className="text-dark-500 text-sm mt-1">All orders are clean</p>
          </div>
        ) : (
          <>
            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <h3 className="text-red-400 font-bold text-sm uppercase tracking-wider">
                    Active Alerts ({activeAlerts.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {activeAlerts.map((alert, i) => (
                    <div
                      key={`active-${alert.orderId}-${alert.itemId}-${i}`}
                      className="bg-red-900/20 border border-red-500/40 rounded-2xl p-4 hover:border-red-500/60 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* Top row: reason badge */}
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="text-red-400 text-xs font-bold bg-red-500/20 px-2.5 py-1 rounded-lg">
                              {alert.reason}
                            </span>
                          </div>

                          {/* Detail grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                              <div>
                                <p className="text-dark-500 text-[10px] uppercase">
                                  Agent
                                </p>
                                <p className="text-white text-sm font-medium">
                                  {alert.agentName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                              <div>
                                <p className="text-dark-500 text-[10px] uppercase">
                                  Order ID
                                </p>
                                <p className="text-cyan-400 text-sm font-mono font-medium">
                                  #{alert.orderId}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ShoppingCart className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                              <div>
                                <p className="text-dark-500 text-[10px] uppercase">
                                  Product
                                </p>
                                <p className="text-dark-300 text-sm">
                                  {alert.product}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-dark-500 shrink-0" />
                              <div>
                                <p className="text-dark-500 text-[10px] uppercase">
                                  Date & Time
                                </p>
                                <p className="text-dark-300 text-sm">
                                  {formatDateTime(alert.dateTime)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Balance info row */}
                          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-red-500/20">
                            <div>
                              <span className="text-dark-500 text-[10px] uppercase">
                                Balance Before
                              </span>
                              <p className="text-emerald-400 text-sm font-medium">
                                {alert.balanceBefore != null
                                  ? formatGHS(alert.balanceBefore)
                                  : "N/A"}
                              </p>
                            </div>
                            <div>
                              <span className="text-dark-500 text-[10px] uppercase">
                                Order Price
                              </span>
                              <p className="text-amber-400 text-sm font-semibold">
                                {formatGHS(alert.orderPrice)}
                              </p>
                            </div>
                            <div>
                              <span className="text-dark-500 text-[10px] uppercase">
                                Balance After
                              </span>
                              <p
                                className={`text-sm font-medium ${alert.balanceBefore != null && alert.balanceAfter != null && Math.abs(alert.balanceBefore - alert.balanceAfter) < 0.01 ? "text-red-400 font-bold" : "text-emerald-400"}`}
                              >
                                {alert.balanceAfter != null
                                  ? formatGHS(alert.balanceAfter)
                                  : "N/A"}
                              </p>
                            </div>
                            {alert.mobileNumber && (
                              <div>
                                <span className="text-dark-500 text-[10px] uppercase">
                                  Mobile
                                </span>
                                <p className="text-dark-300 text-sm">
                                  {alert.mobileNumber}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resolve button */}
                        <button
                          onClick={() =>
                            handleResolve(alert.orderId, alert.itemId)
                          }
                          className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/30 hover:border-emerald-500/60 transition-all"
                          title="Mark as resolved"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved Alerts */}
            {resolvedAlerts.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500/50" />
                  <h3 className="text-dark-500 font-bold text-sm uppercase tracking-wider">
                    Resolved ({resolvedAlerts.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {resolvedAlerts.map((alert, i) => (
                    <div
                      key={`resolved-${alert.orderId}-${alert.itemId}-${i}`}
                      className="bg-dark-800/30 border border-dark-700/50 rounded-xl px-4 py-3 opacity-60"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-dark-500 font-mono">
                            #{alert.orderId}
                          </span>
                          <span className="text-dark-400">
                            {alert.agentName}
                          </span>
                          <span className="text-dark-500">{alert.product}</span>
                          <span className="text-dark-500">
                            {formatGHS(alert.orderPrice)}
                          </span>
                          <span className="text-dark-600 text-xs">
                            {formatDateTime(alert.dateTime)}
                          </span>
                        </div>
                        <span className="text-emerald-500/50 text-xs font-medium flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Resolved
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SuspiciousActivity;

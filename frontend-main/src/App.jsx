import React, { useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import getSocket from './utils/socket';
import Swal from 'sweetalert2';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

import Login from './pages/Login';
// import Register from './pages/';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import Premium from './pages/Premium';
import SuperAgent from './pages/SuperAgent';
import NormalAgent from './pages/NormalAgent';
import OtherDashboard from './pages/OtherDashboard';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import Shop from './pages/Shop';
import PublicStorefront from './pages/PublicStorefront';
import BASE_URL from './endpoints/endpoints';

const AGENT_INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes for agents
const ADMIN_INACTIVITY_TIMEOUT = 90 * 60 * 1000; // 1 hour 30 minutes for admin
const WARNING_BEFORE = 60 * 1000; // 1 minute warning before logout

const PrivateRoute = ({ allowedRoles }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');
  const navigate = useNavigate();
  const inactivityTimer = useRef(null);
  const warningTimer = useRef(null);
  const warningShown = useRef(false);

  const logoutUser = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      try { await axios.post(`${BASE_URL}/api/auth/logout`, { userId }); } catch (e) {}
    }
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  const resetTimer = useCallback(() => {
    if (!localStorage.getItem('token')) return;
    if (warningShown.current) return; // Don't reset if warning is showing
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);

    const role = localStorage.getItem('role');
    const timeout = role === 'ADMIN' ? ADMIN_INACTIVITY_TIMEOUT : AGENT_INACTIVITY_TIMEOUT;

    warningTimer.current = setTimeout(() => {
      warningShown.current = true;
      Swal.fire({
        title: 'Are you still there?',
        text: 'You will be logged out due to inactivity in 1 minute.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Stay Logged In',
        cancelButtonText: 'Log Out Now',
        timer: WARNING_BEFORE,
        timerProgressBar: true,
        reverseButtons: true,
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4',
        cancelButtonColor: '#ef4444',
        allowOutsideClick: false
      }).then((result) => {
        warningShown.current = false;
        if (result.isConfirmed) {
          resetTimer();
        } else {
          logoutUser();
        }
      });
    }, timeout - WARNING_BEFORE);

    inactivityTimer.current = setTimeout(() => {
      Swal.close();
      warningShown.current = false;
      logoutUser();
    }, timeout);
  }, [logoutUser]);

  useEffect(() => {
    if (!token) return;
    resetTimer();
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const handler = () => { if (!warningShown.current) resetTimer(); };
    events.forEach(e => window.addEventListener(e, handler));
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
    };
  }, [token, resetTimer]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    Swal.fire('Access Denied', 'You do not have permission to access this page.', 'error');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

function App() {
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const socket = getSocket();

    const handleForceLogout = (data) => {
      Swal.fire({
        title: 'Session Terminated',
        text: data.message || 'Your session has been terminated by an administrator. Please log in again.',
        icon: 'warning',
        confirmButtonText: 'OK',
        background: '#1e293b',
        color: '#f1f5f9',
        confirmButtonColor: '#06b6d4',
      }).then(() => {
        localStorage.clear();
        window.location.href = '/login';
      });
    };

    socket.on('force-logout', handleForceLogout);

    return () => {
      socket.off('force-logout', handleForceLogout);
    };
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        {/* <Route path="/" element={<Register />} /> */}
        <Route path="/shop" element={<Shop />} />
        <Route path="/store/:slug" element={<PublicStorefront />} />

        {/* Protected Routes */}
        <Route element={<PrivateRoute allowedRoles={['ADMIN']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route element={<PrivateRoute allowedRoles={['USER']} />}>
          <Route path="/user" element={<UserDashboard />} />
        </Route>
        <Route element={<PrivateRoute allowedRoles={['PREMIUM']} />}>
          <Route path="/premium" element={<Premium />} />
        </Route>
        <Route element={<PrivateRoute allowedRoles={['SUPER']} />}>
          <Route path="/superagent" element={<SuperAgent />} />
        </Route>
        <Route element={<PrivateRoute allowedRoles={['NORMAL']} />}>
          <Route path="/normalagent" element={<NormalAgent />} />
        </Route>
        <Route element={<PrivateRoute allowedRoles={['OTHER']} />}>
          <Route path="/otherdashboard" element={<OtherDashboard />} />
        </Route>

        {/* Profile Routes - Available to all authenticated users */}
        <Route element={<PrivateRoute allowedRoles={['ADMIN', 'USER', 'PREMIUM', 'SUPER', 'NORMAL', 'OTHER']} />}>
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </Router>
  );
}

export default App;

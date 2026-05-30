import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Mail, Lock, User, Phone, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import BASE_URL from "../endpoints/endpoints";
import { toast } from "react-toastify";

const Register = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const navigate = useNavigate();

  const redirectToDashboard = (role) => {
    switch (role) {
      case "ADMIN": navigate("/admin"); break;
      case "USER": navigate("/user"); break;
      case "PREMIUM": navigate("/premium"); break;
      case "SUPER": navigate("/superagent"); break;
      case "NORMAL": navigate("/normalagent"); break;
      case "OTHER": navigate("/otherdashboard"); break;
      default: navigate("/login");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(""); // Clear error on typing
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/register`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone || undefined
      });

      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("name", user.name);
      localStorage.setItem("email", user.email);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("isSuspended", "false");

      toast.success("Registration successful! Welcome to kellishub.");
      redirectToDashboard(user.role);
    } catch (err) {
      setLoading(false);
      const message = err.response?.data?.message || "Registration failed. Please try again.";
      setError(message);
    }
  };

  const inputClasses = "w-full pl-11 pr-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all backdrop-blur-sm text-sm";
  const labelClasses = "block text-xs font-semibold tracking-wider text-slate-400 uppercase mb-2 ml-1";
  const iconClasses = "absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500";

  return (
    <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4 sm:p-8 font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-6xl flex flex-col lg:flex-row bg-slate-900/60 rounded-[2rem] border border-slate-800/60 shadow-2xl overflow-hidden backdrop-blur-xl">
        
        {/* Left Side: Aesthetic Panel */}
        <div className="hidden lg:flex w-5/12 relative flex-col justify-between p-12 overflow-hidden border-r border-slate-800/60">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent"></div>
          <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full bg-indigo-500/20 blur-[100px]"></div>
          <div className="absolute -bottom-[20%] -right-[20%] w-[60%] h-[60%] rounded-full bg-purple-500/20 blur-[100px]"></div>

          <div className="relative z-10">
            <Link to="/" className="inline-flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <span className="text-white font-bold text-xl">K</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">kellishub</span>
            </Link>
          </div>

          <div className="relative z-10 space-y-6 mb-10">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="text-4xl xl:text-5xl font-bold text-white leading-[1.1]"
            >
              Start your journey with us.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-slate-400 text-lg max-w-sm"
            >
              Experience seamless data package fulfillment and agent management like never before.
            </motion.p>
          </div>

          <div className="relative z-10 flex gap-4 text-sm text-slate-500">
            <span>© 2026 kellishub.</span>
            <Link to="/" className="hover:text-slate-300 transition-colors">Privacy</Link>
            <Link to="/" className="hover:text-slate-300 transition-colors">Terms</Link>
          </div>
        </div>

        {/* Right Side: Form Panel */}
        <div className="w-full lg:w-7/12 p-8 sm:p-12 xl:p-16 flex flex-col justify-center relative z-10">
          <div className="max-w-md w-full mx-auto">
            
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Create an account</h2>
              <p className="text-slate-400">Join thousands of users on kellishub today.</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleRegister} className="space-y-5">
              <div className="grid grid-cols-1 gap-5">
                <div className="relative group">
                  <label className={labelClasses}>Full Name</label>
                  <div className="relative">
                    <div className={iconClasses}><User className="w-[18px] h-[18px] group-focus-within:text-indigo-400 transition-colors" /></div>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={inputClasses}
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                </div>

                <div className="relative group">
                  <label className={labelClasses}>Email Address</label>
                  <div className="relative">
                    <div className={iconClasses}><Mail className="w-[18px] h-[18px] group-focus-within:text-indigo-400 transition-colors" /></div>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={inputClasses}
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="relative group">
                  <label className={labelClasses}>Phone Number <span className="text-slate-600 font-normal normal-case">(Optional)</span></label>
                  <div className="relative">
                    <div className={iconClasses}><Phone className="w-[18px] h-[18px] group-focus-within:text-indigo-400 transition-colors" /></div>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={inputClasses}
                      placeholder="024 123 4567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="relative group">
                    <label className={labelClasses}>Password</label>
                    <div className="relative">
                      <div className={iconClasses}><Lock className="w-[18px] h-[18px] group-focus-within:text-indigo-400 transition-colors" /></div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className={inputClasses}
                        placeholder="Min 6 chars"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                  </div>

                  <div className="relative group">
                    <label className={labelClasses}>Confirm Password</label>
                    <div className="relative">
                      <div className={iconClasses}><Lock className="w-[18px] h-[18px] group-focus-within:text-indigo-400 transition-colors" /></div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className={inputClasses}
                        placeholder="Repeat password"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign up for free</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            </form>

            <div className="mt-8 text-center">
              <p className="text-slate-400 text-sm">
                Already have an account?{" "}
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors underline-offset-4 hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

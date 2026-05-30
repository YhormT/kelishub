import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, Mail, Lock, Shield, Zap, Wifi } from "lucide-react";
import { motion } from "framer-motion";
import axios from "axios";
import BASE_URL from "../endpoints/endpoints";
import { toast } from "react-toastify";
import { Dialog } from "@headlessui/react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
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

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const token = localStorage.getItem("token");
    if (storedRole && token) {
      redirectToDashboard(storedRole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, { email, password });

      if (res.data?.user?.isLoggedIn === false) {
        toast.warn("This account is currently in use. Please log out from other devices.");
        setLoading(false);
        return;
      }

      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("role", user.role);
      localStorage.setItem("name", user.name);
      localStorage.setItem("email", user.email);
      localStorage.setItem("userId", user.id);
      localStorage.setItem("isLoggedIn", true);
      localStorage.setItem("isSuspended", user.isSuspended ? "true" : "false");

      redirectToDashboard(user.role);
    } catch (err) {
      setLoading(false);
      if (err.response?.status === 403) {
        toast.warn("This account is currently in use. Please log out from other devices.");
      } else {
        // Show the actual error message from the backend if available, otherwise fallback to generic
        setError(err.response?.data?.message || "Invalid email or password. Please check your connection.");
      }
    }
  };

  return (
    <div className="login-page min-h-screen bg-white text-slate-900 flex">
      <style>{`
        .login-page input:focus, .login-page textarea:focus, .login-page select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
          border-color: #2563eb !important;
        }
      `}</style>
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden bg-blue-600">
        {/* Decorative shapes  */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-16 w-64 h-64 bg-blue-500/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-32 right-12 w-80 h-80 bg-yellow-400/15 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/3 w-40 h-40 bg-blue-400/30 rounded-full blur-2xl"></div>
        </div>

        <div className="relative z-10 flex flex-col justify-between py-10 px-12 xl:px-16 w-full">
          {/* Top - Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="kellishub" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold text-white">kellishub</span>
          </div>

          {/* Center - Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-md"
          >
            <h1 className="text-3xl xl:text-4xl font-bold text-white mb-4 leading-tight">
              Your trusted platform for data services in Ghana
            </h1>
            <p className="text-blue-100 text-base leading-relaxed mb-10">
              Fast, secure, and affordable connectivity solutions for everyone. Buy data for all major networks in one place.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium">Secure Transactions</span>
                  <p className="text-blue-200 text-xs">Industry-standard encryption</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10">
                  <Zap className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium">Instant Delivery</span>
                  <p className="text-blue-200 text-xs">Data delivered in seconds</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/10">
                  <Wifi className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-white text-sm font-medium">All Networks</span>
                  <p className="text-blue-200 text-xs">MTN, Telecel, AirtelTigo</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom - Stats */}
          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-bold text-white">5K+</div>
              <div className="text-blue-200 text-xs">Customers</div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div>
              <div className="text-2xl font-bold text-white">99.9%</div>
              <div className="text-blue-200 text-xs">Uptime</div>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div>
              <div className="text-2xl font-bold text-white">24/7</div>
              <div className="text-blue-200 text-xs">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center px-5 sm:px-8 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Logo for Mobile */}
          <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
            <img src="/logo-icon.png" alt="kellishub" className="w-9 h-9 rounded-lg" />
            <span className="text-xl font-bold text-slate-900">kellishub</span>
          </div>

          {/* <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Welcome back</h2>
              <p className="text-slate-500 text-sm">Sign in to your account to continue</p>
            </div>
            <Link
              to="/register"
              className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] shadow-sm shadow-blue-600/20"
            >
              Register
            </Link>
          </div> */}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 text-sm"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4.5 w-4.5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 transition-all focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-500/10 text-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-600/20"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>

            <div className="text-center pt-1">
              <a
                href="https://wa.me/233248830004"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors font-medium"
              >
                <span>Need an account? Request access</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setShowTermsModal(true)} className="hover:text-blue-600 transition-colors">
                Terms & Conditions
              </button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => setShowPrivacyModal(true)} className="hover:text-blue-600 transition-colors">
                Privacy Policy
              </button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => setShowRefundModal(true)} className="hover:text-blue-600 transition-colors">
                Refund Policy
              </button>
              <span className="text-slate-200">|</span>
              <button type="button" onClick={() => setShowFaqModal(true)} className="hover:text-blue-600 transition-colors">
                FAQs
              </button>
            </div>
          </form>

          <div className="text-center mt-6">
            <a href="/" className="text-slate-400 hover:text-slate-600 transition-colors text-sm inline-flex items-center gap-1">
              <span>&larr;</span> Back to Home
            </a>
          </div>
        </motion.div>
      </div>

      {/* Terms of Use Modal */}
      <Dialog open={showTermsModal} onClose={() => setShowTermsModal(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Dialog.Panel className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh]">
            <Dialog.Title className="text-2xl font-bold text-blue-600 mb-4 text-center">
              kellishub TERMS AND CONDITIONS & REFUND POLICY
            </Dialog.Title>

            <p className="text-center text-sm text-gray-500 mb-6">
              <span className="italic">Effective Date:</span> 16th December 2025
            </p>

            <p className="text-sm text-gray-600 mb-4">
              Welcome to kellishub. By using our services, purchasing our products, or accessing our platforms, you agree to be bound by the following Terms and Conditions. Please read them carefully.
            </p>

            <div className="space-y-6 text-sm text-gray-700">
              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">1. ABOUT kellishub</h3>
                <p className="mb-2">kellishub is a digital and service-based business that provides:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Data bundles and airtime for all networks</li>
                  <li>Electronics and related devices</li>
                  <li>SIM registration, business registration, birth certificate processing, and other documentation services</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">2. ACCEPTANCE OF TERMS</h3>
                <p className="mb-2">By making a purchase or requesting any service from kellishub, you confirm that:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>You are legally capable of entering into a binding agreement.</li>
                  <li>You have read, understood, and agreed to these Terms and Conditions.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">3. PRICING & PAYMENTS</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>All prices are stated in Ghana Cedis (GHS) unless otherwise specified.</li>
                  <li>Full payment must be made before service delivery or processing.</li>
                  <li>kellishub reserves the right to change prices at any time without prior notice.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">4. SERVICE DELIVERY</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Digital services (data, airtime, etc.) are delivered electronically and are usually processed instantly or within a reasonable time.</li>
                  <li>Physical products will be delivered or handed over as agreed at the time of purchase.</li>
                  <li>Service-based transactions begin once payment is confirmed.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">5. CUSTOMER RESPONSIBILITY</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Customers are responsible for providing accurate details (phone number, network, personal data, documents, etc.).</li>
                  <li>kellishub will not be held liable for errors resulting from incorrect information provided by the customer.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">6. REFUND POLICY</h3>

                <div className="ml-4 space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-800">6.1 Digital Products & Services</h4>
                    <p className="text-gray-600 text-xs mb-1">This includes data bundles, airtime, and other digital services.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Digital products are non-refundable once successfully delivered.</li>
                      <li>Refunds will only be considered if:</li>
                      <ul className="list-disc list-inside ml-6 space-y-1">
                        <li>Payment was successful but the service was not delivered.</li>
                        <li>A verified system error occurred on kellishub's side.</li>
                      </ul>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800">6.2 Incorrect Details</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>kellishub is not responsible for transactions completed using incorrect details provided by the customer.</li>
                      <li>Such transactions are not eligible for refunds.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800">6.3 Delayed Transactions</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Delays caused by network providers or third-party systems do not automatically qualify for refunds.</li>
                      <li>Refunds will only be processed if the transaction fails completely and is reversed.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800">6.4 Physical Products (Electronics & Devices)</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Physical items may be eligible for a refund or replacement within 24 hours of purchase if:</li>
                      <ul className="list-disc list-inside ml-6 space-y-1">
                        <li>The item is confirmed to be defective at delivery.</li>
                        <li>It is returned in its original condition and packaging.</li>
                      </ul>
                      <li>Items damaged due to misuse, mishandling, or negligence are not refundable.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800">6.5 Service-Based Transactions</h4>
                    <p className="text-gray-600 text-xs mb-1">This includes SIM registration, business certificates, birth certificates, and documentation services.</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Once processing has begun, no refunds will be issued.</li>
                      <li>Refunds may only be considered if kellishub is unable to initiate the service.</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-800">6.6 Refund Processing</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Approved refunds will be processed within 24 hours.</li>
                      <li>Refunds will be made via the original payment method used.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">7. LIMITATION OF LIABILITY</h3>
                <p className="mb-2">kellishub shall not be liable for:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Network failures or third-party service interruptions.</li>
                  <li>Losses resulting from customer negligence or incorrect information.</li>
                  <li>Indirect or consequential damages beyond the value of the purchased service or product.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">8. FRAUD & MISUSE</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Any fraudulent activity, chargeback abuse, or misuse of our services will result in immediate suspension and possible legal action.</li>
                  <li>kellishub reserves the right to refuse service to anyone found violating these terms.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">9. MODIFICATIONS TO TERMS</h3>
                <p>kellishub reserves the right to modify these Terms and Conditions at any time. Continued use of our services constitutes acceptance of the updated terms.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">10. GOVERNING LAW</h3>
                <p>These Terms and Conditions are governed by and interpreted in accordance with the laws of the Republic of Ghana.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">11. CONTACT INFORMATION</h3>
                <p className="mb-2">For inquiries, complaints, or refund-related issues, contact us via:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Website: <a href="https://kellishub.vercel.app/" className="text-blue-500 underline">https://kellishub.vercel.app/</a></li>
                  <li>Customer Support: <span className="text-blue-600">+233596316991</span></li>
                  <li>Complaints: <span className="text-blue-600">+23324883004</span> (WhatsApp only)</li>
                </ul>
              </section>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowTermsModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacyModal} onClose={() => setShowPrivacyModal(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Dialog.Panel className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh]">
            <Dialog.Title className="text-2xl font-bold text-blue-600 mb-4 text-center">
              Privacy Policy for kellishub
            </Dialog.Title>

            <p className="text-center text-sm text-gray-500 mb-6">
              <span className="italic">Effective Date:</span> 01/06/2025
            </p>

            <div className="space-y-6 text-sm text-gray-700">
              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">1. Information We Collect</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Personal Information:</strong> Name, phone number, email address, and network provider.</li>
                  <li><strong>Transaction Information:</strong> Data bundle purchases, payment methods (e.g., MoMo – not stored), and transaction history.</li>
                  <li><strong>Device Information:</strong> IP address, device type, browser type, and location data (for security and optimization).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">2. How We Use Your Information</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Process your data bundle orders.</li>
                  <li>Communicate with you regarding purchases, updates, or issues.</li>
                  <li>Improve our services and customer experience.</li>
                  <li>Prevent fraud and ensure account security.</li>
                  <li>Send promotional messages (optional; opt-out available).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">3. Data Sharing</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>We don't sell or share your personal data, except:</li>
                  <ul className="ml-6 list-disc space-y-1">
                    <li>With trusted service providers (e.g., payment gateways).</li>
                    <li>When legally required.</li>
                    <li>To prevent fraud or protect users and our platform.</li>
                  </ul>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">4. Data Security</h3>
                <p>We use reasonable industry-standard practices to protect your data. While no system is perfectly secure, we do our best to keep your information safe.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">5. Your Rights</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Access, update, or delete your personal information.</li>
                  <li>Opt-out of promotional messages.</li>
                  <li>Request us to stop processing your data (with business/legal limitations).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">6. Cookies & Tracking</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Used to enhance browsing, remember preferences, and track site traffic.</li>
                  <li>You can disable cookies in your browser settings.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">7. Third-Party Links</h3>
                <p>Links to third-party websites may exist. We are not responsible for their content or privacy practices.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">8. Changes to This Policy</h3>
                <p>This policy may be updated periodically. Changes will be reflected with a revised effective date.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">9. Contact Us</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Email: <a href="mailto:kelisdata22@gmail.com" className="text-blue-500 underline">kelisdata22@gmail.com</a></li>
                  <li>Phone: <span className="text-blue-600"> 0248830004</span></li>
                </ul>
              </section>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Refund Policy Modal */}
      <Dialog open={showRefundModal} onClose={() => setShowRefundModal(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Dialog.Panel className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh]">
            <Dialog.Title className="text-2xl font-bold text-blue-600 mb-4 text-center">
              Refund Policy for kellishub
            </Dialog.Title>

            <p className="text-center text-sm text-gray-500 mb-6">
              <span className="italic">Effective Date:</span> 01/06/2025
            </p>

            <div className="space-y-6 text-sm text-gray-700">
              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">1. Overview</h3>
                <p>At kellishub, we strive to provide reliable and efficient data bundle services. We understand that issues may occasionally arise, and we are committed to resolving them fairly. This Refund Policy outlines the conditions under which refunds may be granted.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">2. Eligibility for Refunds</h3>
                <p className="mb-2">Refunds may be considered under the following circumstances:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Failed Transactions:</strong> If payment was deducted but the data bundle was not delivered due to a system error on our end.</li>
                  <li><strong>Duplicate Payments:</strong> If you were charged multiple times for the same order.</li>
                  <li><strong>Service Unavailability:</strong> If the service was unavailable and we were unable to fulfill your order within a reasonable timeframe.</li>
                  <li><strong>Incorrect Order:</strong> If you received a different data bundle than what was ordered (subject to verification).</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">3. Non-Refundable Situations</h3>
                <p className="mb-2">Refunds will NOT be granted in the following cases:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Data bundles that have been successfully delivered and activated.</li>
                  <li>Orders placed with incorrect phone numbers provided by the customer.</li>
                  <li>Change of mind after a successful transaction.</li>
                  <li>Network issues on the customer's mobile carrier that prevent data usage.</li>
                  <li>Expired data bundles due to non-usage within the validity period.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">4. Refund Request Process</h3>
                <p className="mb-2">To request a refund:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Timing:</strong> Refund requests are processed on <strong>Sundays only</strong>.</li>
                  <li><strong>Required Information:</strong> You must provide your Order ID, data size, mobile number, and a brief description of the issue.</li>
                  <li><strong>Contact:</strong> Submit your request via WhatsApp at <span className="text-blue-600">0248830004</span> or email <a href="mailto:kelisdata22@gmail.com" className="text-blue-500 underline">kelisdata22@gmail.com</a>.</li>
                  <li><strong>Processing Time:</strong> Approved refunds will be processed within 3-5 business days.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">5. Refund Methods</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Account Credit:</strong> Refunds are typically credited to your kellishub account balance for future purchases.</li>
                  <li><strong>Mobile Money:</strong> In exceptional cases, refunds may be sent to your registered mobile money number.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">6. Dispute Resolution</h3>
                <p>If you are not satisfied with the outcome of your refund request, you may escalate the matter by contacting our support team. We will review your case and provide a final decision within 7 business days.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">7. Changes to This Policy</h3>
                <p>kellishub reserves the right to modify this Refund Policy at any time. Changes will be posted on this page with an updated effective date.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">8. Contact Us</h3>
                <p>For refund inquiries or assistance:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Email: <a href="mailto:kelisdata22@gmail.com" className="text-blue-500 underline">kelisdata22@gmail.com</a></li>
                  <li>WhatsApp: <span className="text-blue-600">0248830004</span></li>
                </ul>
              </section>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* FAQs Modal */}
      <Dialog open={showFaqModal} onClose={() => setShowFaqModal(false)}>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <Dialog.Panel className="bg-white p-6 rounded-xl shadow-2xl max-w-2xl w-full mx-4 overflow-y-auto max-h-[90vh]">
            <Dialog.Title className="text-2xl font-bold text-blue-600 mb-4 text-center">
              Frequently Asked Questions (FAQs)
            </Dialog.Title>

            <div className="space-y-6 text-sm text-gray-700">
              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">1. What is kellishub?</h3>
                <p>kellishub is a trusted online platform for purchasing affordable data bundles for MTN, AirtelTigo, and Telecel networks in Ghana. We provide fast, reliable, and secure data bundle services.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">2. How do I purchase data bundles?</h3>
                <p>Simply log into your kellishub account, select the data bundle you want, enter the recipient's phone number, and complete the payment. Your data will be delivered instantly.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">3. What payment methods do you accept?</h3>
                <p>We accept Mobile Money (MTN MoMo, AirtelTigo Money, Telecel Cash) and card payments through our secure payment gateway powered by Paystack.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">4. How long does it take to receive my data bundle?</h3>
                <p>Data bundles are typically delivered within 1-5 minutes after successful payment. During peak hours, delivery may take up to 15 minutes.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">5. What if I don't receive my data bundle?</h3>
                <p>If you don't receive your data within 15 minutes, please contact our support team via WhatsApp at 0596316991 with your Order ID and payment confirmation.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">6. Can I get a refund?</h3>
                <p>Yes, refunds are available for failed transactions, duplicate payments, or service errors. Please refer to our Refund Policy for detailed information. Refund requests are processed on Sundays.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">7. Is my payment information secure?</h3>
                <p>Absolutely! We use Paystack, a PCI-DSS compliant payment processor, to handle all transactions. We never store your card details or mobile money PIN on our servers.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">8. What are your operating hours?</h3>
                <p>Our platform is available 24/7 for placing orders. Customer support is available from 7:30 AM to 8:50 PM, Monday to Saturday.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">9. How do I create an account?</h3>
                <p>To create an account, contact our registration agent via WhatsApp at 0244450003. Account creation is by invitation to maintain service quality.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">10. How can I contact customer support?</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>WhatsApp: <span className="text-blue-600">0540277583</span></li>
                  <li>Email: <a href="mailto:kelisdata22@gmail.com" className="text-blue-500 underline">kelisdata22@gmail.com</a></li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">11. Do you offer bulk data purchases?</h3>
                <p>Yes! We offer special rates for bulk purchases and resellers. Contact our support team for more information on bulk pricing.</p>
              </section>

              <section>
                <h3 className="font-semibold text-lg text-gray-800 mb-2">12. Can I track my orders?</h3>
                <p>Yes, you can track all your orders in your dashboard. Each order has a unique Order ID and status that you can monitor.</p>
              </section>
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setShowFaqModal(false)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
};

export default Login;

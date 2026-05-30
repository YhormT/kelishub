import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Phone, Mail, MapPin, Star, Shield, Zap, Clock, ChevronLeft, ChevronRight, Wifi, ArrowRight, CheckCircle } from 'lucide-react';
import { Dialog } from "@headlessui/react";
import { motion } from "framer-motion";

const Landing = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const networks = [
    { name: 'MTN', color: 'bg-yellow-500', accent: 'text-yellow-600', light: 'bg-yellow-50', border: 'border-yellow-200', features: ['Instant Activation', 'No Expiry Dates', 'Data Rollover', '4G/5G Support'] },
    { name: 'TELECEL', color: 'bg-red-500', accent: 'text-red-600', light: 'bg-red-50', border: 'border-red-200', features: ['Lightning Fast', 'Nationwide Coverage', 'Bonus Data', 'Easy Top-up'] },
    { name: 'AIRTELTIGO', color: 'bg-blue-600', accent: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200', features: ['Best Value', 'Quick Delivery', 'Flexible Plans', 'Great Coverage'] }
  ];

  const testimonials = [
    { name: 'Kwame Asante', role: 'Student', content: 'kellishub has been my go-to for data packages. Fast, reliable, and affordable prices!', rating: 5 },
    { name: 'Ama Serwaa', role: 'Business Owner', content: 'Excellent service! I buy data for my entire team through kellishub. Never disappointed.', rating: 5 },
    { name: 'Kofi Mensah', role: 'Freelancer', content: 'Quick delivery and great customer support. Highly recommend kellishub for all data needs.', rating: 5 },
    { name: 'Akosua Frimpong', role: 'Teacher', content: 'Reliable service that keeps me connected with my students. Great experience!', rating: 5 }
  ];

  const nextTestimonial = useCallback(() => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const prevTestimonial = useCallback(() => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  useEffect(() => {
    const interval = setInterval(nextTestimonial, 5000);
    return () => clearInterval(interval);
  }, [nextTestimonial]);

  return (
    <div className="landing-page min-h-screen bg-white text-slate-900">
      <style>{`
        .landing-page input:focus, .landing-page textarea:focus, .landing-page select:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15) !important;
          border-color: #2563eb !important;
        }
      `}</style>
      {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-18">
            <div className="flex items-center gap-2.5">
              <img src="/logo-icon.png" alt="kellishub" className="w-9 h-9 rounded-lg" />
              <span className="text-xl font-bold text-slate-900">kellishub</span>
            </div>
            
            <div className="hidden md:flex items-center gap-1">
              <a href="#home" className="px-4 py-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium rounded-lg hover:bg-blue-50">Home</a>
              <a href="#about" className="px-4 py-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium rounded-lg hover:bg-blue-50">About</a>
              <a href="#services" className="px-4 py-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium rounded-lg hover:bg-blue-50">Services</a>
              <a href="#packages" className="px-4 py-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium rounded-lg hover:bg-blue-50">Packages</a>
              <a href="#testimonials" className="px-4 py-2 text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium rounded-lg hover:bg-blue-50">Reviews</a>
              <div className="w-px h-6 bg-slate-200 mx-2"></div>
              <Link to="/login" className="px-4 py-2 text-slate-700 hover:text-blue-600 transition-colors text-sm font-medium">Sign In</Link>
              <Link to="/register" className="px-4 py-2 text-slate-700 hover:text-blue-600 transition-colors text-sm font-medium">Register</Link>
              <Link to="/shop" className="ml-1 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
                Shop Now
              </Link>
            </div>

            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-slate-700 p-2 -mr-2">
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white border-t border-slate-100 shadow-lg"
          >
            <div className="px-4 py-3 space-y-1">
              <a href="#home" onClick={() => setIsMenuOpen(false)} className="block text-slate-700 hover:text-blue-600 hover:bg-blue-50 py-2.5 px-3 rounded-lg text-sm font-medium">Home</a>
              <a href="#about" onClick={() => setIsMenuOpen(false)} className="block text-slate-700 hover:text-blue-600 hover:bg-blue-50 py-2.5 px-3 rounded-lg text-sm font-medium">About</a>
              <a href="#services" onClick={() => setIsMenuOpen(false)} className="block text-slate-700 hover:text-blue-600 hover:bg-blue-50 py-2.5 px-3 rounded-lg text-sm font-medium">Services</a>
              <a href="#packages" onClick={() => setIsMenuOpen(false)} className="block text-slate-700 hover:text-blue-600 hover:bg-blue-50 py-2.5 px-3 rounded-lg text-sm font-medium">Packages</a>
              <a href="#testimonials" onClick={() => setIsMenuOpen(false)} className="block text-slate-700 hover:text-blue-600 hover:bg-blue-50 py-2.5 px-3 rounded-lg text-sm font-medium">Reviews</a>
              <div className="pt-2 pb-1 space-y-2">
                <Link to="/login" onClick={() => setIsMenuOpen(false)} className="block w-full text-center px-4 py-2.5 text-blue-600 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-50">Sign In</Link>
                <Link to="/register" onClick={() => setIsMenuOpen(false)} className="block w-full text-center px-4 py-2.5 text-blue-600 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-50">Register</Link>
                <Link to="/shop" onClick={() => setIsMenuOpen(false)} className="block w-full text-center px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">Shop Now</Link>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="home" className="relative min-h-[100svh] pt-24 sm:pt-28 lg:pt-32 overflow-hidden flex items-center">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/60 via-white to-white"></div>
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-yellow-50/40 to-transparent"></div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-blue-700 text-xs font-medium">Serving Ghana 24/7</span>
              </div>
              
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.25rem] font-extrabold text-slate-900 mb-5 leading-[1.15] tracking-tight">
                Affordable data bundles, <span className="text-blue-600">delivered instantly</span>
              </h1>
              
              <p className="text-base sm:text-lg text-slate-500 mb-8 leading-relaxed max-w-lg">
                kellishub connects you to all major networks in Ghana. Buy MTN, Telecel, and AirtelTigo data packages at the best prices with instant delivery.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link to="/login" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#about" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-slate-700 rounded-xl text-sm font-semibold border border-slate-200 hover:bg-slate-50 transition-colors">
                  Learn More
                </a>
              </div>

              <div className="flex items-center gap-8 sm:gap-10">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">5K+</div>
                  <div className="text-slate-400 text-xs sm:text-sm mt-0.5">Happy Customers</div>
                </div>
                <div className="w-px h-10 bg-slate-200"></div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">99.9%</div>
                  <div className="text-slate-400 text-xs sm:text-sm mt-0.5">Success Rate</div>
                </div>
                <div className="w-px h-10 bg-slate-200"></div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">24/7</div>
                  <div className="text-slate-400 text-xs sm:text-sm mt-0.5">Support</div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative"
            >
              <div className="relative bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xl shadow-slate-200/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-slate-900">Available Networks</h3>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Live
                  </span>
                </div>
                
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-center hover:shadow-md transition-shadow cursor-pointer">
                    <span className="text-yellow-700 font-bold text-base">MTN</span>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-center hover:shadow-md transition-shadow cursor-pointer">
                    <span className="text-red-600 font-bold text-base">TELECEL</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-center hover:shadow-md transition-shadow cursor-pointer">
                    <span className="text-blue-700 font-bold text-xs">AIRTELTIGO</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Wifi className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="text-slate-800 text-sm font-semibold">All Networks Supported</div>
                      <div className="text-slate-400 text-xs">One platform for all your data needs</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-slate-800 text-sm font-semibold">Instant Delivery</div>
                      <div className="text-slate-400 text-xs">Data delivered in seconds</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-xl">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-slate-800 text-sm font-semibold">Secure Payments</div>
                      <div className="text-slate-400 text-xs">Protected by industry standards</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wide">Why kellishub</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Built for speed and reliability</h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-2xl mx-auto">We deliver excellence in every transaction with features designed for your convenience</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {[
              { icon: Zap, title: 'Instant Delivery', desc: 'Get your data bundles delivered instantly after payment', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
              { icon: Shield, title: 'Secure Payment', desc: 'Safe and encrypted transactions every time', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
              { icon: Clock, title: '24/7 Support', desc: 'Round-the-clock customer assistance', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
              { icon: Star, title: 'Best Prices', desc: 'Competitive rates across all networks', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' }
            ].map((service, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08 }}
                className="group p-6 bg-white rounded-xl border border-slate-200 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-50 transition-all"
              >
                <div className={`w-11 h-11 rounded-lg ${service.iconBg} flex items-center justify-center mb-4`}>
                  <service.icon className={`w-5 h-5 ${service.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-slate-900 mb-1.5">{service.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{service.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="packages" className="py-16 sm:py-20 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wide">Networks</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Data packages for every network</h2>
            <p className="text-slate-500 text-base sm:text-lg">Choose from our wide range of affordable data packages</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {networks.map((network, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all"
              >
                <div className={`h-1.5 ${network.color}`}></div>
                <div className="p-6 sm:p-8">
                  <div className={`inline-flex items-center justify-center px-4 py-2 ${network.light} rounded-lg mb-5`}>
                    <span className={`font-bold text-sm ${network.accent}`}>{network.name}</span>
                  </div>
                  <div className="space-y-2.5 mb-6">
                    {network.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2.5">
                        <CheckCircle className={`w-4 h-4 ${network.accent} flex-shrink-0`} />
                        <span className="text-slate-600 text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Link to="/login" className={`block w-full py-3 text-center ${network.color} text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity`}>
                    Buy {network.name} Data
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 sm:py-20 lg:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wide">About Us</p>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-5">Ghana's trusted data partner</h2>
              <p className="text-slate-500 text-base sm:text-lg mb-5 leading-relaxed">
                kellishub is Ghana's premier data package dealer, committed to keeping you connected with affordable and reliable internet bundles. We've built our reputation on trust, speed, and exceptional customer service.
              </p>
              <p className="text-slate-500 text-base sm:text-lg mb-8 leading-relaxed">
                Since our inception, we've served thousands of customers across Ghana, providing instant data bundle top-ups for all major networks including MTN, Telecel, and AirtelTigo.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-blue-50 rounded-xl text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-blue-600 mb-1">5,000+</div>
                  <div className="text-slate-500 text-sm">Happy Customers</div>
                </div>
                <div className="p-5 bg-yellow-50 rounded-xl text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-yellow-600 mb-1">99.9%</div>
                  <div className="text-slate-500 text-sm">Success Rate</div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="bg-slate-50 rounded-2xl p-6 sm:p-8 border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-3">Our Mission</h3>
                <p className="text-slate-500 text-base leading-relaxed mb-6">
                  To provide fast, reliable, and affordable data packages that keep Ghana connected. We believe everyone deserves access to affordable internet connectivity.
                </p>
                <div className="flex items-center gap-3.5 p-4 bg-white rounded-xl border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-slate-700 text-sm font-medium">Always Connected, Always Reliable</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-16 sm:py-20 lg:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wide">Testimonials</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Trusted by thousands</h2>
            <p className="text-slate-500 text-base sm:text-lg">See what our customers have to say about kellishub</p>
          </div>

          <div className="relative max-w-3xl mx-auto">
            <div className="overflow-hidden">
              <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${currentTestimonial * 100}%)` }}>
                {testimonials.map((testimonial, idx) => (
                  <div key={idx} className="w-full flex-shrink-0 px-2 sm:px-4">
                    <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 text-center shadow-sm">
                      <div className="flex justify-center mb-4">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                        ))}
                      </div>
                      <p className="text-slate-600 text-base sm:text-lg leading-relaxed mb-6">"{testimonial.content}"</p>
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                          {testimonial.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="text-slate-900 text-sm font-semibold">{testimonial.name}</div>
                          <div className="text-slate-400 text-xs">{testimonial.role}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={prevTestimonial} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-5 w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextTestimonial} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-5 w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm">
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentTestimonial(idx)}
                  className={`h-2 rounded-full transition-all ${idx === currentTestimonial ? 'bg-blue-600 w-6' : 'bg-slate-300 w-2 hover:bg-slate-400'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 lg:py-24 bg-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-72 h-72 bg-yellow-400 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400 rounded-full translate-x-1/3 translate-y-1/3"></div>
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4">Ready to stay connected?</h2>
          <p className="text-blue-100 text-base sm:text-lg mb-8 max-w-xl mx-auto">Join thousands of satisfied customers and get your data bundles delivered instantly.</p>
          <Link to="/login" className="inline-flex items-center gap-2 px-7 py-3.5 bg-yellow-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-yellow-300 transition-colors shadow-lg shadow-yellow-400/30">
            Start Buying Data <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src="/logo-icon.png" alt="kellishub" className="w-9 h-9 rounded-lg" />
                <span className="text-xl font-bold text-white">kellishub</span>
              </div>
              <p className="text-slate-400 text-sm mb-5 max-w-sm leading-relaxed">Your trusted partner for affordable data packages across all major networks in Ghana.</p>
              <div className="flex gap-4">
                <button onClick={() => setShowTermsModal(true)} className="text-slate-500 hover:text-blue-400 transition-colors text-xs">Terms of Service</button>
                <button onClick={() => setShowPrivacyModal(true)} className="text-slate-500 hover:text-blue-400 transition-colors text-xs">Privacy Policy</button>
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2.5">
                <li><a href="#home" className="text-slate-400 hover:text-white transition-colors text-sm">Home</a></li>
                <li><a href="#about" className="text-slate-400 hover:text-white transition-colors text-sm">About</a></li>
                <li><a href="#services" className="text-slate-400 hover:text-white transition-colors text-sm">Services</a></li>
                <li><a href="#packages" className="text-slate-400 hover:text-white transition-colors text-sm">Packages</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Contact</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2.5 text-slate-400 text-sm">
                  <Phone className="w-4 h-4 text-blue-400" />
                  +233 24-883-0004
                </li>
                <li className="flex items-center gap-2.5 text-slate-400 text-sm">
                  <Mail className="w-4 h-4 text-blue-400" />
                  yormborlee@gmail.com
                </li>
                <li className="flex items-center gap-2.5 text-slate-400 text-sm">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  Accra, Ghana
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-center">
            <p className="text-slate-500 text-xs">&copy; {new Date().getFullYear()} kellishub. All rights reserved.</p>
          </div>
        </div>
      </footer>

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
                  <li>Customer Support: <span className="text-blue-600">+23324883004</span></li>
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
    </div>
  );
};

export default Landing;

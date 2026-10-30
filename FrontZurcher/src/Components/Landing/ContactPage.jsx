import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaClock, FaCalendarAlt } from 'react-icons/fa';
import img7 from '../../assets/landing/7.jpeg';

const ContactPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Abrir el modal automáticamente al cargar la página
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowQuoteModal(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <SEOHelmet 
        title="Contact Zurcher Septic | Free Quotes & Scheduled Service"
        description="Contact Zurcher Septic for free septic system quotes in Southwest Florida. Professional installation, repairs, maintenance. Serving Lehigh Acres, Fort Myers, Cape Coral. Call (954) 636-8200."
        keywords="contact septic contractor, septic quote Florida, septic installation quote, septic service Lehigh Acres, septic company Fort Myers, free septic estimate"
        canonicalUrl="https://www.zurcherseptic.com/contact"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />
      
      {/* Hero Section with Background */}
      <div className="relative min-h-screen w-full overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src={img7}
            alt="Contact Zurcher Septic"
            className="w-full h-full object-cover"
          />
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/85 to-slate-800/90"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center min-h-screen px-6 pt-32 pb-20">
          <div className="max-w-5xl w-full">
            {/* Header */}
            <div className="text-center mb-12 animate-fade-in-up">
              <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-2xl">
                Get In Touch
              </h1>
              <div className="w-32 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 mx-auto mb-6"></div>
              <p className="text-xl md:text-2xl text-slate-200 leading-relaxed drop-shadow-lg max-w-3xl mx-auto">
                Ready to start your septic system project? Contact us today for a free consultation and quote.
              </p>
            </div>

            {/* Main CTA Button */}
            <div className="text-center mb-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <button
                onClick={() => setShowQuoteModal(true)}
                className="px-12 py-6 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white rounded-xl font-bold text-2xl transition-all duration-300 shadow-2xl transform hover:scale-105 flex items-center gap-3 mx-auto"
              >
                <FaCalendarAlt className="text-3xl" />
                Schedule Free Quote
              </button>
            </div>

            {/* Contact Information Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-12">
              {/* Phone Card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl animate-fade-in-up hover:bg-white/15 transition-all duration-300" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center">
                    <FaPhone className="text-2xl text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Call Us</h3>
                    <p className="text-slate-300">Call or WhatsApp — we'll get back to you fast</p>
                  </div>
                </div>
                <a 
                  href="tel:+19546368200" 
                  className="text-2xl font-bold text-blue-400 hover:text-cyan-400 transition-colors block"
                >
                  (954) 636-8200
                </a>
              </div>

              {/* Email Card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl animate-fade-in-up hover:bg-white/15 transition-all duration-300 cursor-pointer" style={{ animationDelay: '0.4s' }} onClick={() => setShowQuoteModal(true)}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center">
                    <FaEnvelope className="text-2xl text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Request a Quote</h3>
                    <p className="text-slate-300">Click to schedule</p>
                  </div>
                </div>
                <p className="text-xl font-semibold text-blue-400 hover:text-cyan-400 transition-colors">
                  Get your free estimate today
                </p>
              </div>

              {/* Location Card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl animate-fade-in-up hover:bg-white/15 transition-all duration-300" style={{ animationDelay: '0.5s' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center">
                    <FaMapMarkerAlt className="text-2xl text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Location</h3>
                    <p className="text-slate-300">Southwest Florida</p>
                  </div>
                </div>
                <p className="text-lg text-slate-200">
                  450 Rathburn Ave<br />
                  Lehigh Acres, FL 33974
                </p>
              </div>

              {/* Hours Card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl animate-fade-in-up hover:bg-white/15 transition-all duration-300" style={{ animationDelay: '0.6s' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-full flex items-center justify-center">
                    <FaClock className="text-2xl text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">Business Hours</h3>
                    <p className="text-slate-300">We're here for you</p>
                  </div>
                </div>
                <div className="text-slate-200 text-lg space-y-1">
                  <p>Mon - Fri: 8:00 AM - 6:00 PM</p>
                  <p>Sat: 9:00 AM - 3:00 PM</p>
                  <p className="text-cyan-400 font-semibold">Service calls & repairs by appointment</p>
                </div>
              </div>
            </div>

            {/* Service Areas */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 shadow-2xl animate-fade-in-up text-center" style={{ animationDelay: '0.7s' }}>
              <h3 className="text-2xl font-bold text-white mb-4">Service Areas</h3>
              <p className="text-slate-200 text-lg leading-relaxed">
                Fort Myers • Cape Coral • Lehigh Acres • Bonita Springs • Estero • Naples • Port Charlotte • Punta Gorda • North Port • And surrounding areas
              </p>
            </div>
          </div>
        </div>
      </div>

      <LoginPopup isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <FloatingQuoteButton onClick={() => setShowQuoteModal(true)} />
      <ScheduleQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
    </>
  );
};

export default ContactPage;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';
import { FaArrowRight, FaPhone, FaTools, FaWrench, FaCalendarCheck, FaHome } from 'react-icons/fa';
import img1 from '../../assets/landing/1.jpeg';
import img2 from '../../assets/landing/2.jpeg';
import img3 from '../../assets/landing/3.jpeg';
import img7 from '../../assets/landing/7.jpeg';

const services = [
  {
    title: 'Conventional Septic System Installation',
    description: 'Complete installation of conventional septic systems designed for your property, fully permitted and compliant with Florida regulations.',
    image: img3,
    path: '/services/regular-installation',
    icon: <FaHome className="text-3xl" />,
    tag: 'Installation',
  },
  {
    title: 'ATU System Installation',
    description: 'Advanced Aerobic Treatment Unit systems — ideal for restricted lots requiring a higher level of wastewater treatment.',
    image: img1,
    path: '/services/atu-installation',
    icon: <FaTools className="text-3xl" />,
    tag: 'Advanced Systems',
  },
  {
    title: 'Maintenance',
    description: 'Scheduled maintenance programs to keep your septic system running efficiently and in compliance with Florida regulations.',
    image: img2,
    path: '/maintenance-services',
    icon: <FaCalendarCheck className="text-3xl" />,
    tag: 'Maintenance',
  },
  {
    title: 'Repairs',
    description: 'Fast, reliable septic system repairs — from pump replacements to drain field restoration.',
    image: img7,
    path: '/repairs',
    icon: <FaWrench className="text-3xl" />,
    tag: 'Repairs',
  },
];

const ServicesPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  return (
    <>
      <SEOHelmet
        title="Septic System Services Florida | Installation, ATU, Repairs & Maintenance"
        description="Complete septic services in Florida: conventional installations, ATU aerobic systems, scheduled maintenance, and repairs. Licensed & insured. Serving Southwest Florida."
        keywords="septic services Florida, septic installation, ATU aerobic systems, septic maintenance, septic repairs, conventional septic, Lehigh Acres, Fort Myers"
        canonicalUrl="https://www.zurcherseptic.com/services"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* HERO */}
      <div className="relative bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 text-white pt-36 pb-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400 via-transparent to-transparent"></div>
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <p className="text-blue-400 font-semibold uppercase tracking-widest text-sm mb-3">What We Do</p>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">Our Services</h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            From initial installation to long-term maintenance — we handle every stage of your septic system with expertise, care, and full compliance with Florida regulations.
          </p>
        </div>
      </div>

      {/* SERVICES GRID */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <Link
                key={index}
                to={service.path}
                className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 min-h-[340px] flex flex-col justify-end cursor-pointer"
              >
                {/* Background Image */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                  style={{ backgroundImage: `url(${service.image})` }}
                ></div>
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-800/60 to-transparent"></div>
                {/* Tag badge */}
                <div className="absolute top-5 left-5">
                  <span className="bg-blue-600/90 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                    {service.tag}
                  </span>
                </div>
                {/* Content */}
                <div className="relative z-10 p-8">
                  <div className="text-blue-400 mb-3">{service.icon}</div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
                    {service.title}
                  </h2>
                  <p className="text-slate-300 text-sm leading-relaxed mb-5">
                    {service.description}
                  </p>
                  <div className="flex items-center gap-2 text-yellow-400 font-bold group-hover:gap-4 transition-all duration-300">
                    <span>Learn More</span>
                    <FaArrowRight />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM CTA */}
      <div className="bg-blue-800 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Not sure which service you need?</h2>
          <p className="text-blue-200 text-lg mb-8">
            Our team will guide you through the process — no obligations, no hidden fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold px-8 py-4 rounded-lg text-lg transition-colors"
            >
              GET A FREE QUOTE
            </button>
            <a
              href="tel:+19546368200"
              className="flex items-center justify-center gap-2 border-2 border-white hover:bg-white hover:text-blue-800 text-white font-bold px-8 py-4 rounded-lg text-lg transition-all duration-300"
            >
              <FaPhone />
              CALL NOW (954) 636-8200
            </a>
          </div>
        </div>
      </div>

      <LoginPopup isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <FloatingQuoteButton onClick={() => setShowQuoteModal(true)} />
      <ScheduleQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
    </>
  );
};

export default ServicesPage;



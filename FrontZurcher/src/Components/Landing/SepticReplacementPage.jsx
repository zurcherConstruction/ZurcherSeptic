import React, { useState } from 'react';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';
import {
  PhoneIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  WrenchScrewdriverIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  TruckIcon,
  CogIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const heroImg      = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_1600/v1777472871/chata2_nudqht.jpg';
const heroImgMobile = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777472931/chata2Celu_bbwl99.jpg';
const imgIncl      = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_900/v1777473360/general_ydct7t.jpg';
const imgProcess   = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_900/v1777473994/Excavadora_jhbx6k.jpg';
const imgBefore    = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777473408/tanqueinstalado_mpoqps.jpg';
const imgAfter     = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1766174828/works/68426718-a20c-428c-9e25-dbc5059fe703/materiales/owcaxzm36anxqowhoz4m.jpg';


const SepticReplacementPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const processSteps = [
    { num: '01', title: 'Evaluation', desc: 'We assess the current system to determine what needs to be replaced.' },
    { num: '02', title: 'Diagnosis', desc: 'We identify whether a partial repair or a full replacement is the right solution.' },
    { num: '03', title: 'Permits', desc: 'We handle the entire Health Department permit process for you.' },
    { num: '04', title: 'Removal & Installation', desc: 'Old system removed and new system installed following approved plans.' },
    { num: '05', title: 'Inspections', desc: 'We coordinate all required inspections, including private ones if needed.' },
    { num: '06', title: 'Final Approval', desc: 'System approved, certified, and fully operational.' },
  ];

  const whenReplace = [
    'System is 20–30 years old',
    'Repeated failures with no lasting solution',
    'Drain field is completely saturated',
    'System was sold in a real estate transaction that required repair',
    'System does not comply with current Florida regulations',
    'Sewage backups or pools of water above the drain field',
  ];

  const whyUs = [
    "Precise diagnosis — we don't guess",
    'Real solutions, not temporary patches',
    'We handle all permits & inspections',
    'Fast, professional work',
    'Compliant with all Florida regulations',
    'High-quality, durable materials',
    'Clear communication throughout the entire process',
  ];

  return (
    <>
      <SEOHelmet
        title="Septic System Replacement Florida | Full System Replacement | Zurcher Septic"
        description="Complete septic system replacement in Southwest Florida. We handle evaluation, permits, removal, installation and final approval. Licensed & insured. No hidden costs."
        keywords="septic system replacement Florida, full septic replacement, septic tank replacement, drain field replacement, septic system replacement Fort Myers, Lehigh Acres septic"
        canonicalUrl="https://www.zurcherseptic.com/services/septic-replacement"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* ── HERO ── */}
      <div className="relative min-h-[80vh] flex items-center overflow-hidden">
        <img src={heroImg} alt="Septic System Replacement Florida" className="absolute inset-0 w-full h-full object-cover object-center hidden md:block" />
        <img src={heroImgMobile} alt="Septic System Replacement Florida" className="absolute inset-0 w-full h-full object-cover object-center block md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/75 to-slate-900/20"></div>
        <div className="relative z-10 w-full px-8 md:px-14 pt-28 md:pt-24 pb-14">
          <div className="max-w-xl">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Full System Replacement</p>
            <h1 className="text-4xl md:text-6xl xl:text-7xl font-black text-yellow-400 leading-none uppercase mb-1">SEPTIC SYSTEM</h1>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase mb-6">Replacement in Florida</h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8">
              When your septic system has reached the end of its life or presents problems that can't be solved with a repair, a full replacement is the safest, most cost-effective long-term solution.
              We manage the entire process — from evaluation to final approval — so you don't have to worry about a thing.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              <button
                onClick={() => setShowQuoteModal(true)}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-7 py-3.5 rounded-lg text-sm transition-colors uppercase"
              >
                <PhoneIcon className="w-4 h-4" /> Get a Free Quote
              </button>
              <a
                href="tel:+19546368200"
                className="flex items-center gap-2 border border-slate-500 hover:border-blue-400 hover:text-blue-400 text-slate-200 font-bold px-7 py-3.5 rounded-lg text-sm transition-colors uppercase"
              >
                <PhoneIcon className="w-4 h-4" /> (954) 636-8200
              </a>
            </div>
            <div className="flex md:hidden items-center gap-3 bg-slate-900/80 border border-yellow-400 rounded-xl px-4 py-3 w-fit">
              <ShieldCheckIcon className="text-yellow-400 w-7 h-7" />
              <div className="text-white text-xs"><span className="font-black">Complete Solution</span><span className="text-slate-300"> — Stress-free process</span></div>
            </div>
          </div>
        </div>
        <div className="hidden md:block absolute top-24 right-5 w-36 shadow-2xl">
          <div className="bg-slate-900/95 border border-yellow-400 rounded-2xl p-5 text-center backdrop-blur-sm">
            <ShieldCheckIcon className="text-yellow-400 w-12 h-12 mx-auto mb-3" />
            <div className="text-slate-300 text-[9px] font-bold uppercase leading-snug tracking-wide mb-1">Complete</div>
            <div className="text-yellow-400 text-sm font-black uppercase tracking-widest mb-1">Solution</div>
            <div className="text-slate-400 text-[9px] leading-snug">Stress-free<br />process</div>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div className="bg-slate-900 border-t border-slate-700 text-white py-5 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: <ShieldCheckIcon className="w-6 h-6" />, label: 'Licensed & Insured' },
              { icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, label: 'We Handle Permits' },
              { icon: <CheckCircleIcon className="w-6 h-6" />, label: 'No Hidden Costs' },
              { icon: <ClockIcon className="w-6 h-6" />, label: 'Fast Turnaround' },
              { icon: <WrenchScrewdriverIcon className="w-6 h-6" />, label: 'Full Process Managed' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-yellow-400 flex-shrink-0">{item.icon}</div>
                <div className="font-bold text-xs uppercase leading-tight text-slate-200 tracking-wide">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 1: WHAT'S INCLUDED ── */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3 text-center">Full Service</p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-4 uppercase text-center">What's Included in Our Service?</h2>
          <p className="text-slate-500 text-sm text-center max-w-2xl mx-auto mb-12">
            From the first evaluation to the final certification — we manage every step of the replacement process.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { icon: <MagnifyingGlassIcon className="w-7 h-7" />, title: 'Full System Evaluation', desc: 'Complete assessment of your existing system condition' },
              { icon: <ClipboardDocumentCheckIcon className="w-7 h-7" />, title: 'Clear Diagnosis', desc: 'Accurate determination of whether replacement is required' },
              { icon: <TruckIcon className="w-7 h-7" />, title: 'Old System Removal', desc: 'Safe removal and proper disposal of the existing system' },
              { icon: <CogIcon className="w-7 h-7" />, title: 'New System Design', desc: 'Tank, components and drain field per approved plans' },
              { icon: <DocumentTextIcon className="w-7 h-7" />, title: 'Permit Management', desc: 'Full Health Department permit process handled for you' },
              { icon: <WrenchScrewdriverIcon className="w-7 h-7" />, title: 'Complete Installation', desc: 'Professional installation following all Florida regulations' },
              { icon: <ClockIcon className="w-7 h-7" />, title: 'Private Inspections', desc: 'We coordinate inspections to avoid project delays' },
              { icon: <ShieldCheckIcon className="w-7 h-7" />, title: 'Final Certification', desc: 'System approved, certified and fully operational' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center text-center p-3 lg:p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300 group">
                <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-600 flex items-center justify-center mb-3 transition-colors duration-300 flex-shrink-0">
                  <div className="text-blue-600 group-hover:text-white transition-colors duration-300">{item.icon}</div>
                </div>
                <h3 className="font-black text-slate-800 text-[10px] lg:text-xs uppercase tracking-wide mb-1 leading-tight">{item.title}</h3>
                <p className="text-slate-500 text-[10px] lg:text-xs leading-relaxed hidden sm:block">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: WHEN + BEFORE/AFTER ── */}
      <div className="bg-slate-900 py-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* When do you need */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Know the signs</p>
              <h2 className="text-3xl font-black text-white mb-6 uppercase">When Do You Need a Full Replacement?</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                A septic system typically lasts 20–30 years. When it starts failing repeatedly, a replacement is often the most cost-effective long-term decision.
              </p>
              <ul className="space-y-3 mb-6">
                {whenReplace.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ArrowRightIcon className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="bg-slate-800 border-l-4 border-blue-400 rounded-r-xl p-5">
                <p className="text-blue-200 text-sm font-semibold">
                  In many cases we can start with a repair — but if the system can't be saved, we'll tell you upfront. We don't sell unnecessary work.
                </p>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl shadow-xl">
              <img src={imgIncl} alt="Old septic system needing replacement" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700 min-h-[300px]" />
            </div>
          </div>

          {/* Before / After */}
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3 text-center">Real Results</p>
          <h2 className="text-3xl font-black text-white mb-10 uppercase text-center">Before & After</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative overflow-hidden rounded-2xl shadow-lg">
              <img src={imgBefore} alt="Before septic replacement" className="w-full h-64 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-red-900/80 to-transparent flex items-end p-5">
                <div>
                  <span className="bg-red-500 text-white text-xs font-black uppercase px-3 py-1 rounded-full mb-2 inline-block">Before</span>
                  <p className="text-white text-sm font-medium">Old systems with repeated failures can cause health hazards and property damage</p>
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl shadow-lg">
              <img src={imgAfter} alt="After septic replacement" className="w-full h-64 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-green-900/80 to-transparent flex items-end p-5">
                <div>
                  <span className="bg-green-500 text-white text-xs font-black uppercase px-3 py-1 rounded-full mb-2 inline-block">After</span>
                  <p className="text-white text-sm font-medium">A new system ensures proper function, code compliance, and peace of mind for decades</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: OUR PROCESS ── */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3 text-center">Step by step</p>
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-12 uppercase text-center">Our Process</h2>

          {/* Desktop: horizontal con línea conectora */}
          <div className="hidden md:block relative">
            <div className="absolute top-[26px] left-[8%] right-[8%] h-0.5 bg-slate-200 z-0"></div>
            <div className="grid grid-cols-6 gap-4 relative z-10">
              {[
                { num: '1', icon: <MagnifyingGlassIcon className="w-9 h-9" />, title: 'Evaluation', desc: 'We assess the current system to determine what needs to be replaced.' },
                { num: '2', icon: <ClipboardDocumentCheckIcon className="w-9 h-9" />, title: 'Diagnosis', desc: 'We identify whether a partial repair or full replacement is right.' },
                { num: '3', icon: <DocumentTextIcon className="w-9 h-9" />, title: 'Permits', desc: 'We handle the entire Health Department permit process for you.' },
                { num: '4', icon: <TruckIcon className="w-9 h-9" />, title: 'Removal & Install', desc: 'Old system removed and new system installed per approved plans.' },
                { num: '5', icon: <ClockIcon className="w-9 h-9" />, title: 'Inspections', desc: 'We coordinate all required inspections, including private ones.' },
                { num: '6', icon: <ShieldCheckIcon className="w-9 h-9" />, title: 'Final Approval', desc: 'System approved, certified, and fully operational.' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-white font-black text-base flex items-center justify-center mb-5 shadow-md border-4 border-white">
                    {step.num}
                  </div>
                  <div className="text-blue-600 mb-4">{step.icon}</div>
                  <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide mb-2 leading-tight">{step.title}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical */}
          <div className="md:hidden space-y-6">
            {[
              { num: '1', icon: <MagnifyingGlassIcon className="w-7 h-7" />, title: 'Evaluation', desc: 'We assess the current system to determine what needs to be replaced.' },
              { num: '2', icon: <ClipboardDocumentCheckIcon className="w-7 h-7" />, title: 'Diagnosis', desc: 'We identify whether a partial repair or full replacement is right.' },
              { num: '3', icon: <DocumentTextIcon className="w-7 h-7" />, title: 'Permits', desc: 'We handle the entire Health Department permit process for you.' },
              { num: '4', icon: <TruckIcon className="w-7 h-7" />, title: 'Removal & Installation', desc: 'Old system removed and new system installed per approved plans.' },
              { num: '5', icon: <ClockIcon className="w-7 h-7" />, title: 'Inspections', desc: 'We coordinate all required inspections, including private ones.' },
              { num: '6', icon: <ShieldCheckIcon className="w-7 h-7" />, title: 'Final Approval', desc: 'System approved, certified, and fully operational.' },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-11 h-11 rounded-full bg-slate-800 text-white font-black text-sm flex items-center justify-center flex-shrink-0">{step.num}</div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-blue-600">{step.icon}</span>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{step.title}</h3>
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: WHY CHOOSE US ── */}
      <div className="bg-slate-900 py-16 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="overflow-hidden rounded-xl shadow-xl">
            <img src={imgProcess} alt="Zurcher Septic team working" className="w-full h-full object-cover min-h-[300px] hover:scale-105 transition-transform duration-700" />
          </div>
          <div>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3">Why Us</p>
            <h2 className="text-3xl font-black text-white mb-6 uppercase">Why Choose Zurcher Septic?</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              We work with durable, professionally selected materials for each installation — ensuring the system performs correctly and lasts for decades. Every project is handled following the proper standards from day one.
            </p>
            <ul className="space-y-3 mb-8">
              {whyUs.map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                  <span className="text-slate-200 text-sm">{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowQuoteModal(true)}
                className="flex items-center justify-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-6 py-3 rounded-lg text-sm transition-colors uppercase"
              >
                Get a Free Quote
              </button>
              <a
                href="tel:+19546368200"
                className="flex items-center justify-center gap-2 border border-slate-500 hover:border-blue-400 hover:text-blue-400 text-slate-200 font-bold px-6 py-3 rounded-lg text-sm transition-colors"
              >
                <PhoneIcon className="w-4 h-4" /> (954) 636-8200
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM CTA ── */}
      <div className="bg-blue-800 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Replace Your Septic System?</h2>
          <p className="text-blue-200 text-lg mb-8">
            Get a free, no-obligation evaluation. We'll tell you exactly what your system needs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold px-8 py-4 rounded-lg text-lg transition-colors"
            >
              REQUEST FREE QUOTE
            </button>
            <a
              href="tel:+19546368200"
              className="flex items-center justify-center gap-2 border-2 border-white hover:bg-white hover:text-blue-800 text-white font-bold px-8 py-4 rounded-lg text-lg transition-all duration-300"
            >
              <PhoneIcon className="w-5 h-5" />
              (954) 636-8200
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

export default SepticReplacementPage;

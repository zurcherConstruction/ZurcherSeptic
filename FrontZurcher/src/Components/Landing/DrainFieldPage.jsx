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
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  TruckIcon,
  BeakerIcon,
  UserIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const heroImg       = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_1600/v1777472871/chata2_nudqht.jpg';
const heroImgMobile = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777472931/chata2Celu_bbwl99.jpg';
const imgProcess    = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_900/v1777473994/Excavadora_jhbx6k.jpg';
const imgInstalled  = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777473408/tanqueinstalado_mpoqps.jpg';

const imgSign1 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_400/v1777473360/general_ydct7t.jpg';
const imgSign2 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_400/v1777473994/Excavadora_jhbx6k.jpg';
const imgSign3 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_400/v1777473408/tanqueinstalado_mpoqps.jpg';
const imgSign4 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_400/v1777472871/chata2_nudqht.jpg';
const imgSign5 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1766174828/works/68426718-a20c-428c-9e25-dbc5059fe703/materiales/owcaxzm36anxqowhoz4m.jpg';

const DrainFieldPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal]     = useState(false);

  const processSteps = [
    { num: '01', title: 'Evaluation', desc: 'We inspect the system to identify the cause of the problem.', icon: <UserIcon className="w-10 h-10" /> },
    { num: '02', title: 'Diagnosis', desc: 'We clearly explain what is happening and what the best solution is.', icon: <ChatBubbleLeftRightIcon className="w-10 h-10" /> },
    { num: '03', title: 'Permits', desc: 'We handle all the paperwork with the Health Department as required.', icon: <DocumentTextIcon className="w-10 h-10" /> },
    { num: '04', title: 'Repair or Replacement', desc: 'We carry out the work following the applicable standards and regulations.', icon: <TruckIcon className="w-10 h-10" /> },
    { num: '05', title: 'Verification', desc: 'We make sure the system works correctly before finishing.', icon: <CheckCircleIcon className="w-10 h-10" /> },
  ];

  const whoNeeds = [
    'Properties with aging or outdated systems',
    'Drainage or saturation problems in the yard',
    'Systems that failed a health department inspection',
    'Real estate transactions requiring a drainfield evaluation',
    'Systems that no longer function correctly',
  ];

  const whyUs = [
    "Precise diagnosis -- we don't guess",
    'Real solutions, not temporary fixes',
    'We handle all permits & inspections',
    'Fast, professional service',
    'Compliant with all Florida regulations',
    'Honest pricing, no surprises',
  ];

  const includedItems = [
    { icon: MagnifyingGlassIcon, label: 'Complete inspection and diagnosis of the drain field' },
    { icon: WrenchScrewdriverIcon, label: 'Repair of damaged or clogged lines' },
    { icon: TruckIcon, label: 'Replacement of the drain field when necessary' },
    { icon: BeakerIcon, label: 'Soil evaluation for new installations' },
    { icon: ClipboardDocumentCheckIcon, label: 'Permit management with the Health Department' },
    { icon: ShieldCheckIcon, label: 'Final inspection and certification' },
  ];

  const warningSigns = [
    { img: imgSign1, label: 'Slow drains throughout the house' },
    { img: imgSign2, label: 'Wet or flooded areas in the yard' },
    { img: imgSign3, label: 'Strong sewage odors' },
    { img: imgSign4, label: 'Sewage backing up to the property' },
    { img: imgSign5, label: 'Unusually green grass over the drain field' },
  ];

  return (
    <>
      <SEOHelmet
        title="Drainfield Inspection, Repair & Replacement Florida | Zurcher Septic"
        description="Expert drainfield inspection, repair, and replacement in Southwest Florida. Precise diagnosis and real long-term solutions. Licensed & insured. Fast service."
        keywords="drainfield repair Florida, drain field replacement, drainfield inspection, drain field problems, drainfield Fort Myers, Lehigh Acres drain field, septic drain field repair"
        canonicalUrl="https://www.zurcherseptic.com/services/drainfield"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      <div className="relative min-h-[80vh] flex items-center overflow-hidden">
        <img src={heroImg} alt="Drainfield repair and replacement Florida" className="absolute inset-0 w-full h-full object-cover object-center hidden md:block" />
        <img src={heroImgMobile} alt="Drainfield repair Florida" className="absolute inset-0 w-full h-full object-cover object-center block md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/75 to-slate-900/20"></div>
        <div className="relative z-10 w-full px-8 md:px-14 pt-28 md:pt-24 pb-14">
          <div className="max-w-xl">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Inspection, Repair & Replacement</p>
            <h1 className="text-4xl md:text-6xl xl:text-7xl font-black text-yellow-400 leading-none uppercase mb-1">DRAINFIELD</h1>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase mb-6">Installation & Repair in Florida</h2>
            <p className="text-slate-300 text-base leading-relaxed mb-3">
              <span className="font-bold text-yellow-400">Precise Diagnosis. Real Solutions.</span>
            </p>
            <p className="text-slate-300 text-base leading-relaxed mb-8">
              The drain field is one of the most critical parts of any septic system. When it fails, the consequences are immediate: odors, flooding, and health risks.
              We diagnose the problem correctly and deliver a real, lasting solution.
            </p>
            <div className="flex flex-wrap gap-4">
              <button onClick={() => setShowQuoteModal(true)} className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-7 py-3.5 rounded-lg text-sm transition-colors uppercase">
                <PhoneIcon className="w-4 h-4" /> Get a Free Quote
              </button>
              <a href="tel:+19546368200" className="flex items-center gap-2 border border-slate-500 hover:border-blue-400 hover:text-blue-400 text-slate-200 font-bold px-7 py-3.5 rounded-lg text-sm transition-colors uppercase">
                <PhoneIcon className="w-4 h-4" /> (954) 636-8200
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border-t border-slate-700 text-white py-5 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: <MagnifyingGlassIcon className="w-6 h-6" />, label: 'Precise Diagnosis' },
              { icon: <BoltIcon className="w-6 h-6" />, label: 'Real Solutions' },
              { icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, label: 'We Handle Permits' },
              { icon: <ClockIcon className="w-6 h-6" />, label: 'Fast & Professional' },
              { icon: <ShieldCheckIcon className="w-6 h-6" />, label: 'Florida Compliant' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-yellow-400 flex-shrink-0">{item.icon}</div>
                <div className="font-bold text-xs uppercase leading-tight text-slate-200 tracking-wide">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white py-14 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Title banner — dark strip like the flyer */}
          <div className="bg-slate-800 rounded-xl px-6 py-4 mb-8 text-center">
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-widest">
              What's Included in Our Service?
            </h2>
          </div>

          {/* 6 icon columns */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-10">
            {includedItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex flex-col items-center text-center gap-3 py-5 px-3 rounded-xl border border-slate-100 hover:border-yellow-300 hover:bg-yellow-50 transition-colors">
                  <Icon className="w-10 h-10 text-slate-700" />
                  <p className="text-slate-700 text-[11px] leading-snug font-semibold">{item.label}</p>
                </div>
              );
            })}
          </div>

          {/* Important (1/3) + Warning Signs (2/3) */}
          <div className="grid md:grid-cols-[1fr_2fr] gap-5 items-start">

            {/* Important box */}
            <div className="border-4 border-yellow-400 rounded-xl overflow-hidden">
              <div className="bg-yellow-400 flex items-center gap-3 px-5 py-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-slate-900 flex-shrink-0" />
                <h3 className="text-slate-900 font-black text-base uppercase tracking-widest">Important</h3>
              </div>
              <div className="bg-white px-5 py-5 space-y-4">
                <p className="text-slate-700 text-sm leading-relaxed">
                  In Florida, a drainfield <span className="font-bold">"repair"</span> usually means a <span className="font-bold">partial or total replacement</span>. When the field is saturated, replacing it is the only real, code-compliant solution.
                </p>
                <p className="text-slate-900 text-sm font-bold leading-relaxed">
                  Our approach is clear: diagnose correctly and offer real solutions, not temporary fixes.
                </p>
              </div>
            </div>

            {/* Warning Signs */}
            <div>
              <h3 className="text-slate-800 font-black text-2xl uppercase tracking-wide mb-4">Warning Signs</h3>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {warningSigns.map((sign, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div className="overflow-hidden rounded-lg aspect-square">
                      <img src={sign.img} alt={sign.label} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                    </div>
                    <p className="text-slate-600 text-[10px] leading-snug text-center font-medium">{sign.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 bg-amber-400 rounded-lg px-4 py-2.5">
                <ExclamationTriangleIcon className="w-5 h-5 text-slate-900 flex-shrink-0" />
                <p className="text-slate-900 text-xs font-semibold leading-snug">
                  If you notice any of these signs, it is important to act quickly to avoid bigger damage and higher costs.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-3 uppercase text-center tracking-widest">Our Process</h2>
          <p className="text-slate-400 text-center text-sm mb-12 max-w-2xl mx-auto">From inspection to completion, we follow a proven process to deliver quality results</p>

          {/* Responsive grid - mobile: 1 col, tablet: 2 cols, desktop: 5 cols */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-4">
            {processSteps.map((step, i) => (
              <div key={step.num} className="relative">
                {/* Step card */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 h-full flex flex-col items-center text-center">
                  {/* Icon */}
                  <div className="text-blue-400 mb-4">
                    {step.icon}
                  </div>
                  {/* Numbered circle */}
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                    <span className="text-white font-black text-2xl leading-none">{i + 1}</span>
                  </div>
                  <h3 className="text-white font-black text-sm uppercase tracking-wider mb-3">{step.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
                </div>
                
                {/* Arrow for desktop only - positioned between cards */}
                {i < processSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 translate-x-1/2 z-10">
                    <ArrowRightIcon className="w-5 h-5 text-blue-400" />
                  </div>
                )}

                {/* Mobile arrow - shown below card on mobile/tablet */}
                {i < processSteps.length - 1 && (
                  <div className="flex lg:hidden justify-center mt-4 mb-2">
                    <ArrowRightIcon className="w-6 h-6 text-blue-400 rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* WHO NEEDS THIS? */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
              <div className="p-8">
                <div className="flex items-start gap-6 mb-6">
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-wide">Who Needs This?</h2>
                  </div>
                  <div className="overflow-hidden rounded-lg flex-shrink-0 w-32 h-24 hidden sm:block">
                    <img src={imgSign2} alt="Who needs drainfield service" className="w-full h-full object-cover" />
                  </div>
                </div>
                <ul className="space-y-3">
                  {whoNeeds.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* WHY CHOOSE ZURCHER SEPTIC? */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
              <div className="p-8">
                <div className="flex items-start gap-6 mb-6">
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-wide">Why Choose Zurcher Septic?</h2>
                  </div>
                  <div className="overflow-hidden rounded-lg flex-shrink-0 w-32 h-24 hidden sm:block">
                    <img src={imgProcess} alt="Why choose us" className="w-full h-full object-cover" />
                  </div>
                </div>
                <ul className="space-y-3">
                  {whyUs.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircleIcon className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700 text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Sección de materiales de calidad */}
          <div className="mt-8 bg-slate-900 rounded-xl overflow-hidden">
            <div className="grid md:grid-cols-[auto_1fr_auto] gap-6 items-center p-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-yellow-400 flex items-center justify-center">
                  <ShieldCheckIcon className="w-10 h-10 text-slate-900" />
                </div>
              </div>
              <div>
                <p className="text-white text-sm leading-relaxed">
                  <span className="font-bold">We work with durable and correctly selected materials for each installation</span>, which ensures proper operation and the useful life of the system. Many drainfield problems are caused by inadequate materials or incorrect installations from the start – that's why we make each project following the appropriate standards from the beginning. <span className="font-bold text-yellow-400">We don't just repair – we solve the problem from the root.</span>
                </p>
              </div>
              <div className="overflow-hidden rounded-lg hidden lg:block">
                <img src={imgSign5} alt="Materiales de calidad" className="w-48 h-32 object-cover" />
              </div>
            </div>
          </div>

          {/* CTA dentro de esta sección */}
          <div className="mt-8 text-center">
            <button onClick={() => setShowQuoteModal(true)} className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-8 py-4 rounded-lg text-base transition-colors uppercase shadow-lg">
              Schedule a Free Evaluation
            </button>
          </div>
        </div>
      </div>



      <div className="bg-blue-800 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Start? Request Your Quote Now</h2>
          <p className="text-blue-200 text-lg mb-8">
            Don't wait until a small problem becomes a big one. We'll give you an honest diagnosis and a clear plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => setShowQuoteModal(true)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold px-8 py-4 rounded-lg text-lg transition-colors">
              REQUEST FREE QUOTE
            </button>
            <a href="tel:+19546368200" className="flex items-center justify-center gap-2 border-2 border-white hover:bg-white hover:text-blue-800 text-white font-bold px-8 py-4 rounded-lg text-lg transition-all duration-300">
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

export default DrainFieldPage;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
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
  StarIcon,
  ExclamationCircleIcon,
  HomeModernIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

// Hero desktop  ->  archivo original: chata.jpeg
const heroImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_1600/v1777472871/chata2_nudqht.jpg';
// Hero mobile   ->  archivo original: chata.jpeg (misma, podés subir version recortada)
const heroImgMobile = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777472931/chata2Celu_bbwl99.jpg';
// Seccion 1 - What's Included  ->  archivo original: general.jpeg
const img_incl = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_900/v1777473360/general_ydct7t.jpg';
// Seccion 2 - How it works  ->  archivo original: tanqueinstalado.jpeg
const img_how = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1777500154/regular_swvi7v.jpg';
// Seccion 3 - Process  ->  archivo original: Excavadora.jpeg
const img_proc = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_900/v1777473994/Excavadora_jhbx6k.jpg';
// Seccion 4 - Who needs it  ->  archivo original: atuPortada.jpeg
const img_who = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1775762044/works/284559a7-91c2-4eef-aee1-1e45f6ea72fa/sistema%20instalado/frbhyqqsgcleixad8fp9.jpg';
// Seccion 5 - Why choose us  ->  archivo original: chata2.jpeg
const img_why = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1770840090/works/1f45c03d-9b4e-4b60-9750-725cf03e5f77/sistema%20instalado/ukrcylhdequ0yqlqfuoz.jpg';

const ExcavatorIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
    {/* orugas */}
    <rect x="4" y="46" width="36" height="8" rx="4" />
    <circle cx="10" cy="50" r="3" />
    <circle cx="34" cy="50" r="3" />
    <line x1="10" y1="47" x2="34" y2="47" />
    <line x1="10" y1="53" x2="34" y2="53" />
    {/* cuerpo / cabina */}
    <rect x="6" y="32" width="26" height="14" rx="2" />
    <rect x="10" y="35" width="10" height="8" rx="1.5" />
    {/* plataforma giratoria */}
    <line x1="32" y1="38" x2="38" y2="38" />
    {/* boom (brazo principal) */}
    <line x1="32" y1="36" x2="52" y2="16" />
    {/* stick (antebrazo) */}
    <line x1="52" y1="16" x2="58" y2="28" />
    {/* balde */}
    <path d="M58 28 l4 6 -8 2 -2-6 z" />
  </svg>
);

const RegularInstallationPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const processSteps = [
    { num: '01', title: 'Initial Coordination', desc: 'If needed, we manage plans and soil studies at no extra cost.' },
    { num: '02', title: 'Permits', desc: 'We handle the full Health Department permit process.' },
    { num: '03', title: 'Installation', desc: 'Excavation and complete installation per approved plans.' },
    { num: '04', title: 'Inspections', desc: 'We coordinate all required inspections, including private ones.' },
    { num: '05', title: 'Final Approval', desc: 'System delivered, approved & fully operational.' },
  ];

  return (
    <>
      <SEOHelmet
        title="Conventional Septic System Installation Florida | Zurcher Septic"
        description="Licensed conventional septic system installation in Southwest Florida. Full permit management, professional installation, private inspections. No hidden costs."
        keywords="conventional septic installation Florida, septic system installation, septic permits Florida, septic installation Lehigh Acres, Fort Myers septic"
        canonicalUrl="https://www.zurcherseptic.com/services/regular-installation"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* HERO */}
      <div className="relative min-h-[80vh] flex items-center overflow-hidden">
        <img src={heroImg} alt="Conventional Septic System Installation Florida" className="absolute inset-0 w-full h-full object-cover object-center hidden md:block" />
        <img src={heroImgMobile} alt="Conventional Septic System Installation Florida" className="absolute inset-0 w-full h-full object-cover object-center block md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/75 to-slate-900/20"></div>
        <div className="relative z-10 w-full px-8 md:px-14 pt-28 md:pt-24 pb-14">
          <div className="max-w-xl">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Septic System Installation</p>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-black text-yellow-400 leading-none uppercase mb-1">CONVENTIONAL</h1>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase mb-6">Septic System in Florida</h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8">
              Reliable, code-compliant conventional septic installations adapted to your property's needs.
              We manage the full process — from permits to final approval — so you don't have to.
            </p>
            <div className="flex flex-wrap gap-4 mb-6">
              <button onClick={() => setShowQuoteModal(true)} className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-7 py-3.5 rounded-lg text-sm transition-colors uppercase">
                <PhoneIcon className="w-4 h-4" /> Get a Free Quote
              </button>
              <a href="tel:+19546368200" className="flex items-center gap-2 border border-slate-500 hover:border-blue-400 hover:text-blue-400 text-slate-200 font-bold px-7 py-3.5 rounded-lg text-sm transition-colors uppercase">
                <PhoneIcon className="w-4 h-4" /> Call Now (954) 636-8200
              </a>
            </div>
            <div className="flex md:hidden items-center gap-3 bg-slate-900/80 border border-yellow-400 rounded-xl px-4 py-3 w-fit">
              <ShieldCheckIcon className="text-yellow-400 w-7 h-7" />
              <div className="text-white text-xs"><span className="font-black">Licensed & Insured</span><span className="text-slate-300"> — CFC1433240</span></div>
            </div>
          </div>
        </div>
        <div className="hidden md:block absolute top-24 right-5 w-36 shadow-2xl">
          <div className="bg-slate-900/95 border border-yellow-400 rounded-2xl p-5 text-center backdrop-blur-sm">
            <ShieldCheckIcon className="text-yellow-400 w-12 h-12 mx-auto mb-3" />
            <div className="text-slate-300 text-[9px] font-bold uppercase leading-snug tracking-wide mb-2">Licensed<br />&amp; Insured</div>
            <div className="text-yellow-400 text-sm font-black uppercase tracking-widest mb-1">CFC</div>
            <div className="text-yellow-400 text-lg font-black leading-none">1433240</div>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="bg-slate-900 border-t border-slate-700 text-white py-5 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: <ShieldCheckIcon className="w-6 h-6" />, label: 'Licensed & Insured' },
              { icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, label: 'We Handle Permits' },
              { icon: <CheckCircleIcon className="w-6 h-6" />, label: 'No Hidden Costs' },
              { icon: <ClockIcon className="w-6 h-6" />, label: 'Fast Turnaround' },
              { icon: <WrenchScrewdriverIcon className="w-6 h-6" />, label: 'Full Installation' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-yellow-400 flex-shrink-0">{item.icon}</div>
                <div className="font-bold text-xs uppercase leading-tight text-slate-200 tracking-wide">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 1: WHAT'S INCLUDED */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">

            {/* Col 1 — Título + Checklist */}
            <div className="flex flex-col">
              <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-8 uppercase">What's Included?</h2>
              <ul className="space-y-5">
                {[
                  'Coordination with engineers & soil studies (if needed)',
                  'Permit management with the Health Department',
                  'System design and tank sizing per approved plans',
                  'Complete excavation and installation',
                  'Private inspections to speed up timelines',
                  'Final inspection and certification',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-slate-900" />
                    </span>
                    <span className="text-slate-700 text-sm leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2 — Photo */}
            <div className="overflow-hidden rounded-xl shadow-lg min-h-[360px]">
              <img src={img_incl} alt="Septic drain field installation" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>

            {/* Col 3 — Important box */}
            <div className="border-2 border-yellow-400 rounded-xl overflow-hidden flex flex-col">
              {/* header amarillo */}
              <div className="bg-yellow-400 flex flex-col items-center justify-center py-5 px-4">
                <ExclamationCircleIcon className="w-8 h-8 text-slate-900 mb-2" />
                <h3 className="text-slate-900 font-black text-base uppercase tracking-widest">Important</h3>
              </div>
              {/* body con bg suave */}
              <div className="bg-yellow-50 flex flex-col flex-1 divide-y divide-yellow-200">
                <p className="text-slate-700 text-sm leading-relaxed text-center px-6 py-5">
                  If you already have approved plans or design, we can start directly with the installation.
                </p>
                <p className="text-slate-700 text-sm leading-relaxed text-center px-6 py-5">
                  If you don't have them yet, we help you coordinate the entire process at no additional cost.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* SECTION 2: HOW THE SYSTEM WORKS */}
      <div className="bg-slate-900 py-16 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Desktop: texto izquierda / imagen derecha */}
          <div className="flex flex-col md:flex-row gap-10 items-start">

            {/* Texto */}
            <div className="md:w-[38%] flex-shrink-0">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-5 uppercase leading-tight">How Does the System Work?</h2>
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                The septic system receives wastewater from the property into a tank where solids settle and begin to decompose naturally.
              </p>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                Then, the liquid flows to the drain field, where the soil filters it before returning it to the environment.
              </p>
              {/* nota al pie */}
              <div className="flex items-start gap-3 bg-slate-800 border border-slate-700 rounded-xl p-4">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center mt-0.5">
                  <CheckCircleIcon className="w-4 h-4 text-slate-900" />
                </span>
                <p className="text-slate-300 text-sm leading-relaxed">
                  A properly installed system prevents future problems, unnecessary costs, and construction delays.
                </p>
              </div>
            </div>

            {/* Imagen completa sin recortar */}
            <div className="md:flex-1 w-full">
              <img
                src={img_how}
                alt="How a conventional septic system works"
                className="w-full h-auto rounded-xl shadow-xl object-contain"
              />
            </div>

          </div>
        </div>
      </div>

      {/* SECTION 3: INSTALLATION PROCESS */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-12 uppercase text-center">Our Installation Process</h2>

          {/* Desktop: horizontal con línea conectora */}
          <div className="hidden md:block relative">
            {/* línea entre círculos */}
            <div className="absolute top-[26px] left-[10%] right-[10%] h-0.5 bg-slate-200 z-0"></div>
            <div className="grid grid-cols-5 gap-6 relative z-10">
              {[
                { num: '1', icon: <UserGroupIcon className="w-12 h-12" />, title: 'Initial\nCoordination', desc: 'If needed, we manage plans and soil studies at no extra cost.' },
                { num: '2', icon: <ClipboardDocumentCheckIcon className="w-12 h-12" />, title: 'Permits', desc: 'We handle the full Health Department permit process.' },
                { num: '3', icon: <ExcavatorIcon className="w-12 h-12" />, title: 'Installation', desc: 'Excavation and complete installation per approved plans.' },
                { num: '4', icon: <MagnifyingGlassIcon className="w-12 h-12" />, title: 'Inspections', desc: 'We coordinate all required inspections, including private ones.' },
                { num: '5', icon: <ShieldCheckIcon className="w-12 h-12" />, title: 'Final\nApproval', desc: 'System delivered, approved & fully operational.' },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  {/* círculo número */}
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-white font-black text-base flex items-center justify-center mb-5 shadow-md border-4 border-white">
                    {step.num}
                  </div>
                  {/* icono */}
                  <div className="text-slate-700 mb-4">{step.icon}</div>
                  {/* título — whitespace-pre-line para que \n funcione */}
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide mb-2 leading-tight whitespace-pre-line">{step.title}</h3>
                  {/* descripción */}
                  <p className="text-slate-600 text-sm font-medium leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical */}
          <div className="md:hidden space-y-6">
            {[
              { num: '1', icon: <UserGroupIcon className="w-8 h-8" />, title: 'Initial Coordination', desc: 'If needed, we manage plans and soil studies at no extra cost.' },
              { num: '2', icon: <ClipboardDocumentCheckIcon className="w-8 h-8" />, title: 'Permits', desc: 'We handle the full Health Department permit process.' },
              { num: '3', icon: <ExcavatorIcon className="w-8 h-8" />, title: 'Installation', desc: 'Excavation and complete installation per approved plans.' },
              { num: '4', icon: <MagnifyingGlassIcon className="w-8 h-8" />, title: 'Inspections', desc: 'We coordinate all required inspections, including private ones.' },
              { num: '5', icon: <ShieldCheckIcon className="w-8 h-8" />, title: 'Final Approval', desc: 'System delivered, approved & fully operational.' },
            ].map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-11 h-11 rounded-full bg-slate-800 text-white font-black text-sm flex items-center justify-center flex-shrink-0">{step.num}</div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-slate-700">{step.icon}</span>
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">{step.title}</h3>
                  </div>
                  <p className="text-slate-600 text-sm font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 4: WHO NEEDS IT */}
      <div className="bg-slate-900 py-16 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 items-start">

          {/* Texto + checklist */}
          <div className="md:w-[40%] flex-shrink-0">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-8 uppercase leading-tight">Who Needs This?</h2>
            <ul className="space-y-5">
              {[
                'New constructions without sewer access',
                'Properties without municipal sewer connection',
                'Old or damaged septic systems',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                    <CheckCircleIcon className="w-3.5 h-3.5 text-slate-900" />
                  </span>
                  <span className="text-slate-200 text-sm font-medium leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2 fotos lado a lado */}
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div className="overflow-hidden rounded-xl shadow-lg h-56 md:h-72">
              <img src={img_who} alt="New construction septic" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
            <div className="overflow-hidden rounded-xl shadow-lg h-56 md:h-72">
              <img src={img_why} alt="Septic tank installation" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 5: WHY CHOOSE US */}
      <div className="bg-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">

            {/* Col 1 — Checklist */}
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800 mb-7 uppercase leading-tight">Why Choose Zurcher Septic?</h2>
              <ul className="space-y-3">
                {[
                  'Licensed & insured (CFC1433240)',
                  'Fast turnaround times',
                  'No hidden costs or unexpected changes',
                  'We coordinate the entire process for you',
                  'Experience with builders & engineers',
                  'Clear communication throughout the project',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-yellow-400 flex items-center justify-center">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-slate-900" />
                    </span>
                    <span className="text-slate-700 text-sm font-medium leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 2 — Badge hexagonal */}
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative flex items-center justify-center">
                {/* hexágono SVG de fondo */}
                <svg viewBox="0 0 120 138" className="w-44 h-44 text-blue-900" fill="currentColor">
                  <polygon points="60,4 116,34 116,104 60,134 4,104 4,34" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
                  <ShieldCheckIcon className="w-8 h-8 text-yellow-400 mb-1" />
                  <span className="text-white font-black text-sm uppercase leading-tight">Licensed<br />&amp; Insured</span>
                </div>
              </div>
              <div className="mt-3 text-slate-800 font-black text-base tracking-widest">CFC1433240</div>
            </div>

            {/* Col 3 — Our Commitment */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h3 className="font-black text-slate-800 text-base uppercase tracking-wide mb-4">Our Commitment</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                We don't cut corners. We use quality materials and follow the correct procedures to ensure a durable, reliable system.
              </p>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-slate-600 text-sm leading-relaxed">
                  A properly installed septic system doesn't just avoid problems — it protects your investment long-term.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div className="bg-blue-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-yellow-400 text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">Ready to Start?</div>
          <h2 className="text-4xl md:text-5xl font-black uppercase mb-4 leading-tight">GET YOUR FREE<br />QUOTE TODAY</h2>
          <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto">Contact us now — we'll evaluate your property and provide a complete, no-obligation quote.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => setShowQuoteModal(true)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-10 py-5 rounded-xl text-lg transition-colors uppercase">
              Schedule Free Quote
            </button>
            <a href="tel:+19546368200" className="flex items-center justify-center gap-3 bg-white/10 border-2 border-white hover:bg-white hover:text-blue-700 text-white font-bold px-10 py-5 rounded-xl text-lg transition-all duration-300">
              <PhoneIcon className="w-5 h-5" /> (954) 636-8200
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-blue-200 text-sm"><StarIcon className="text-yellow-400 w-4 h-4" /> Licensed CFC1433240</div>
            <div className="flex items-center gap-2 text-blue-200 text-sm"><CheckCircleIcon className="text-yellow-400 w-4 h-4" /> No Hidden Costs</div>
            <div className="flex items-center gap-2 text-blue-200 text-sm"><ShieldCheckIcon className="text-yellow-400 w-4 h-4" /> Fully Insured</div>
          </div>
        </div>
      </div>

      <LoginPopup isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <FloatingQuoteButton onClick={() => setShowQuoteModal(true)} />
      <ScheduleQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
    </>
  );
};

export default RegularInstallationPage;

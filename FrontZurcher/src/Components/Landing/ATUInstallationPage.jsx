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
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// IMÁGENES — Cloudinary
// Base URL: https://res.cloudinary.com/TU_CLOUD_NAME/image/upload/f_auto,q_auto/
// Reemplazá TU_CLOUD_NAME por tu cuenta y el nombre del archivo por el public_id
// que te asigna Cloudinary al subir cada imagen. when is an
// ─────────────────────────────────────────────────────────────────────────────

// Hero desktop  →  archivo original: chata2.jpeg
const atuPortadaImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_1600/v1777472871/chata2_nudqht.jpg';

// Hero mobile   →  archivo original: chata2Celu.jpeg
const atuPortadaCeluImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777472931/chata2Celu_bbwl99.jpg';

// Sección 1 — ¿Qué es un ATU?  →  archivo original: atu.jpeg
const atuSystemImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1777491666/atu1_ey1jon.png';

// Sección 2 — How it works  →  archivo original: howitswork.jpeg
const howItWorksImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1777492908/howitworks_zxiupq.png';

// Sección 3 — When required  →  archivo original: atu.jpeg (misma que atuSystemImg)
const atuImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777473360/general_ydct7t.jpg';
//https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777473360/general_ydct7t.jpg
// Sección 4 — Qué incluye  →  archivo original: servicios.png
const queIncluyeImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_1200/v1777473242/servicios_vyew3h.png';

// Sección 5 — ATU vs Conventional  →  archivo original: AtuVsRegular.jpeg
const atuVsImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1777492988/vs_etlkxb.png';

// Fotos proceso de instalación (fila de 3 fotos en Sección 6)
// photo1  →  archivo original: general.jpeg
const photo3 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1774382867/works/a431a726-11a0-4b91-9953-fdec5fc7d331/sistema%20instalado/a1oz3pqgmirtaqixcoyr.jpg';
// photo2  →  archivo original: tanqueinstalado.jpeg
const photo2 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777473408/tanqueinstalado_mpoqps.jpg';
// photo3  →  archivo original: Excavadora.jpeg
const photo1 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_800/v1777473994/Excavadora_jhbx6k.jpg';

// Sección 7 — Why Choose Us  →  archivo original: atuPortada.jpeg
const photo4 = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_900/v1777473709/atuPortada_bz1aax.jpg';



const ATUInstallationPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const processSteps = [
    { num: '01', title: 'Initial Review', desc: 'We evaluate your project and existing plans.' },
    { num: '02', title: 'Coordination', desc: 'We help manage plans and soil studies if needed.' },
    { num: '03', title: 'Permits', desc: 'Full Health Department permit management.' },
    { num: '04', title: 'Installation', desc: 'Complete ATU system installation per approved plans.' },
    { num: '05', title: 'Inspections', desc: 'We coordinate all required inspections.' },
    { num: '06', title: 'Final Approval', desc: 'System delivered, approved & operational.' },
  ];

  return (
    <>
      <SEOHelmet
        title="ATU Aerobic Septic System Installation Florida | Zurcher Septic"
        description="Professional ATU aerobic treatment unit installation in Florida. Licensed & insured. Maintenance included for 2 years. Permit management, full installation, final approval. Serving Southwest Florida."
        keywords="ATU septic system Florida, aerobic treatment unit installation, ATU system Fort Myers, septic aerobic system Lehigh Acres"
        canonicalUrl="https://www.zurcherseptic.com/services/atu-installation"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* ── HERO ── full-width image, text on the left with gradient overlay ── */}
      <div className="relative min-h-[80vh] flex items-center overflow-hidden">

        {/* desktop image */}
        <img
          src={atuPortadaImg}
          alt="ATU Septic System Installation Florida"
          className="absolute inset-0 w-full h-full object-cover object-center hidden md:block"
        />
        {/* mobile image */}
        <img
          src={atuPortadaCeluImg}
          alt="ATU Septic System Installation Florida"
          className="absolute inset-0 w-full h-full object-cover object-center block md:hidden"
        />

        {/* gradient: más oscuro a la izquierda para que el texto sea bien legible */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/75 to-slate-900/20"></div>

        {/* text content — left aligned */}
        <div className="relative z-10 w-full px-8 md:px-14 pt-28 md:pt-24 pb-14">
          <div className="max-w-xl">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">ATU System Installation</p>
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-black text-yellow-400 leading-none uppercase mb-1">ATU SYSTEMS</h1>
            <h2 className="text-2xl md:text-3xl font-black text-white uppercase mb-6">in Florida</h2>
            <p className="text-slate-300 text-base leading-relaxed mb-8">
              Reliable, approved ATU system installations adapted to your property's requirements.
              We handle the entire process to ensure an efficient, safe solution that complies with Florida regulations.
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
                <PhoneIcon className="w-4 h-4" /> Call Now (954) 636-8200
              </a>
            </div>

            {/* Badge mobile — inline, debajo de botones */}
            <div className="flex md:hidden items-center gap-3 bg-slate-900/80 border border-yellow-400 rounded-xl px-4 py-3 w-fit">
              <div className="relative">
                <ShieldCheckIcon className="text-yellow-400 w-7 h-7" />
              </div>
              <div className="text-white text-xs">
                <span className="font-black">2-Year</span>
                <span className="text-slate-300"> maintenance included</span>
              </div>
            </div>
          </div>
        </div>

        {/* Badge desktop — top right, oculto en mobile */}
        <div className="hidden md:block absolute top-24 right-5 w-36 shadow-2xl">
          <div className="bg-slate-900/95 border border-yellow-400 rounded-2xl p-5 text-center backdrop-blur-sm">
            {/* Icono shield + check superpuesto */}
            <div className="relative inline-flex items-center justify-center mb-3">
              <ShieldCheckIcon className="text-yellow-400 w-12 h-12" />
            </div>
            <div className="text-slate-300 text-[9px] font-bold uppercase leading-snug tracking-wide mb-2">
              Maintenance<br />Included for
            </div>
            <div className="text-yellow-400 text-5xl font-black leading-none">2</div>
            <div className="text-yellow-400 text-xs font-black uppercase tracking-widest mb-3">Years</div>
            <div className="border-t border-slate-700 pt-3">
              <div className="text-slate-400 text-[9px] leading-snug">
                Visits every<br /><span className="text-white font-bold">6 months</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── dark, like the flyer ── */}
      <div className="bg-slate-900 border-t border-slate-700 text-white py-5 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { icon: <ShieldCheckIcon className="w-6 h-6" />, label: 'Licensed & Insured' },
              { icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, label: 'ATU System Experts' },
              { icon: <CheckCircleIcon className="w-6 h-6" />, label: 'Approved Installations' },
              { icon: <ClockIcon className="w-6 h-6" />, label: 'Fast & On-Time Process' },
              { icon: <WrenchScrewdriverIcon className="w-6 h-6" />, label: 'We Handle Everything' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="text-yellow-400 text-2xl flex-shrink-0">{item.icon}</div>
                <div className="font-bold text-xs uppercase leading-tight text-slate-200 tracking-wide">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 1: WHAT IS AN ATU? ── text left / image right ── */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">The Technology</p>
            <h2 className="text-3xl font-bold text-slate-800 mb-6">WHAT IS AN ATU SYSTEM?</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              ATU stands for <strong>Aerobic Treatment Unit</strong>. It is a septic system that uses
              oxygen to treat wastewater more efficiently than a conventional system.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              Through this process, the system achieves a higher level of treatment before final
              disposal — making it ideal for properties with limitations or special requirements.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-xl p-5">
              <p className="text-blue-800 text-sm font-semibold">
                ATU systems are designed for properties where a conventional system is not viable due
                to lot size, soil conditions, or county requirements.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center bg-slate-50 rounded-3xl p-8 shadow-xl">
            <img src={atuSystemImg} alt="ATU septic system unit" className="max-h-[420px] w-auto object-contain" />
          </div>
        </div>
      </div>

      {/* ── SECTION 2: HOW IT WORKS ── image top / steps below ── */}
      <div className="bg-slate-900 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-3 text-center">The Process</p>
          <h2 className="text-4xl font-black text-white mb-10 uppercase leading-tight text-center">How Does an ATU System Work?</h2>

          {/* image — full width, no crop */}
          <div className="bg-white rounded-2xl shadow-2xl p-1 mb-12">
            <img src={howItWorksImg} alt="How ATU system works" className="w-full h-auto object-contain" />
          </div>

          {/* 4 steps in a row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { title: 'Wastewater Enters', desc: 'Property wastewater flows into the pre-treatment tank.' },
              { title: 'Aeration Process', desc: 'Air pumps inject oxygen, activating aerobic bacteria that break down waste.' },
              { title: 'Advanced Treatment', desc: 'Water achieves higher purification than any conventional system.' },
              { title: 'Safe Discharge', desc: 'Treated water is discharged according to the approved engineered design.' },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-400 text-slate-900 flex items-center justify-center font-black text-sm flex-shrink-0">
                  0{i + 1}
                </div>
                <div>
                  <div className="font-bold text-white text-sm mb-1">{step.title}</div>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 3: WHEN IS IT REQUIRED? ── text left / image right ── */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Is This For You?</p>
            <h2 className="text-4xl font-black text-slate-800 mb-6 uppercase leading-tight">When is an<br />ATU Required?</h2>
            <p className="text-slate-600 leading-relaxed mb-6">An ATU is typically required when a conventional system simply isn't an option:</p>
            <ul className="space-y-4">
              {[
                "The Health Department rejected a conventional system design",
                "Small lot that doesn't meet setback requirements",
                "Poor soil percolation or high water table",
                "Specific county regulations for the area",
                "Replacing an old or failed system in a restricted zone",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5 w-5 h-5" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-xl h-80 md:h-[460px]">
            <img src={atuImg} alt="ATU system installation site" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        </div>
      </div>

      {/* ── SECTION 4: WHAT'S INCLUDED ── infographic + checklist ── */}
      <div className="bg-slate-900 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3">Complete Package</p>
            <h2 className="text-4xl font-black text-white uppercase">What's Included<br />in Our Service?</h2>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-2xl mb-10">
            <img src={queIncluyeImg} alt="What our ATU service includes" className="w-full h-auto object-contain" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Initial project coordination',
              'Engineer plans & soil study support',
              'Full permit management — Health Dept.',
              'ATU system equipment and installation',
              'All connections per approved design',
              'Private & official inspections',
              'Final certification & system approval',
              '2-year maintenance plan (visits every 6 months)',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-800 rounded-xl p-4">
                <CheckCircleIcon className="text-yellow-400 flex-shrink-0 mt-0.5 w-5 h-5" />
                <span className="text-slate-200 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 5: ATU vs CONVENTIONAL ── */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Side by Side</p>
            <h2 className="text-4xl font-black text-slate-800 uppercase">ATU vs Conventional<br />System</h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-4"></div>
          </div>
          <div className="mb-8">
            <img src={atuVsImg} alt="ATU vs Conventional Septic" className="w-full h-auto object-contain rounded-2xl shadow-xl" />
          </div>
          <div className="bg-blue-900 text-white rounded-2xl p-6 text-center">
            <p className="text-blue-200 text-sm max-w-3xl mx-auto">
              That's why every ATU we install includes a <strong className="text-yellow-400">2-year maintenance plan</strong> — visits every 6 months to keep the system compliant and running perfectly.
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 6: INSTALLATION PROCESS ── horizontal timeline ── */}
      <div className="bg-slate-900 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">Step by Step</p>
            <h2 className="text-4xl font-black text-white uppercase">Our Installation Process</h2>
          </div>
          {/* Desktop horizontal timeline */}
          <div className="hidden md:block relative">
            <div className="absolute top-6 left-[8.33%] right-[8.33%] h-0.5 bg-blue-600/60"></div>
            <div className="grid grid-cols-6 gap-2">
              {processSteps.map((step, i) => (
                <div key={i} className="flex flex-col items-center text-center relative z-10">
                  <div className="w-12 h-12 rounded-full bg-yellow-400 text-slate-900 font-black text-sm flex items-center justify-center mb-3 shadow-lg">
                    {step.num}
                  </div>
                  <h3 className="text-xs font-black text-blue-300 uppercase tracking-wide mb-2 leading-tight">{step.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Mobile vertical */}
          <div className="md:hidden space-y-6">
            {processSteps.map((step, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-11 h-11 rounded-full bg-yellow-400 text-slate-900 font-black text-sm flex items-center justify-center flex-shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-black text-blue-300 text-sm uppercase tracking-wide mb-1">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Real photos row */}
          <div className="grid grid-cols-3 gap-4 mt-14">
            {[photo1, photo2, photo3].map((ph, i) => (
              <div key={i} className="overflow-hidden rounded-xl h-52 md:h-72">
                <img src={ph} alt={`Installation photo ${i + 1}`} className="w-full h-full object-cover object-center hover:scale-105 transition-transform duration-700" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 7: WHY CHOOSE US ── */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="overflow-hidden rounded-2xl shadow-2xl h-72 md:h-[420px]">
            <img src={photo4} alt="Zurcher Septic professionals" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Our Advantage</p>
            <h2 className="text-4xl font-black text-slate-800 mb-8 uppercase leading-tight">Why Choose<br />Zurcher Septic?</h2>
            <div className="space-y-3">
              {[
                'Licensed & insured — CFC1433240',
                'Specialists in ATU systems across Florida',
                'We handle permits, plans & installation',
                '2-year maintenance plan included',
                'No hidden costs or surprise charges',
                'Fast turnaround — avg. 6–8 weeks',
                'Clear communication every step of the way',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <CheckCircleIcon className="text-blue-600 flex-shrink-0 mt-0.5 w-5 h-5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div className="bg-blue-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-yellow-400 text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            Ready to Start?
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase mb-4 leading-tight">GET YOUR FREE<br />ATU QUOTE TODAY</h2>
          <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto">
            Contact us now — we'll evaluate your property and provide a complete, no-obligation quote.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-10 py-5 rounded-xl text-lg transition-colors uppercase"
            >
              Schedule Free Quote
            </button>
            <a
              href="tel:+19546368200"
              className="flex items-center justify-center gap-3 bg-white/10 border-2 border-white hover:bg-white hover:text-blue-700 text-white font-bold px-10 py-5 rounded-xl text-lg transition-all duration-300"
            >
              <PhoneIcon className="w-5 h-5" /> (954) 636-8200
            </a>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-10">
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <StarIcon className="text-yellow-400 w-4 h-4" /> Licensed CFC1433240
            </div>
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <CheckCircleIcon className="text-yellow-400 w-4 h-4" /> 2-Year Maintenance Included
            </div>
            <div className="flex items-center gap-2 text-blue-200 text-sm">
              <ShieldCheckIcon className="text-yellow-400 w-4 h-4" /> Fully Insured
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

export default ATUInstallationPage;

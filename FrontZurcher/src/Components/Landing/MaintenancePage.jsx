import React, { useState } from 'react';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';
import { OPEN_CHAT_EVENT } from './ZurcherChatWidget';
import {
  PhoneIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  BellAlertIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  ChevronDownIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

// ─────────────────────────────────────────────────────────────────────────────
// Página de mantenimiento ATU
// Precio: $490 por año (2 visitas, una cada 6 meses) para Lehigh Acres y zonas cercanas.
// No incluye el fee de renovación del operating permit del Health Department
// ($100–$200 según el county; Lee County $175), que el dueño paga aparte.
// Si cambia el precio, actualizar también: MaintenanceServices.jsx, ServicesSection.jsx,
// BackZurcher services/maintenanceRenewals.js, services/ai/publicBot.js y aiController.js.
// ─────────────────────────────────────────────────────────────────────────────

const PRICE = 490;
const PHONE_LABEL = '(954) 636-8200';
const PHONE_HREF = 'tel:+19546368200';

// Imágenes reutilizadas de la página de ATU (Cloudinary)
const heroImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/f_auto,q_auto,w_1600/v1777473709/atuPortada_bz1aax.jpg';
const atuUnitImg = 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1777491666/atu1_ey1jon.png';

const PLAN_INCLUDES = [
  '2 service visits per year — one every 6 months',
  'Full inspection of your ATU on every visit',
  'Visit records kept on file for your system',
  'Renewal reminder before your contract expires',
  'Keeps you compliant with the Florida Department of Health',
];

const NOT_INCLUDED = [
  {
    title: 'Health Department permit renewal fee',
    desc: 'Paid by the owner directly to the county. It usually runs between $100 and $200 depending on the county — for example, Lee County charges $175.',
  },
  {
    title: 'Pumping, parts and repairs',
    desc: 'If a visit finds something that needs fixing, we explain it and send you a quote before doing any work.',
  },
];

const VISIT_CHECKS = [
  { title: 'Aerator & air flow', desc: 'We check that the aerator runs and delivers the air the bacteria need.' },
  { title: 'Control panel & alarm', desc: 'Panel, breakers and alarm tested so you know when something is wrong.' },
  { title: 'Chlorinator', desc: 'Chlorine level checked and tablets refilled when the system uses them.' },
  { title: 'Filters & components', desc: 'Filters cleaned and components inspected for wear or damage.' },
  { title: 'Tank levels', desc: 'Sludge and water levels checked to tell you when pumping is due.' },
  { title: 'Effluent & drain area', desc: 'Visual check of the treated water and the disposal area.' },
];

const WHO_FOR = [
  {
    icon: <ShieldCheckIcon className="w-8 h-8" />,
    title: 'ATU installed by Zurcher',
    desc: 'Your first 2 years of maintenance come with the installation. After that, renew with us and keep the same team.',
  },
  {
    icon: <WrenchScrewdriverIcon className="w-8 h-8" />,
    title: 'ATU installed by another company',
    desc: 'We take over the maintenance of ATUs installed by others. We start with a first visit to see how the system is doing.',
  },
  {
    icon: <ExclamationTriangleIcon className="w-8 h-8" />,
    title: 'Contract expired or missing',
    desc: 'Bought a home with an ATU, or let your contract lapse? Contact us — we help you get covered again as soon as possible.',
  },
];

const STEPS = [
  { title: 'Contact us', desc: 'Call, message us or request it online. Tell us your address and your ATU brand if you know it.' },
  { title: 'Sign your contract', desc: 'We send you the contract and the payment link. You can pay online.' },
  { title: 'We visit every 6 months', desc: 'Our team contacts you to schedule each visit and inspects the whole system.' },
  { title: 'We remind you to renew', desc: 'Before your contract ends we send you the renewal, so you are never out of compliance.' },
];

const FAQS = [
  {
    q: 'Is an ATU maintenance contract really required?',
    a: 'Yes. In Florida, every aerobic treatment unit (ATU) must be covered by a maintenance contract at all times, and the contract must be renewed before it expires. Without it the owner can have problems with the Health Department.',
  },
  {
    q: `What does the $${PRICE} include?`,
    a: `One year of maintenance with 2 service visits (one every 6 months), with a full inspection of the system on each visit. It is the price for Lehigh Acres and nearby areas.`,
  },
  {
    q: 'Is the Health Department fee included?',
    a: 'No. The operating permit renewal fee is paid by the owner directly to the county. It is usually between $100 and $200 depending on the county — Lee County, for example, charges $175.',
  },
  {
    q: 'I live farther away. Can you still service my ATU?',
    a: 'Contact us with your address. For locations outside Lehigh Acres and nearby areas, the price depends on the distance and our team confirms it with you.',
  },
  {
    q: 'My ATU was installed by another company. Can I switch to you?',
    a: 'Yes. We maintain ATUs installed by other companies. We will review your system on the first visit and let you know if anything needs attention.',
  },
  {
    q: 'What happens if the visit finds a problem?',
    a: 'We explain what we found and send you a written quote before doing any repair. Parts, repairs and pumping are not part of the yearly plan.',
  },
  {
    q: 'Do you offer 24/7 emergency service?',
    a: 'No. Visits and repairs are scheduled appointments. If you have an urgent problem, call us and we will schedule the earliest available visit.',
  },
];

const openChat = (message) => {
  window.dispatchEvent(new CustomEvent(OPEN_CHAT_EVENT, { detail: { message } }));
};

const MaintenancePage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <>
      <SEOHelmet
        title="ATU Maintenance Contracts Florida | $490/Year | Zurcher Septic"
        description={`ATU maintenance contracts in Lehigh Acres and nearby areas: $${PRICE} per year with 2 service visits (one every 6 months), as required by the Florida Department of Health. Licensed & insured.`}
        keywords="ATU maintenance Florida, ATU maintenance contract, aerobic treatment unit maintenance, ATU service Lehigh Acres, septic maintenance Fort Myers, Lee County ATU permit renewal"
        canonicalUrl="https://www.zurcherseptic.com/maintenance-services"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* ── HERO ── */}
      <div className="relative min-h-[75vh] flex items-center overflow-hidden">
        <img src={heroImg} alt="ATU maintenance service in Florida" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-slate-900/30"></div>

        <div className="relative z-10 w-full px-6 md:px-14 pt-28 md:pt-24 pb-14">
          <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_auto] gap-10 items-center">
            <div className="max-w-xl">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">ATU Maintenance Contracts</p>
              <h1 className="text-5xl md:text-6xl font-black text-yellow-400 leading-none uppercase mb-1">Keep Your ATU</h1>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase mb-6">Running & Compliant</h2>
              <p className="text-slate-300 text-base leading-relaxed mb-8">
                Florida requires every ATU to have an active maintenance contract. We visit your system every
                6 months, check every component and remind you before it's time to renew.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowQuoteModal(true)}
                  className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-7 py-3.5 rounded-lg text-sm transition-colors uppercase"
                >
                  <CalendarDaysIcon className="w-4 h-4" /> Start or Renew My Contract
                </button>
                <a
                  href={PHONE_HREF}
                  className="flex items-center gap-2 border border-slate-500 hover:border-blue-400 hover:text-blue-400 text-slate-200 font-bold px-7 py-3.5 rounded-lg text-sm transition-colors uppercase"
                >
                  <PhoneIcon className="w-4 h-4" /> {PHONE_LABEL}
                </a>
              </div>
            </div>

            {/* Price badge */}
            <div className="bg-slate-900/90 border border-yellow-400 rounded-2xl p-6 text-center backdrop-blur-sm w-full sm:w-64 shadow-2xl">
              <ShieldCheckIcon className="text-yellow-400 w-10 h-10 mx-auto mb-2" />
              <div className="text-slate-300 text-[10px] font-bold uppercase tracking-widest mb-1">Yearly plan</div>
              <div className="text-yellow-400 text-5xl font-black leading-none">${PRICE}</div>
              <div className="text-white text-xs font-bold uppercase tracking-widest mt-1 mb-3">per year</div>
              <div className="border-t border-slate-700 pt-3 text-slate-300 text-xs leading-relaxed">
                <span className="text-white font-bold">2 visits</span> · one every 6 months<br />
                Lehigh Acres & nearby areas
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div className="bg-slate-900 border-t border-slate-700 text-white py-5 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: <ShieldCheckIcon className="w-6 h-6" />, label: 'Licensed & Insured — CFC1433240' },
            { icon: <ClipboardDocumentCheckIcon className="w-6 h-6" />, label: 'Health Department Compliant' },
            { icon: <CalendarDaysIcon className="w-6 h-6" />, label: 'Visits Every 6 Months' },
            { icon: <BellAlertIcon className="w-6 h-6" />, label: 'Renewal Reminders' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="text-yellow-400 flex-shrink-0">{item.icon}</div>
              <div className="font-bold text-xs uppercase leading-tight text-slate-200 tracking-wide">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── WHY IT'S REQUIRED ── */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Required by Law</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-6 uppercase leading-tight">Why Your ATU Needs<br />a Maintenance Contract</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              An ATU (aerobic treatment unit) uses air pumps, controls and alarms to treat wastewater. Those
              parts need regular service to keep working — that's why the Florida Department of Health requires
              every ATU to be covered by a maintenance contract <strong>at all times</strong>.
            </p>
            <p className="text-slate-600 leading-relaxed mb-8">
              The contract must be renewed before it expires. If it lapses, the owner can have problems with the
              Health Department — and a system without service is more likely to fail.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-xl p-5">
              <p className="text-blue-800 text-sm font-semibold">
                Besides the maintenance contract, the Health Department operating permit has its own renewal fee,
                paid to the county. We explain it below so there are no surprises.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center bg-slate-50 rounded-3xl p-8 shadow-xl">
            <img src={atuUnitImg} alt="ATU aerobic treatment unit" className="max-h-[380px] w-auto object-contain" />
          </div>
        </div>
      </div>

      {/* ── PRICING ── */}
      <div className="bg-slate-900 py-20 px-6" id="pricing">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-3">Simple Pricing</p>
            <h2 className="text-4xl font-black text-white uppercase">One Plan. Clear Price.</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {/* Plan */}
            <div className="bg-white rounded-2xl p-8 shadow-2xl border-2 border-yellow-400 flex flex-col">
              <div className="bg-yellow-400 text-slate-900 text-xs font-black px-3 py-1 rounded-full inline-block self-start mb-4 uppercase tracking-wide">
                ATU Maintenance Contract
              </div>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-black text-slate-900">${PRICE}</span>
                <span className="text-slate-500 font-semibold mb-1.5">/ year</span>
              </div>
              <p className="text-slate-500 text-sm mb-6">Lehigh Acres & nearby areas · renewable every year</p>
              <ul className="space-y-3 mb-8">
                {PLAN_INCLUDES.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 text-sm">
                    <CheckCircleIcon className="text-green-600 flex-shrink-0 mt-0.5 w-5 h-5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowQuoteModal(true)}
                className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors uppercase text-sm"
              >
                Start or Renew My Contract
              </button>
              <p className="text-xs text-slate-400 text-center mt-3">Farther away? Contact us — the price depends on your location.</p>
            </div>

            {/* Not included */}
            <div className="bg-slate-800 rounded-2xl p-8 flex flex-col">
              <h3 className="text-xl font-black text-white uppercase mb-2">Not Included</h3>
              <p className="text-slate-400 text-sm mb-6">So you know exactly what to expect:</p>
              <div className="space-y-5">
                {NOT_INCLUDED.map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <XCircleIcon className="text-slate-400 flex-shrink-0 mt-0.5 w-5 h-5" />
                    <div>
                      <div className="text-white font-bold text-sm mb-1">{item.title}</div>
                      <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 bg-slate-900/70 border border-slate-700 rounded-xl p-5">
                <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Health Department renewal fee</div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <div className="text-white text-2xl font-black">$100 – $200</div>
                    <div className="text-slate-400 text-xs">depending on the county</div>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 text-2xl font-black">$175</div>
                    <div className="text-slate-400 text-xs">Lee County</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHAT WE CHECK ── */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Every Visit</p>
            <h2 className="text-4xl font-black text-slate-800 uppercase">What We Check</h2>
            <div className="w-16 h-1 bg-blue-600 mx-auto mt-4"></div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VISIT_CHECKS.map((item, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-yellow-400 text-slate-900 font-black text-sm flex items-center justify-center mb-4">
                  0{i + 1}
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHO IT'S FOR ── */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Is This For You?</p>
            <h2 className="text-4xl font-black text-slate-800 uppercase">Who We Service</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {WHO_FOR.map((item, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 p-7 hover:shadow-xl hover:border-blue-300 transition-all">
                <div className="text-blue-600 mb-4">{item.icon}</div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className="bg-slate-900 py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">Step by Step</p>
            <h2 className="text-4xl font-black text-white uppercase">How It Works</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="flex md:flex-col md:items-center md:text-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-400 text-slate-900 font-black text-sm flex items-center justify-center flex-shrink-0 shadow-lg">
                  0{i + 1}
                </div>
                <div>
                  <h3 className="font-black text-blue-300 text-sm uppercase tracking-wide mb-1">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Questions</p>
            <h2 className="text-4xl font-black text-slate-800 uppercase">Frequently Asked</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold text-slate-800 hover:bg-slate-50"
                    aria-expanded={isOpen}
                  >
                    <span>{item.q}</span>
                    <ChevronDownIcon className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && <p className="px-5 pb-5 text-slate-600 text-sm leading-relaxed">{item.a}</p>}
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <button
              onClick={() => openChat('I have a question about ATU maintenance contracts.')}
              className="inline-flex items-center gap-2 text-blue-700 hover:text-blue-900 font-semibold text-sm"
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" /> Another question? Ask our assistant
            </button>
          </div>
        </div>
      </div>

      {/* ── FINAL CTA ── */}
      <div className="bg-blue-900 text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-yellow-400 text-slate-900 font-black text-xs uppercase tracking-widest px-4 py-2 rounded-full mb-6">
            Don't Let It Expire
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase mb-4 leading-tight">Start or Renew<br />Your ATU Contract</h2>
          <p className="text-blue-200 text-lg mb-10 max-w-xl mx-auto">
            ${PRICE} per year · 2 visits · Lehigh Acres & nearby areas. Our team will contact you to get you covered.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-black px-10 py-5 rounded-xl text-lg transition-colors uppercase"
            >
              Request My Contract
            </button>
            <a
              href={PHONE_HREF}
              className="flex items-center justify-center gap-3 bg-white/10 border-2 border-white hover:bg-white hover:text-blue-700 text-white font-bold px-10 py-5 rounded-xl text-lg transition-all duration-300"
            >
              <PhoneIcon className="w-5 h-5" /> {PHONE_LABEL}
            </a>
          </div>
        </div>
      </div>

      <LoginPopup isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <FloatingQuoteButton onClick={() => setShowQuoteModal(true)} />
      <ScheduleQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} defaultService="Maintenance" />
    </>
  );
};

export default MaintenancePage;

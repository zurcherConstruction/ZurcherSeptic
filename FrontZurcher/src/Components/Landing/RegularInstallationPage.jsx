import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';
import { FaPhone, FaCheckCircle, FaArrowLeft, FaCertificate } from 'react-icons/fa';
import heroImg   from '../../assets/landing/3.jpeg';
import img_incl  from '../../assets/landing/4.jpeg';
import img_how   from '../../assets/landing/5.jpeg';
import img_proc  from '../../assets/landing/6.jpeg';
import img_who   from '../../assets/landing/8.jpeg';
import img_comm  from '../../assets/landing/9.jpeg';
import img_why   from '../../assets/landing/11.jpeg';

const RegularInstallationPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  return (
    <>
      <SEOHelmet
        title="Conventional Septic System Installation Florida | Zurcher Septic"
        description="Licensed conventional septic system installation in Southwest Florida. Full permit management, professional installation, private inspections. No hidden costs. Serving Lehigh Acres, Fort Myers, Cape Coral."
        keywords="conventional septic installation Florida, septic system installation, septic permits Florida, septic installation Lehigh Acres, Fort Myers septic"
        canonicalUrl="https://www.zurcherseptic.com/services/regular-installation"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />

      {/* â”€â”€ HERO â”€â”€ */}
      <div
        className="relative min-h-[65vh] flex items-end bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-slate-900/40"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-6 pb-16 pt-32 w-full">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors text-sm"
          >
            <FaArrowLeft /> Back to Services
          </Link>

          <div className="grid md:grid-cols-3 gap-8 items-end">
            <div className="md:col-span-2">
              <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
                Installation
              </p>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                Conventional Septic System Installation
              </h1>
              <p className="text-slate-300 text-lg mb-8 max-w-xl leading-relaxed">
                Reliable, safe installations that comply with all Florida regulations.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowQuoteModal(true)}
                  className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold px-8 py-4 rounded-lg text-base transition-colors"
                >
                  GET A FREE QUOTE
                </button>
                <a
                  href="tel:+19546368200"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-lg text-base transition-colors"
                >
                  <FaPhone /> CALL NOW (954) 636-8200
                </a>
              </div>
            </div>

            {/* License badge */}
            <div className="bg-yellow-400/95 backdrop-blur-sm rounded-2xl p-6 text-slate-900">
              <div className="text-xs font-bold uppercase tracking-widest mb-1">Licensed & Insured</div>
              <h3 className="text-2xl font-bold mb-1">CFC1433240</h3>
              <p className="text-sm font-medium text-slate-700">Certified Florida Contractor</p>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ BENEFITS BAR â”€â”€ */}
      <div className="bg-blue-700 text-white py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm font-bold">
            {['LICENSED & INSURED', 'FAST TURNAROUND', 'NO HIDDEN COSTS', 'WE HANDLE PERMITS'].map(
              (item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <FaCheckCircle className="text-yellow-400 text-xs" />
                  <span>{item}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ SECTION 1: WHAT'S INCLUDED â”€â”€ checklist left / image right â”€â”€ */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Full Service</p>
            <h2 className="text-3xl font-bold text-slate-800 mb-4">WHAT'S INCLUDED?</h2>
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-5 mb-7">
              <p className="text-slate-700 text-sm leading-relaxed font-medium">
                Already have approved plans? We start directly with the installation.
                Don't have them yet? We coordinate the entire process at no additional cost.
              </p>
            </div>
            <ul className="space-y-4">
              {[
                "Coordination with engineers and soil studies (if you don't have them yet)",
                'Permit management with the Health Department',
                'System design and tank sizing (based on approved plans)',
                'Complete excavation and installation',
                'Private inspections to speed up timelines',
                'Final inspection and certification',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <FaCheckCircle className="text-blue-600 flex-shrink-0 mt-0.5 text-lg" />
                  <span className="text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-xl h-80 md:h-[500px]">
            <img src={img_incl} alt="Septic system installation" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        </div>
      </div>

      {/* â”€â”€ SECTION 2: HOW IT WORKS â”€â”€ image left / text + steps right â”€â”€ */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="overflow-hidden rounded-2xl shadow-xl h-80 md:h-[460px] order-2 md:order-1">
            <img src={img_how} alt="How septic system works" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="order-1 md:order-2">
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">The System</p>
            <h2 className="text-3xl font-bold text-slate-800 mb-6">HOW DOES THE SYSTEM WORK?</h2>
            <p className="text-slate-600 leading-relaxed mb-4">
              The septic system receives wastewater from the property into a tank where solids settle and begin to decompose.
            </p>
            <p className="text-slate-600 leading-relaxed mb-6">
              Then, the liquid flows to the drain field, where the soil naturally filters it before returning it to the environment.
            </p>
            <div className="space-y-3 mb-6">
              {['Water enters the tank', 'Solids separate', 'Liquid flows to the drain field', 'Soil naturally filters'].map((step, i) => (
                <div key={i} className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
                  <span className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</span>
                  <span className="text-slate-700 font-medium text-sm">{step}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-700 text-white rounded-xl p-4 text-sm font-medium leading-relaxed">
              A properly installed system prevents future problems, unnecessary costs, and construction delays.
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ SECTION 3: PROCESS â”€â”€ steps left / image right (dark) â”€â”€ */}
      <div className="bg-blue-900 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-start">
          <div>
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">Step by Step</p>
            <h2 className="text-3xl font-bold text-white mb-10">OUR INSTALLATION PROCESS</h2>
            <div className="space-y-6">
              {[
                { step: '01', title: 'INITIAL COORDINATION', desc: "If you don't have plans or a soil study, we help manage it at no additional cost." },
                { step: '02', title: 'PERMITS', desc: 'We handle the entire Health Department process to avoid delays.' },
                { step: '03', title: 'INSTALLATION', desc: 'We perform the excavation and full installation according to approved plans.' },
                { step: '04', title: 'INSPECTIONS', desc: 'We include inspections (and private ones when possible) to speed up timelines.' },
                { step: '05', title: 'FINAL APPROVAL', desc: 'We deliver your system ready, approved, and fully operational.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 border-2 border-blue-400 flex items-center justify-center font-bold text-white text-sm shadow-lg">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-300 text-xs tracking-wider mb-1">{item.title}</h3>
                    <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-2xl h-80 md:sticky md:top-28 md:h-[480px]">
            <img src={img_proc} alt="Septic installation process" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* â”€â”€ SECTION 4: WHO NEEDS THIS â”€â”€ image left / text right â”€â”€ */}
      <div className="bg-white py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="overflow-hidden rounded-2xl shadow-xl h-80 md:h-[400px]">
            <img src={img_who} alt="Who needs a septic system" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Is This For You?</p>
            <h2 className="text-3xl font-bold text-slate-800 mb-8">WHO NEEDS THIS?</h2>
            <ul className="space-y-5">
              {['New constructions', 'Properties without sewer access', 'Damaged or outdated septic systems'].map((item, i) => (
                <li key={i} className="flex items-center gap-4">
                  <FaCheckCircle className="text-blue-600 text-2xl flex-shrink-0" />
                  <span className="text-slate-700 text-lg font-medium">{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 bg-slate-800 text-white rounded-2xl p-6 flex items-center gap-4">
              <FaCertificate className="text-yellow-400 text-4xl flex-shrink-0" />
              <div>
                <div className="text-yellow-400 text-xs font-bold uppercase tracking-widest">Licensed & Insured</div>
                <div className="text-2xl font-bold">CFC1433240</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ SECTION 5: WHY CHOOSE US + COMMITMENT â”€â”€ text left / image right â”€â”€ */}
      <div className="bg-slate-50 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-blue-600 text-xs font-bold uppercase tracking-widest mb-3">Our Commitment</p>
            <h2 className="text-3xl font-bold text-slate-800 mb-4">WHY CHOOSE ZURCHER SEPTIC?</h2>
            <p className="text-slate-500 leading-relaxed mb-7 italic">We don't take shortcuts.</p>
            <div className="space-y-3 mb-8">
              {[
                'Licensed and insured (CFC1433240)',
                'Fast turnaround times',
                'No hidden costs or unexpected changes',
                'We coordinate the entire process for you',
                'Experience working with builders and engineers',
                'Clear communication throughout the project',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm">
                  <FaCheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-700 text-sm">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-xl h-80 md:h-[500px]">
            <img src={img_comm} alt="Zurcher Septic commitment to quality" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
        </div>
      </div>

      {/* â”€â”€ COMMITMENT BANNER â”€â”€ full width dark â”€â”€ */}
      <div className="bg-blue-800 py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="overflow-hidden rounded-2xl shadow-2xl h-72">
            <img src={img_why} alt="Quality septic installation" className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
          </div>
          <div className="text-white">
            <p className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-3">Our Promise</p>
            <h2 className="text-3xl font-bold mb-6">OUR COMMITMENT</h2>
            <p className="text-blue-200 text-lg font-semibold leading-relaxed mb-4">We don't take shortcuts.</p>
            <p className="text-blue-200 leading-relaxed">
              We use high-quality materials and follow the correct procedures to ensure a durable and
              reliable system. A properly installed septic system doesn't just prevent problems â€”
              it protects your investment long term.
            </p>
          </div>
        </div>
      </div>

      {/* â”€â”€ FINAL CTA â”€â”€ */}
      <div className="bg-slate-900 text-white py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">READY TO GET STARTED?</h2>
          <p className="text-slate-300 mb-8">Contact us today for a free quote and consultation.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setShowQuoteModal(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold px-8 py-4 rounded-lg text-base transition-colors"
            >
              GET A FREE QUOTE
            </button>
            <a
              href="tel:+19546368200"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-lg text-base transition-colors"
            >
              <FaPhone /> CALL NOW (954) 636-8200
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

export default RegularInstallationPage;

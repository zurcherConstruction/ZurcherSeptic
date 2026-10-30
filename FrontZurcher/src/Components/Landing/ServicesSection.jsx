import React from 'react';
import { FaHardHat, FaTools, FaCheckCircle, FaClipboardCheck, FaWrench, FaRecycle } from 'react-icons/fa';

const ServicesSection = () => {
  const services = [
    {
      icon: <FaHardHat className="text-5xl text-blue-600" />,
      title: 'New Installations',
      description: 'Complete septic system installation for new construction, including ATU aerobic systems and conventional systems.',
      features: ['Permit processing', 'Health Dept coordination', 'Professional excavation', 'FHA inspections']
    },
    {
      icon: <FaTools className="text-5xl text-cyan-600" />,
      title: 'Repairs & Replacements',
      description: 'Scheduled repairs for drain fields, pumps, tanks, and all system components. $300 diagnostic visit, credited toward your repair.',
      features: ['Diagnostic visits', 'Drain field repair', 'Pump replacement', 'Tank crack sealing']
    },
    {
      icon: <FaCheckCircle className="text-5xl text-green-600" />,
      title: 'Inspections',
      description: 'Certified FHA and real estate transfer inspections with detailed reports for buyers and sellers.',
      features: ['FHA certified', 'Pre-sale inspections', 'Buyer protection', 'Detailed reports']
    },
    {
      icon: <FaClipboardCheck className="text-5xl text-purple-600" />,
      title: 'Maintenance Programs',
      description: 'ATU maintenance contracts ($450 / 2 years) as required by the Health Department, plus pumping and routine service.',
      features: ['ATU maintenance contracts', 'Contract renewals', 'Pumping service', 'Scheduled inspections']
    },
    {
      icon: <FaWrench className="text-5xl text-orange-600" />,
      title: 'ATU Aerobic Systems',
      description: 'Specialized installation and maintenance of advanced aerobic treatment units for challenging properties.',
      features: ['ATU installation', 'Aerator service', 'Control systems', 'Chlorination']
    },
    {
      icon: <FaRecycle className="text-5xl text-teal-600" />,
      title: 'System Upgrades',
      description: 'Modernize outdated systems with efficient ATU units or expand capacity for growing properties.',
      features: ['System conversion', 'Capacity expansion', 'Code compliance', 'Technology updates']
    }
  ];

  return (
    <section id="services" className="pt-24 pb-20 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-blue-600 mb-4">
            Our Services
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Complete septic system solutions for residential and commercial properties across Southwest Florida
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 group"
            >
              <div className="mb-6 transform group-hover:scale-110 transition-transform duration-300">
                {service.icon}
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">{service.title}</h3>
              <p className="text-slate-600 mb-6">{service.description}</p>
              <ul className="space-y-2">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-2xl p-8 md:p-12 text-center text-white">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Need Expert Septic Service?
          </h3>
          <p className="text-xl mb-6 opacity-90">
            Licensed, insured, and certified professionals ready to help you today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="tel:+19546368200"
              className="inline-block px-8 py-4 bg-white text-blue-600 font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
            >
              Call (954) 636-8200
            </a>
            <button
              onClick={() => {
                const element = document.querySelector('#contact');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="inline-block px-8 py-4 bg-transparent border-2 border-white text-white font-bold rounded-lg hover:bg-white hover:text-blue-600 transition-all"
            >
              Request Free Quote
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;

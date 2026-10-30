import React from 'react';
import { FaCheckCircle, FaTools, FaClock, FaShieldAlt } from 'react-icons/fa';

const MaintenanceServices = () => {
  const maintenanceServices = [
    {
      icon: <FaTools className="text-4xl text-blue-600" />,
      title: 'Regular System Inspection',
      description: 'Comprehensive inspection of your septic system components including tank, drain field, and ATU aerobic units.',
      features: ['Visual tank inspection', 'Drain field assessment', 'Pump and motor check', 'Filter cleaning']
    },
    {
      icon: <FaClock className="text-4xl text-green-600" />,
      title: 'Pump & Clean Service',
      description: 'Professional pumping and cleaning to prevent system failure and extend the life of your septic system.',
      features: ['Complete tank pumping', 'Sludge removal', 'Bacterial treatment', 'System performance test']
    },
    {
      icon: <FaShieldAlt className="text-4xl text-cyan-600" />,
      title: 'ATU Aerobic Maintenance',
      description: 'Specialized maintenance for aerobic treatment units ensuring optimal bacterial activity and system efficiency.',
      features: ['Aerator servicing', 'Chlorine monitoring', 'Air flow verification', 'Control panel check']
    }
  ];

  // Contrato de mantenimiento ATU (exigido por el Health Department; se debe renovar)
  const contractIncludes = [
    '2 years of ATU maintenance',
    '4 service visits — one every 6 months',
    'Keeps you compliant with the Health Department',
  ];

  return (
    <section id="maintenance" className="pt-24 pb-20 bg-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-blue-600 mb-4">
            Maintenance Services
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Keep your septic system running smoothly with our professional maintenance programs
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {maintenanceServices.map((service, index) => (
            <div
              key={index}
              className="bg-gradient-to-br from-slate-50 to-white p-8 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-slate-100"
            >
              <div className="mb-4">{service.icon}</div>
              <h3 className="text-2xl font-bold text-slate-800 mb-3">{service.title}</h3>
              <p className="text-slate-600 mb-4">{service.description}</p>
              <ul className="space-y-2">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700">
                    <FaCheckCircle className="text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ATU Maintenance Contract */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center max-w-5xl mx-auto">
            <div>
              <h3 className="text-3xl font-bold text-slate-800 mb-4">ATU Maintenance Contract</h3>
              <p className="text-slate-600 mb-4">
                The Florida Department of Health requires every ATU (aerobic treatment unit) to have an active
                maintenance contract at all times — and it must be renewed before it expires. We take care of it
                so you stay compliant and your system keeps working properly.
              </p>
              <p className="text-slate-600">
                <strong>Installed your ATU with us?</strong> Your first 2 years of maintenance are already included.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md border-2 border-blue-500">
              <div className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">
                HEALTH DEPARTMENT REQUIRED
              </div>
              <div className="text-4xl font-bold text-blue-600 mb-1">$450</div>
              <div className="text-slate-500 mb-4">2-year contract · renewable</div>
              <ul className="space-y-2 mb-4">
                {contractIncludes.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-slate-700">
                    <FaCheckCircle className="text-green-500 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="tel:+19546368200"
                className="block text-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Start or renew my contract
              </a>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="text-lg text-slate-600 mb-4">
            Questions about your system or your contract renewal? Call us!
          </p>
          <a
            href="tel:+19546368200"
            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all"
          >
            Call (954) 636-8200
          </a>
        </div>
      </div>
    </section>
  );
};

export default MaintenanceServices;

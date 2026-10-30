import React from 'react';
import { FaWrench, FaExclamationTriangle, FaTint, FaMapMarkerAlt } from 'react-icons/fa';

const RepairServices = () => {
  const repairServices = [
    {
      icon: <FaTint className="text-5xl text-red-600" />,
      title: 'Drain Field Repair',
      description: 'Expert repair and replacement of failing drain fields. We diagnose and fix saturation issues, pipe breaks, and soil problems.',
      urgency: 'Critical',
      urgencyColor: 'text-red-600'
    },
    {
      icon: <FaWrench className="text-5xl text-orange-600" />,
      title: 'Pump & Motor Replacement',
      description: 'Fast replacement of failed pumps and motors. We carry most common parts and can often complete repairs same-day.',
      urgency: 'High',
      urgencyColor: 'text-orange-600'
    },
    {
      icon: <FaExclamationTriangle className="text-5xl text-yellow-600" />,
      title: 'Tank Crack Repair',
      description: 'Professional sealing and repair of concrete or fiberglass tank cracks to prevent groundwater infiltration.',
      urgency: 'Medium',
      urgencyColor: 'text-yellow-600'
    },
    {
      icon: <FaMapMarkerAlt className="text-5xl text-blue-600" />,
      title: 'ATU Component Repair',
      description: 'Specialized repair of aerobic treatment unit components including aerators, timers, and control systems.',
      urgency: 'High',
      urgencyColor: 'text-orange-600'
    }
  ];

  const emergencySigns = [
    'Sewage backup in drains or toilets',
    'Standing water or wet spots in yard',
    'Strong sewage odor around property',
    'Gurgling sounds in plumbing',
    'Slow draining fixtures',
    'Lush green grass over drain field',
    'Alarm system activated (for ATU)',
    'Visible effluent on ground surface'
  ];

  return (
    <section id="repairs" className="pt-24 pb-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-red-600 mb-4">
            Septic Repair Services
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-6">
            Reliable septic system repairs across South Florida, by appointment
          </p>
          <div className="inline-block bg-red-100 border-2 border-red-500 rounded-lg px-6 py-3">
            <p className="text-red-700 font-bold text-lg">
              🔧 Diagnostic visit $300 — credited toward your repair
            </p>
          </div>
        </div>

        {/* Repair Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {repairServices.map((service, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border-t-4 border-red-500"
            >
              <div className="mb-4 flex justify-center">{service.icon}</div>
              <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">{service.title}</h3>
              <div className={`text-center mb-3`}>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${service.urgencyColor} bg-opacity-10`}>
                  {service.urgency} Priority
                </span>
              </div>
              <p className="text-slate-600 text-center">{service.description}</p>
            </div>
          ))}
        </div>

        {/* Warning Signs */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-8 md:p-12 mb-12">
          <h3 className="text-3xl font-bold text-slate-800 mb-6 text-center">
            Warning Signs You Need Immediate Repair
          </h3>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {emergencySigns.map((sign, index) => (
              <div
                key={index}
                className="flex items-start gap-3 bg-white p-4 rounded-lg shadow-md"
              >
                <FaExclamationTriangle className="text-red-600 text-xl flex-shrink-0 mt-1" />
                <span className="text-slate-700 font-medium">{sign}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency CTA */}
        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-8 md:p-12 text-center text-white shadow-2xl">
          <h3 className="text-3xl md:text-4xl font-bold mb-4">
            Don't Wait — Schedule Your Visit
          </h3>
          <p className="text-xl mb-6 opacity-90">
            Small septic problems become expensive ones. Call us and we'll schedule the earliest available visit.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="tel:+19546368200"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-red-600 font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all text-lg"
            >
              <FaWrench className="text-2xl" />
              Call (954) 636-8200
            </a>
          </div>
        </div>

        {/* Service Areas */}
        <div className="mt-12 text-center">
          <p className="text-slate-600 text-lg mb-2">
            <strong>Serving:</strong> Lehigh Acres • Fort Myers • Cape Coral • Port Charlotte • North Port • Sarasota • Poinciana
          </p>
          <p className="text-slate-500">Licensed, Insured & Certified Septic Contractors</p>
        </div>
      </div>
    </section>
  );
};

export default RepairServices;

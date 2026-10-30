import React from 'react';
import { FaLinkedin, FaEnvelope, FaPhone } from 'react-icons/fa';

const TeamMember = ({ name, role, image, bio, linkedin, email, phone }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden group hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
      {/* Image Container */}
      <div className="relative overflow-hidden h-80 bg-slate-200">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-2xl font-bold text-slate-800 mb-1">{name}</h3>
        <p className="text-blue-600 font-semibold mb-3">{role}</p>
        <p className="text-slate-600 leading-relaxed mb-4">{bio}</p>

        {/* Contact Info */}
        <div className="flex gap-3 mt-4 pt-4 border-t border-slate-200">
          {linkedin && (
            <a
              href={linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <FaLinkedin size={20} />
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center justify-center w-10 h-10 bg-slate-600 text-white rounded-full hover:bg-slate-700 transition-colors"
            >
              <FaEnvelope size={18} />
            </a>
          )}
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center justify-center w-10 h-10 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors"
            >
              <FaPhone size={18} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

const AboutTeam = () => {
  // 🔧 PERSONALIZA AQUÍ - Agrega tus empleados
  const teamMembers = [
    {
      name: 'John Zurcher',
      role: 'Owner & Master Installer',
      image: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1234567890/team/john.jpg', // Cambiar por URL real
      bio: 'Over 20 years of experience in septic system installation and repair. Licensed and certified in ATU aerobic systems.',
      email: 'john@zurcherseptic.com',
      phone: '+1 (954) 636-8200',
      linkedin: null
    },
    {
      name: 'Sarah Martinez',
      role: 'Project Manager',
      image: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1234567890/team/sarah.jpg', // Cambiar por URL real
      bio: 'Coordinates all installations from permits to final inspection. Your main point of contact for project updates.',
      email: 'sarah@zurcherseptic.com',
      phone: '+1 (954) 636-8200',
      linkedin: null
    },
    {
      name: 'Mike Johnson',
      role: 'Lead Technician',
      image: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1234567890/team/mike.jpg', // Cambiar por URL real
      bio: 'Certified septic inspector with expertise in drain field installation and troubleshooting complex systems.',
      email: 'mike@zurcherseptic.com',
      phone: '+1 (954) 636-8200',
      linkedin: null
    },
    {
      name: 'Carlos Rodriguez',
      role: 'Field Supervisor',
      image: 'https://res.cloudinary.com/dt4ah1jmy/image/upload/v1234567890/team/carlos.jpg', // Cambiar por URL real
      bio: '15+ years leading installation crews. Ensures every project meets health department standards.',
      email: 'carlos@zurcherseptic.com',
      phone: '+1 (954) 636-8200',
      linkedin: null
    }
  ];

  return (
    <section className="pt-24 pb-20 bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl lg:text-5xl font-bold text-blue-600 mb-4 animate-slide-up">
            Meet Our Expert Team
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto animate-slide-up" style={{animationDelay: '0.2s'}}>
            Licensed, certified professionals dedicated to providing the highest quality septic system services in Southwest Florida
          </p>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {teamMembers.map((member, index) => (
            <div 
              key={index} 
              className="animate-fade-in-up"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <TeamMember {...member} />
            </div>
          ))}
        </div>

        {/* Company Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">20+</div>
            <div className="text-slate-600">Years Experience</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">1000+</div>
            <div className="text-slate-600">Systems Installed</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">100%</div>
            <div className="text-slate-600">Licensed & Insured</div>
          </div>
          <div className="text-center p-6 bg-white rounded-lg shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">All-in</div>
            <div className="text-slate-600">One Price, No Surprises</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutTeam;

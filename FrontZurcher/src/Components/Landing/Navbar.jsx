import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaPhone, FaEnvelope, FaUser, FaChevronDown } from 'react-icons/fa';
import logo from '/logo.png';

const Navbar = ({ onLoginClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesHover, setServicesHover] = useState(false);
  const [mobileServicesOpen, setMobileServicesOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Gallery', path: '/gallery' },
    {
      name: 'Services',
      dropdown: [
        { name: 'ATU System Installation', path: '/services/atu-installation', desc: 'Aerobic treatment units' },
        { name: 'Conventional Septic System', path: '/services/regular-installation', desc: 'Standard septic installation' },
        { name: 'Maintenance', path: '/maintenance-services', desc: 'Ongoing system care' },
        { name: 'Repairs', path: '/repairs', desc: 'Fast, reliable fixes' },
      ],
    },
    { name: 'About Us', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const isActive = (path) => location.pathname === path;
  const isHome = location.pathname === '/';

  // Determinar estilos según la página
  const getNavbarStyles = () => {
    if (isHome) {
      // En Home: fondo sólido slate
      return scrolled 
        ? 'bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg' 
        : 'bg-gradient-to-r from-slate-800 to-slate-700 shadow-md';
    } else {
      // En otras páginas: transparente con backdrop-blur
      return scrolled 
        ? 'bg-slate-900/80 backdrop-blur-md shadow-lg' 
        : 'bg-slate-900/60 backdrop-blur-sm';
    }
  };

  return (
    <>
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${getNavbarStyles()}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img src={logo} alt="Zurcher Septic" className="h-12 w-12 rounded-lg" />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white">ZURCHER SEPTIC</h1>
                <p className="text-xs text-blue-400">Southwest Florida</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden xl:flex items-center gap-1">
              {navLinks.map((link) =>
                link.dropdown ? (
                  <div
                    key={link.name}
                    className="relative"
                    onMouseEnter={() => setServicesHover(true)}
                    onMouseLeave={() => setServicesHover(false)}
                  >
                    <button
                      className={`flex items-center gap-1.5 px-4 py-2 font-medium transition-colors relative group ${
                        link.dropdown.some((d) => isActive(d.path)) ? 'text-blue-400' : 'text-slate-100 hover:text-blue-400'
                      }`}
                    >
                      {link.name}
                      <FaChevronDown className={`text-xs transition-transform duration-200 ${servicesHover ? 'rotate-180' : ''}`} />
                      <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-400 transition-all duration-300 ${
                        link.dropdown.some((d) => isActive(d.path)) ? 'w-full' : 'w-0 group-hover:w-full'
                      }`}></span>
                    </button>
                    <div className={`absolute top-full left-0 w-64 bg-slate-800 border border-slate-600/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-200 ${
                      servicesHover ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
                    }`}>
                      {link.dropdown.map((item) => (
                        <Link
                          key={item.name}
                          to={item.path}
                          onClick={() => setServicesHover(false)}
                          className={`flex flex-col px-5 py-4 border-b border-slate-700/50 last:border-0 transition-colors hover:bg-slate-700/60 ${
                            isActive(item.path) ? 'bg-slate-700/60 text-blue-400' : 'text-slate-100'
                          }`}
                        >
                          <span className="font-semibold text-sm">{item.name}</span>
                          {item.desc && <span className="text-xs text-slate-400 mt-0.5">{item.desc}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`px-4 py-2 font-medium transition-colors relative group ${
                      isActive(link.path) ? 'text-blue-400' : 'text-slate-100 hover:text-blue-400'
                    }`}
                  >
                    {link.name}
                    <span className={`absolute bottom-0 left-0 h-0.5 bg-blue-400 transition-all duration-300 ${
                      isActive(link.path) ? 'w-full' : 'w-0 group-hover:w-full'
                    }`}></span>
                  </Link>
                )
              )}
            </div>

            {/* Contact Info & Login Desktop */}
            <div className="hidden xl:flex items-center gap-4">
              <a href="tel:+19546368200" className="flex items-center gap-2 text-slate-100 hover:text-blue-400 transition-colors">
                <FaPhone className="text-blue-400" />
                <span className="font-semibold">(954) 636-8200</span>
              </a>
              <button
                onClick={onLoginClick}
                className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-lg transition-colors"
                aria-label="Employee Login"
              >
                <FaUser />
                <span className="font-semibold">Login</span>
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="xl:hidden p-2 rounded-lg hover:bg-slate-600 transition-colors"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <FaTimes className="text-2xl text-white" />
              ) : (
                <FaBars className="text-2xl text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`xl:hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className={`border-t border-slate-600/50 shadow-lg backdrop-blur-md ${
            isHome 
              ? 'bg-gradient-to-b from-slate-700/95 to-slate-800/95' 
              : 'bg-slate-900/70'
          }`}>
            <div className="container mx-auto px-4 py-4 space-y-2 max-h-[70vh] overflow-y-auto">
              {navLinks.map((link) =>
                link.dropdown ? (
                  <div key={link.name}>
                    <button
                      onClick={() => setMobileServicesOpen(!mobileServicesOpen)}
                      className={`flex items-center justify-between w-full px-4 py-3 rounded-lg font-medium transition-all ${
                        link.dropdown.some((d) => isActive(d.path))
                          ? 'bg-slate-600/50 text-blue-400'
                          : 'text-slate-100 hover:bg-slate-600/30 hover:text-blue-400'
                      }`}
                    >
                      <span>{link.name}</span>
                      <FaChevronDown className={`text-xs transition-transform duration-200 ${mobileServicesOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`overflow-hidden transition-all duration-300 ${mobileServicesOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-4 mt-1 space-y-1 border-l-2 border-blue-600/50 pl-3">
                        {link.dropdown.map((item) => (
                          <Link
                            key={item.name}
                            to={item.path}
                            onClick={() => { setIsOpen(false); setMobileServicesOpen(false); }}
                            className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-all hover:translate-x-1 ${
                              isActive(item.path) ? 'text-blue-400 bg-slate-600/30' : 'text-slate-200 hover:text-blue-400 hover:bg-slate-600/20'
                            }`}
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsOpen(false)}
                    className={`block w-full text-left px-4 py-3 rounded-lg font-medium transition-all transform hover:translate-x-2 ${
                      isActive(link.path)
                        ? 'bg-slate-600/50 text-blue-400'
                        : 'text-slate-100 hover:bg-slate-600/30 hover:text-blue-400'
                    }`}
                  >
                    {link.name}
                  </Link>
                )
              )}

              
              {/* Contact Info Mobile */}
              <div className="pt-4 border-t border-slate-600/50 space-y-2">
                <a href="tel:+19546368200" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-600/30 text-blue-400 hover:bg-slate-600/50 transition-colors">
                  <FaPhone className="text-xl" />
                  <span className="font-semibold">(954) 636-8200</span>
                </a>
                <a href="mailto:admin@zurcherseptic.com" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-600/30 text-slate-100 hover:bg-slate-600/50 hover:text-blue-400 transition-colors">
                  <FaEnvelope className="text-xl" />
                  <span className="font-semibold">admin@zurcherseptic.com</span>
                </a>
                <button
                  onClick={() => {
                    onLoginClick();
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-white text-slate-800 hover:bg-slate-100 transition-colors"
                >
                  <FaUser className="text-xl" />
                  <span className="font-semibold">Employee Login</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer for fixed navbar - solo en Home */}
      {isHome && <div className="h-20"></div>}
    </>
  );
};

export default Navbar;

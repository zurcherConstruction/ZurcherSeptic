import React, { useState } from 'react';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import ComingSoon from './ComingSoon';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';

const MaintenancePage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  return (
    <>
      <SEOHelmet 
        title="Septic Maintenance Services Florida | ATU & System Care"
        description="ATU maintenance contracts in South Florida: $450 for 2 years (4 service visits), as required by the Florida Department of Health. Routine pumping, system inspections and scheduled repairs with Zurcher Septic."
        keywords="septic maintenance Florida, ATU maintenance, septic system pumping, septic inspection, septic repairs Lehigh Acres, septic service Fort Myers"
        canonicalUrl="https://www.zurcherseptic.com/maintenance-services"
        robots="noindex, nofollow"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />
      <ComingSoon 
        title="Maintenance Services" 
        message="ATU maintenance contracts — $450 for 2 years, required by the Health Department"
        onQuoteClick={() => setShowQuoteModal(true)}
      />
      <LoginPopup isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <FloatingQuoteButton onClick={() => setShowQuoteModal(true)} />
      <ScheduleQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
    </>
  );
};

export default MaintenancePage;



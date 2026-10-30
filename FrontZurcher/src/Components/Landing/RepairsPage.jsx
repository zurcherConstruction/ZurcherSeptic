import React, { useState } from 'react';
import Navbar from './Navbar';
import SEOHelmet from '../SEO/SEOHelmet';
import ComingSoon from './ComingSoon';
import LoginPopup from '../Auth/LoginPopup';
import FloatingQuoteButton from './FloatingQuoteButton';
import ScheduleQuoteModal from './ScheduleQuoteModal';

const RepairsPage = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  return (
    <>
      <SEOHelmet 
        title="Septic Repairs Florida | Scheduled Septic Service"
        description="Septic system repairs throughout South Florida: pipe repairs, pump replacement, drain field restoration. Diagnostic visit $300, credited toward your repair. Licensed septic contractors serving Lehigh Acres, Fort Myers and all of South Florida."
        keywords="septic repairs, septic pump repair, drain field repair, septic pipe repair Florida, septic repair Lehigh Acres, septic diagnostic visit"
        canonicalUrl="https://www.zurcherseptic.com/repairs"
        robots="noindex, nofollow"
      />
      <Navbar onLoginClick={() => setIsLoginModalOpen(true)} />
      <ComingSoon 
        title="Repair Services" 
        message="Scheduled septic system repairs — $300 diagnostic visit, credited toward your repair"
        onQuoteClick={() => setShowQuoteModal(true)}
      />
      <LoginPopup isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
      <FloatingQuoteButton onClick={() => setShowQuoteModal(true)} />
      <ScheduleQuoteModal isOpen={showQuoteModal} onClose={() => setShowQuoteModal(false)} />
    </>
  );
};

export default RepairsPage;



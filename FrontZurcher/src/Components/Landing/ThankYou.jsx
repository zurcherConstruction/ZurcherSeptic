import React, { useMemo, useState } from 'react';
import { FaPhone, FaWhatsapp } from 'react-icons/fa';
import backgroundImage from '../../assets/landing/3.jpeg';
import api from '../../utils/axios';

function ThankYou() {
  // Estado para controlar el dropdown
  const [showDropdown, setShowDropdown] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [receiptData, setReceiptData] = useState(null);

  const sessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session_id');
  }, []);

  // Configuración de contacto
  const phone = "+1 (407) 419-4495";
  const whatsappNumber = "14074194495"; // Updated to match the main number
  const whatsappMessage = "Hello, I have a question about the contracted services.";

  const handleContactUsClick = () => {
    setShowDropdown(!showDropdown);
  };

  const pageStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    padding: '20px',
    color: '#e5e7e9',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif',
  };

  const overlayStyle = {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: '40px',
    borderRadius: '10px',
    maxWidth: '600px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
  };

  const headingStyle = {
    fontSize: '3em',
    fontWeight: 'bold',
    marginBottom: '20px',
    textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
  };

  const paragraphStyle = {
    fontSize: '1.3em',
    marginBottom: '30px',
    lineHeight: '1.6',
  };

  const buttonStyle = {
    backgroundColor: '#25D366',
    color: 'white',
    padding: '15px 30px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1em',
    cursor: 'pointer',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
    position: 'relative',
  };

  const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
    overflow: 'hidden',
    minWidth: '250px',
    zIndex: 1000,
    marginTop: '8px',
  };

  const handleButtonMouseOver = (e) => {
    e.currentTarget.style.backgroundColor = '#128C7E';
    e.currentTarget.style.transform = 'scale(1.05)';
  };

  const handleButtonMouseOut = (e) => {
    e.currentTarget.style.backgroundColor = '#25D366';
    e.currentTarget.style.transform = 'scale(1)';
  };

  // Cerrar dropdown cuando se hace click fuera
  const handleOutsideClick = (e) => {
    if (showDropdown && !e.target.closest('.dropdown-container')) {
      setShowDropdown(false);
    }
  };

  // Agregar event listener para clicks fuera del dropdown
  React.useEffect(() => {
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showDropdown]);

  React.useEffect(() => {
    const loadReceipt = async () => {
      if (!sessionId) return;

      setReceiptLoading(true);
      setReceiptError('');

      try {
        const response = await api.get(`/stripe/checkout-receipt?session_id=${encodeURIComponent(sessionId)}`);
        setReceiptData(response.data || null);
      } catch (error) {
        setReceiptError(error?.response?.data?.message || 'We could not load your payment receipt.');
      } finally {
        setReceiptLoading(false);
      }
    };

    loadReceipt();
  }, [sessionId]);

  return (
    <div style={pageStyle}>
      <div style={overlayStyle}>
        <h1 style={headingStyle}>¡Thank you for choosing Zurcher Septic!</h1>
        <p style={paragraphStyle}>
          We truly appreciate your trust in our team. We’re excited to begin your project and are committed to delivering high-quality service every step of the way.
        </p>
        <p style={paragraphStyle}>
          If you have any questions or need support, feel free to reach out. We’re here to help.
        </p>

        {sessionId && (
          <div
            style={{
              marginBottom: '24px',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            }}
          >
            <p style={{ margin: 0, fontSize: '1em', lineHeight: '1.5' }}>
              Payment confirmation detected. You can view or download your receipt below.
            </p>
            {receiptLoading && (
              <p style={{ marginTop: '8px', fontSize: '0.95em' }}>Loading receipt...</p>
            )}
            {!receiptLoading && receiptData?.receiptUrl && (
              <a
                href={receiptData.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '12px',
                  backgroundColor: '#1d4ed8',
                  color: '#fff',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  textDecoration: 'none'
                }}
              >
                View / Download Receipt
              </a>
            )}
            {!receiptLoading && !receiptData?.receiptUrl && !receiptError && (
              <p style={{ marginTop: '8px', fontSize: '0.95em' }}>
                Receipt is not available yet. Please check again in a moment.
              </p>
            )}
            {receiptError && (
              <p style={{ marginTop: '8px', fontSize: '0.95em', color: '#fecaca' }}>
                {receiptError}
              </p>
            )}
          </div>
        )}

        <div style={{ position: 'relative', display: 'inline-block' }} className="dropdown-container">
          <button
            style={buttonStyle}
            onClick={handleContactUsClick}
            onMouseOver={handleButtonMouseOver}
            onMouseOut={handleButtonMouseOut}
          >
            Contact us
          </button>
          
          {showDropdown && (
            <div style={dropdownStyle}>
              <a
                href={`tel:${phone}`}
                style={{ 
                  textDecoration: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 16px',
                  color: '#1d4ed8',
                  fontWeight: '500',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#eff6ff'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => setShowDropdown(false)}
              >
                <FaPhone style={{ width: '16px', height: '16px' }} />
                Call for Quote
              </a>
              <a
                href={`sms:${phone.replace(/[^\d]/g, '')}?body=${encodeURIComponent("I would like a free quote for septic system services.")}`}
                style={{ 
                  textDecoration: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 16px',
                  color: '#1d4ed8',
                  fontWeight: '500',
                  borderBottom: '1px solid #f3f4f6',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#eff6ff'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => setShowDropdown(false)}
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5V6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2h5.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                Request by SMS
              </a>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  textDecoration: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '12px 16px',
                  color: '#15803d',
                  fontWeight: '500',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#f0fdf4'}
                onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                onClick={() => setShowDropdown(false)}
              >
                <FaWhatsapp style={{ width: '16px', height: '16px' }} />
                WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ThankYou;

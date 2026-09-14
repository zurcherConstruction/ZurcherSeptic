import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://zurcherapi.up.railway.app';

export default function MaintenanceContractSignPage() {
  const { idWork } = useParams();
  const [searchParams] = useSearchParams();
  const justSigned = searchParams.get('signed') === 'true';
  const [status, setStatus] = useState(justSigned ? 'just_signed' : 'loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (justSigned) return;
    const fetchStatus = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/work/${idWork}/maintenance-contract/public-status`);
        setStatus(data.isSigned ? 'already_signed' : 'ready');
      } catch (err) {
        setError(err.response?.status === 400
          ? 'The maintenance contract has not been sent for signature yet.'
          : 'Could not load the document. Please try again or contact us.');
        setStatus('error');
      }
    };
    fetchStatus();
  }, [idWork, justSigned]);

  const handleSign = () => {
    setStatus('signing');
    window.location.href = `${API_URL}/work/${idWork}/maintenance-contract/sign`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
        padding: '48px 40px',
        maxWidth: '520px',
        width: '100%',
        textAlign: 'center'
      }}>
        {/* Logo / Header */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{
            background: '#063260',
            display: 'inline-block',
            borderRadius: '12px',
            padding: '12px 20px',
            marginBottom: '16px'
          }}>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px', letterSpacing: '1px' }}>
              ZURCHER CONSTRUCTION
            </span>
          </div>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            SEPTIC TANK DIVISION · CFC1433240
          </p>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <>
            <div style={{
              width: '48px', height: '48px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #063260',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#6b7280' }}>Loading your document...</p>
          </>
        )}

        {/* Ready to sign */}
        {status === 'ready' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>📄</div>
            <h2 style={{ color: '#063260', margin: '0 0 8px', fontSize: '22px' }}>
              2-Year Maintenance Service Contract
            </h2>
            <p style={{ color: '#6b7280', marginBottom: '32px', fontSize: '15px' }}>
              Please review and sign your maintenance service agreement.<br />
              You will be redirected to a secure DocuSign page.
            </p>
            <button
              onClick={handleSign}
              style={{
                background: '#063260',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '14px 36px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '100%',
                maxWidth: '320px'
              }}
            >
              Sign Document
            </button>
            <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '16px' }}>
              You can click this button multiple times — a fresh secure session is generated each time.
            </p>
          </>
        )}

        {/* Signing in progress */}
        {status === 'signing' && (
          <>
            <div style={{
              width: '48px', height: '48px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #16a34a',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#16a34a', fontWeight: 'bold' }}>Redirecting to DocuSign...</p>
            <p style={{ color: '#6b7280', fontSize: '13px' }}>Please wait while we prepare your secure signing session.</p>
          </>
        )}

        {/* Just signed — returned from DocuSign */}
        {status === 'just_signed' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>🎉</div>
            <h2 style={{ color: '#16a34a', margin: '0 0 8px' }}>Thank You for Signing!</h2>
            <p style={{ color: '#6b7280' }}>
              Your 2-Year Maintenance Service Contract has been signed successfully.<br />
              You will receive a copy by email shortly.
            </p>
            <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '16px' }}>
              You may close this window.
            </p>
          </>
        )}

        {/* Already signed */}
        {status === 'already_signed' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>✅</div>
            <h2 style={{ color: '#16a34a', margin: '0 0 8px' }}>Document Already Signed</h2>
            <p style={{ color: '#6b7280' }}>
              Thank you! This maintenance contract has already been signed.<br />
              If you have any questions, please contact us.
            </p>
          </>
        )}

        {/* Error */}
        {status === 'error' && (
          <>
            <div style={{ fontSize: '52px', marginBottom: '12px' }}>❌</div>
            <h2 style={{ color: '#dc2626', margin: '0 0 8px' }}>Could Not Load Document</h2>
            <p style={{ color: '#6b7280' }}>{error}</p>
          </>
        )}

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '32px', paddingTop: '16px' }}>
          <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>
            Questions? Contact us at{' '}
            <a href="mailto:admin@zurcherseptic.com" style={{ color: '#063260' }}>
              admin@zurcherseptic.com
            </a>{' '}
            or call{' '}
            <a href="tel:+19546368200" style={{ color: '#063260' }}>+1 (954) 636-8200</a>
          </p>
        </div>
      </div>
    </div>
  );
}

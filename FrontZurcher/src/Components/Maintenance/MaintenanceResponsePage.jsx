import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://zurcherapi.up.railway.app';
const FRONTEND_URL = 'https://www.zurcherseptic.com';

const CONFIG = {
  confirm: {
    loadingMsg: 'Confirmando su visita...',
    successTitle: '¡Visita Confirmada!',
    successIcon: '✅',
    successColor: '#16a34a',
  },
  reject: {
    loadingMsg: 'Procesando su respuesta...',
    successTitle: 'Visita Rechazada',
    successIcon: '❌',
    successColor: '#dc2626',
  },
};

const PageShell = ({ icon, title, message, color }) => (
  <div style={styles.page}>
    <div style={styles.card}>
      <img
        src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png"
        alt="Zurcher Septic"
        style={styles.logo}
      />
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <h2 style={{ ...styles.title, color }}>{title}</h2>
      <p style={styles.subtitle}>{message}</p>
      <a href={FRONTEND_URL} style={styles.btn}>Ir al sitio</a>
      <p style={styles.footer}>Zurcher Septic &amp; Construction LLC</p>
    </div>
  </div>
);

const MaintenanceResponsePage = ({ action }) => {
  const { token } = useParams();
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const cfg = CONFIG[action];

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (!token) {
        if (isMounted) setStatus('invalid');
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/maintenance-notify/${action}/${token}`);
        if (isMounted) {
          setData(res.data);
          setStatus(res.data.alreadyProcessed ? 'already' : 'success');
        }
      } catch (err) {
        if (isMounted) {
          setData({ message: err.response?.data?.message || 'Ocurrió un error. Intentá nuevamente más tarde.' });
          setStatus('error');
        }
      }
    };
    run();
    return () => { isMounted = false; };
  }, [token, action]);

  if (status === 'loading') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <img src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png" alt="Zurcher Septic" style={styles.logo} />
          <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
          <p style={{ color: '#64748b', fontSize: 16 }}>{cfg.loadingMsg}</p>
        </div>
      </div>
    );
  }

  if (status === 'invalid' || status === 'error') {
    return <PageShell icon="❌" title="Enlace inválido" message={data?.message || 'Este enlace no es válido o ya fue utilizado.'} color="#dc2626" />;
  }

  if (status === 'already') {
    return <PageShell icon="ℹ️" title="Ya procesado" message={data?.message || 'Esta visita ya fue procesada anteriormente.'} color="#d97706" />;
  }

  return (
    <PageShell
      icon={cfg.successIcon}
      title={cfg.successTitle}
      message={data?.message || ''}
      color={cfg.successColor}
    />
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f4f6f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
    padding: '24px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    padding: '48px 40px',
    maxWidth: 460,
    width: '100%',
    textAlign: 'center',
  },
  logo: { height: 56, marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 700, margin: '0 0 10px' },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 1.6, margin: '0 0 28px' },
  btn: {
    display: 'inline-block',
    background: '#1e3a8a',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 28px',
    fontSize: 15,
    fontWeight: 700,
    textDecoration: 'none',
    cursor: 'pointer',
  },
  footer: { marginTop: 28, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 },
};

export const MaintenanceConfirmPage = () => <MaintenanceResponsePage action="confirm" />;
export const MaintenanceRejectPage = () => <MaintenanceResponsePage action="reject" />;

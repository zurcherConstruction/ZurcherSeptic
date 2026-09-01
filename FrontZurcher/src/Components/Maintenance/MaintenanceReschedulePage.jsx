import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const MaintenanceReschedulePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [proposedDate, setProposedDate] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!proposedDate) return;
    if (!token) {
      setStatus('error');
      setErrorMsg('Token inválido. Usá el link que recibiste por email.');
      return;
    }

    setStatus('loading');
    try {
      await axios.post(`${API_BASE}/maintenance-notify/reschedule/${token}`, { proposedDate });
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || 'Ocurrió un error. Intentá nuevamente.');
    }
  };

  if (!token) {
    return <PageShell icon="❌" title="Enlace inválido" message="Este enlace no es válido. Por favor usá el botón del email que recibiste." color="#dc2626" />;
  }

  if (status === 'success') {
    return (
      <PageShell
        icon="📅"
        title="¡Solicitud enviada!"
        message="Registramos tu pedido de reprogramación. Nos vamos a comunicar a la brevedad para confirmar la nueva fecha."
        color="#d97706"
      />
    );
  }

  if (status === 'error') {
    return <PageShell icon="❌" title="Error" message={errorMsg} color="#dc2626" />;
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img
          src="https://res.cloudinary.com/dt4ah1jmy/image/upload/v1751206826/logo_zlxdhw.png"
          alt="Zurcher Septic"
          style={styles.logo}
        />
        <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
        <h2 style={styles.title}>Solicitar Reprogramación</h2>
        <p style={styles.subtitle}>
          Seleccioná la fecha que mejor te convenga y la coordinamos con nuestro equipo.
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label} htmlFor="date">Nueva fecha propuesta</label>
          <input
            id="date"
            type="date"
            min={minDateStr}
            value={proposedDate}
            onChange={(e) => setProposedDate(e.target.value)}
            required
            style={styles.input}
          />

          <button
            type="submit"
            disabled={status === 'loading' || !proposedDate}
            style={{
              ...styles.btn,
              opacity: (status === 'loading' || !proposedDate) ? 0.6 : 1,
              cursor: (status === 'loading' || !proposedDate) ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? 'Enviando...' : 'Confirmar fecha'}
          </button>
        </form>

        <p style={styles.footer}>
          Zurcher Septic &amp; Construction LLC<br />
          <a href="https://www.zurcherseptic.com" style={styles.link}>www.zurcherseptic.com</a>
        </p>
      </div>
    </div>
  );
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
      <a href="https://www.zurcherseptic.com" style={styles.btn}>
        Ir al sitio
      </a>
      <p style={styles.footer}>Zurcher Septic &amp; Construction LLC</p>
    </div>
  </div>
);

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
  logo: {
    height: 56,
    marginBottom: 24,
  },
  title: {
    color: '#1e293b',
    fontSize: 22,
    fontWeight: 700,
    margin: '0 0 10px',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 1.6,
    margin: '0 0 28px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginBottom: 28,
  },
  label: {
    textAlign: 'left',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
  },
  input: {
    border: '1.5px solid #cbd5e1',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 15,
    color: '#1e293b',
    outline: 'none',
  },
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
    marginTop: 4,
  },
  footer: {
    marginTop: 28,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.6,
  },
  link: {
    color: '#1e3a8a',
    textDecoration: 'none',
  },
};

export default MaintenanceReschedulePage;

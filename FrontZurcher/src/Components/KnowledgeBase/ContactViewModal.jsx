import React from 'react';
import {
  FaTimes, FaPhone, FaEnvelope, FaMapMarkerAlt, FaGlobe,
  FaUser, FaStar, FaRegStar, FaEdit, FaTag,
} from 'react-icons/fa';

const InfoRow = ({ icon, label, value, href }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-slate-300 mt-0.5 flex-shrink-0 text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
        {href ? (
          <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline break-all font-medium">{value}</a>
        ) : (
          <p className="text-sm text-slate-700 break-words">{value}</p>
        )}
      </div>
    </div>
  );
};

const ContactViewModal = ({ contact, onClose, onEdit }) => {
  if (!contact) return null;

  const fullAddress = [contact.address, contact.city, contact.state, contact.zipCode].filter(Boolean).join(', ');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-5 py-4 flex items-start justify-between flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1">
              {contact.isFavorite
                ? <FaStar className="text-yellow-300 text-xs flex-shrink-0" />
                : <FaRegStar className="text-blue-300 text-xs flex-shrink-0" />}
              <h2 className="text-lg sm:text-xl font-bold truncate">{contact.companyName || 'Sin nombre'}</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {contact.category && (
                <span className="text-xs text-blue-100">{contact.category.icon} {contact.category.name}</span>
              )}
              {contact.contactType && (
                <span className="text-[10px] bg-white bg-opacity-20 px-2 py-0.5 rounded-full font-medium">
                  {contact.contactType}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="hover:bg-white hover:bg-opacity-20 rounded-xl p-1.5 transition-colors flex-shrink-0">
            <FaTimes className="text-base" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Principal */}
          {contact.contactPerson && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Contacto Principal</h3>
              <div className="bg-slate-50 rounded-xl px-4">
                <InfoRow icon={<FaUser />} label="Nombre" value={contact.contactPerson} />
              </div>
            </section>
          )}

          {/* Comunicación */}
          <section>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Comunicación</h3>
            <div className="bg-slate-50 rounded-xl px-4">
              <InfoRow icon={<FaPhone />} label="Teléfono principal" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : null} />
              <InfoRow icon={<FaPhone />} label="Teléfono secundario" value={contact.secondaryPhone} href={contact.secondaryPhone ? `tel:${contact.secondaryPhone}` : null} />
              <InfoRow icon={<FaEnvelope />} label="Email principal" value={contact.email} href={contact.email ? `mailto:${contact.email}` : null} />
              <InfoRow icon={<FaEnvelope />} label="Email secundario" value={contact.secondaryEmail} href={contact.secondaryEmail ? `mailto:${contact.secondaryEmail}` : null} />
              <InfoRow icon={<FaGlobe />} label="Sitio web" value={contact.website} href={contact.website} />
            </div>
          </section>

          {/* Ubicación */}
          {fullAddress && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ubicación</h3>
              <div className="bg-slate-50 rounded-xl px-4">
                <InfoRow icon={<FaMapMarkerAlt />} label="Dirección" value={fullAddress} />
              </div>
            </section>
          )}

          {/* Notas */}
          {contact.notes && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.notes}</p>
              </div>
            </section>
          )}

          {/* Tags */}
          {contact.tags?.length > 0 && (
            <section>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Etiquetas</h3>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                    <FaTag className="text-[10px]" />{tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Metadata */}
          {(contact.creator || contact.createdAt) && (
            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3 text-xs">
              {contact.creator && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Creado por</span>
                  <span className="text-slate-700">{contact.creator.name}</span>
                </div>
              )}
              {contact.updater && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Modificado por</span>
                  <span className="text-slate-700">{contact.updater.name}</span>
                </div>
              )}
              {contact.createdAt && (
                <div>
                  <span className="block text-slate-400 font-medium mb-0.5">Fecha creación</span>
                  <span className="text-slate-700">
                    {new Date(contact.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 bg-slate-50 flex justify-between items-center rounded-b-2xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors">
            Cerrar
          </button>
          {onEdit && (
            <button onClick={onEdit}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <FaEdit className="text-xs" /> Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactViewModal;

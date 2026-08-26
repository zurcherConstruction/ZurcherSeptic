import React, { useState, useEffect, useCallback, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FaPhone, FaEnvelope, FaMapMarkerAlt, FaStar, FaRegStar,
  FaPlus, FaEdit, FaTrash, FaGlobe, FaUser, FaEye,
} from 'react-icons/fa';
import { fetchContacts, deleteContact, toggleContactFavorite } from '../../Redux/Actions/knowledgeBaseActions';
import ContactModal from './ContactModal';
import ContactViewModal from './ContactViewModal';

const ContactList = memo(({ categoryId, searchQuery, showFavoritesOnly }) => {
  const dispatch = useDispatch();
  const contacts = useSelector(state => state.knowledgeBase.contacts);
  const loading  = useSelector(state => state.knowledgeBase.loading);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showModal,     setShowModal]     = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const load = useCallback(() => {
    const p = {};
    if (categoryId)       p.categoryId = categoryId;
    if (searchQuery)      p.search     = searchQuery;
    if (showFavoritesOnly) p.favorite  = 'true';
    dispatch(fetchContacts(p));
  }, [categoryId, searchQuery, showFavoritesOnly]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFavorite = id => dispatch(toggleContactFavorite(id));

  const handleDelete = async id => {
    if (!confirm('¿Eliminar este contacto?')) return;
    await dispatch(deleteContact(id));
    load();
  };

  const handleOpen  = (c = null) => { setSelectedContact(c); setIsEditing(!!c); setShowModal(true); };
  const handleClose = () => { setShowModal(false); setSelectedContact(null); setIsEditing(false); load(); };
  const handleView  = c  => { setSelectedContact(c); setShowViewModal(true); };
  const handleEditFromView = () => { setShowViewModal(false); setIsEditing(true); setShowModal(true); };

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Contactos</h3>
          {contacts.length > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{contacts.length} registros</p>
          )}
        </div>
        <button
          onClick={() => handleOpen()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
        >
          <FaPlus className="text-xs" /> Nuevo Contacto
        </button>
      </div>

      {/* Loading */}
      {loading && contacts.length === 0 && (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
        </div>
      )}

      {/* Empty */}
      {!loading && contacts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FaUser className="text-5xl mb-3 opacity-30" />
          <p className="font-medium text-slate-500">No hay contactos aún</p>
          <p className="text-sm mt-1">Agrega el primero con "Nuevo Contacto"</p>
        </div>
      )}

      {/* Cards grid */}
      {contacts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map(contact => (
            <div
              key={contact.id}
              className="group relative bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => handleView(contact)}
              style={contact.category?.color ? { borderLeftColor: contact.category.color, borderLeftWidth: 3 } : {}}
            >
              {/* Actions — top-right, visible on hover */}
              <div
                className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
              >
                <button onClick={() => handleToggleFavorite(contact.id)}
                  className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-500 transition-colors"
                  title={contact.isFavorite ? 'Quitar favorito' : 'Favorito'}>
                  {contact.isFavorite ? <FaStar className="text-amber-400 text-xs" /> : <FaRegStar className="text-xs" />}
                </button>
                <button onClick={() => handleView(contact)}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors" title="Ver">
                  <FaEye className="text-xs" />
                </button>
                <button onClick={() => handleOpen(contact)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                  <FaEdit className="text-xs" />
                </button>
                <button onClick={() => handleDelete(contact.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Eliminar">
                  <FaTrash className="text-xs" />
                </button>
              </div>

              {/* Name + badges */}
              <div className="pr-28 mb-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {contact.isFavorite && <FaStar className="text-amber-400 text-xs flex-shrink-0" />}
                  {contact.category?.icon && <span className="text-base flex-shrink-0">{contact.category.icon}</span>}
                  <h4 className="font-semibold text-slate-800 text-sm truncate">{contact.companyName || 'Sin nombre'}</h4>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {contact.contactType && (
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {contact.contactType}
                    </span>
                  )}
                  {contact.category?.name && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: (contact.category.color || '#3B82F6') + '20', color: contact.category.color || '#3B82F6' }}>
                      {contact.category.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Contact person */}
              {contact.contactPerson && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                  <FaUser className="text-slate-300 flex-shrink-0" />
                  <span className="truncate">{contact.contactPerson}</span>
                </div>
              )}

              {/* Phone */}
              {contact.phone && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                  <FaPhone className="text-slate-300 flex-shrink-0" />
                  <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate">{contact.phone}</a>
                </div>
              )}

              {/* Email */}
              {contact.email && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                  <FaEnvelope className="text-slate-300 flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate">{contact.email}</a>
                </div>
              )}

              {/* Address */}
              {contact.address && (
                <div className="flex items-start gap-2 text-xs text-slate-500 mb-1.5">
                  <FaMapMarkerAlt className="text-slate-300 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-1">
                    {[contact.address, contact.city, contact.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}

              {/* Website */}
              {contact.website && (
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                  <FaGlobe className="text-slate-300 flex-shrink-0" />
                  <a href={contact.website} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-blue-600 hover:underline truncate">{contact.website}</a>
                </div>
              )}

              {/* Notes preview */}
              {contact.notes && (
                <p className="mt-2 text-xs text-slate-400 italic line-clamp-1 border-t border-slate-100 pt-2">
                  "{contact.notes}"
                </p>
              )}

              {/* Tags */}
              {contact.tags?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {contact.tags.map((tag, i) => (
                    <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ContactModal contact={selectedContact} isEditing={isEditing} onClose={handleClose} defaultCategoryId={categoryId} />
      )}

      {showViewModal && selectedContact && (
        <ContactViewModal
          contact={selectedContact}
          onClose={() => { setShowViewModal(false); setSelectedContact(null); }}
          onEdit={handleEditFromView}
        />
      )}
    </div>
  );
});

ContactList.displayName = 'ContactList';
export default ContactList;

import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createSimpleWork,
  updateSimpleWork,
  fetchClientWorks,
  clearClientWorks,
} from '../../Redux/Actions/simpleWorkActions';
import { toast } from 'react-toastify';
import { FaTimes, FaSearch, FaLink } from 'react-icons/fa';

const CreateSimpleWorkModal = ({ isOpen, onClose, editingWork = null }) => {
  const dispatch = useDispatch();
  
  // Redux state
  const { 
    clientWorks, 
    loading 
  } = useSelector(state => state.simpleWork);

  // Form data state
  const [formData, setFormData] = useState({
    workType: 'culvert',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    description: '',
    totalCost: '',
    linkedWorkId: null,
    notes: '',
  });

  // UI state
  const [showWorkSearch, setShowWorkSearch] = useState(false);
  const [workSearchQuery, setWorkSearchQuery] = useState('');
  const [selectedLinkedWork, setSelectedLinkedWork] = useState(null);
  const [errors, setErrors] = useState({});

  // Initialize form when editing
  useEffect(() => {
    if (editingWork) {
      setFormData({
        workType: editingWork.workType || 'culvert',
        firstName: editingWork.firstName || '',
        lastName: editingWork.lastName || '',
        email: editingWork.email || '',
        phone: editingWork.phone || '',
        address: editingWork.address || '',
        city: editingWork.city || '',
        state: editingWork.state || '',
        zipCode: editingWork.zipCode || '',
        description: editingWork.description || '',
        totalCost: editingWork.totalCost || '',
        linkedWorkId: editingWork.linkedWorkId || null,
      });
      
      if (editingWork.linkedWork) {
        setSelectedLinkedWork(editingWork.linkedWork);
      }
    }
  }, [editingWork]);

  // Clear client works when modal closes
  useEffect(() => {
    if (!isOpen) {
      dispatch(clearClientWorks());
      setSelectedLinkedWork(null);
      setWorkSearchQuery('');
      setShowWorkSearch(false);
      setErrors({});
    }
  }, [isOpen, dispatch]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Search for client works
  const handleSearchWorks = async () => {
    if (!workSearchQuery.trim()) {
      toast.warning('Por favor ingresa criterios de búsqueda');
      return;
    }

    const searchCriteria = {
      search: workSearchQuery.trim()
    };

    try {
      await dispatch(fetchClientWorks(searchCriteria));
      if (clientWorks.length === 0) {
        toast.info('No se encontraron trabajos con esos criterios');
      }
    } catch (error) {
      toast.error('Error al buscar trabajos');
    }
  };

  // Link with existing work
  const handleLinkWork = (work) => {
    setSelectedLinkedWork(work);
    setFormData(prev => ({
      ...prev,
      firstName: work.firstName || prev.firstName,
      lastName: work.lastName || prev.lastName,
      email: work.email || prev.email,
      phone: work.phone || prev.phone,
      address: work.address || prev.address,
      city: work.city || prev.city,
      state: work.state || prev.state,
      zipCode: work.zipCode || prev.zipCode,
      linkedWorkId: work.id,
    }));
    setShowWorkSearch(false);
    dispatch(clearClientWorks());
    toast.success('Datos del trabajo vinculado cargados exitosamente');
  };

  // Unlink work
  const handleUnlinkWork = () => {
    setSelectedLinkedWork(null);
    setFormData(prev => ({
      ...prev,
      linkedWorkId: null,
    }));
    toast.info('Trabajo desvinculado');
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.workType.trim()) {
      newErrors.workType = 'El tipo de trabajo es requerido';
    }

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'El nombre es requerido';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'El apellido es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'El email no es válido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'La dirección es requerida';
    }

    if (!formData.totalCost.trim()) {
      newErrors.totalCost = 'El costo total es requerido';
    } else if (isNaN(parseFloat(formData.totalCost)) || parseFloat(formData.totalCost) <= 0) {
      newErrors.totalCost = 'El costo total debe ser un número válido mayor a 0';
    }

    return newErrors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Construir el objeto clientData
      const clientData = {
        name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        zipCode: formData.zipCode.trim()
      };

      const workData = {
        workType: formData.workType,
        propertyAddress: formData.address.trim(), // El backend espera propertyAddress
        clientData: clientData, // Objeto completo de datos del cliente
        description: formData.description.trim(),
        estimatedAmount: parseFloat(formData.totalCost), // El backend espera estimatedAmount
        linkedWorkId: formData.linkedWorkId || null,
        notes: formData.notes || ''
      };

      if (editingWork) {
        await dispatch(updateSimpleWork(editingWork.id, workData));
        toast.success('Trabajo actualizado exitosamente');
      } else {
        await dispatch(createSimpleWork(workData));
        toast.success('Trabajo creado exitosamente');
      }
      
      onClose();
    } catch (error) {
      // Error is handled by Redux action and displayed via toast
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      workType: 'culvert',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      description: '',
      totalCost: '',
      linkedWorkId: null,
    });
    setErrors({});
    setSelectedLinkedWork(null);
    setShowWorkSearch(false);
    setWorkSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            {editingWork ? 'Editar Trabajo Simple' : 'Crear Nuevo Trabajo Simple'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FaTimes size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            
            {/* Work Linking Section */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-blue-800">Vincular con Trabajo Existente</h3>
                <button
                  type="button"
                  onClick={() => setShowWorkSearch(!showWorkSearch)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors"
                >
                  <FaSearch />
                  <span>Buscar Trabajos</span>
                </button>
              </div>
              
              {selectedLinkedWork && (
                <div className="bg-green-100 p-3 rounded-md flex justify-between items-center">
                  <div>
                    <p className="font-medium text-green-800">
                      Vinculado con: {selectedLinkedWork.firstName} {selectedLinkedWork.lastName}
                    </p>
                    <p className="text-green-600 text-sm">{selectedLinkedWork.address}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkWork}
                    className="text-red-600 hover:text-red-800"
                  >
                    <FaTimes />
                  </button>
                </div>
              )}

              {showWorkSearch && (
                <div className="mt-3 space-y-3">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={workSearchQuery}
                      onChange={(e) => setWorkSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, apellido, email, dirección..."
                      className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSearchWorks}
                      disabled={loading}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                    >
                      {loading ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  
                  {clientWorks.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md">
                      {clientWorks.map((work) => (
                        <div
                          key={work.id}
                          className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                          onClick={() => handleLinkWork(work)}
                        >
                          <div>
                            <p className="font-medium">{work.firstName} {work.lastName}</p>
                            <p className="text-gray-600 text-sm">{work.email}</p>
                            <p className="text-gray-500 text-xs">{work.address}</p>
                          </div>
                          <FaLink className="text-blue-500" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Work Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Trabajo *
                </label>
                <select
                  name="workType"
                  value={formData.workType}
                  onChange={handleInputChange}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                    errors.workType 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                >
                  <option value="culvert">Culvert</option>
                  <option value="drainfield">Drainfield</option>
                  <option value="repair">Reparación</option>
                  <option value="abandonment">Abandono</option>
                  <option value="modification">Modificación</option>
                  <option value="pumping">Desagote</option>
                  <option value="replacement">Reemplazo</option>
                  <option value="plumbing">Plomería</option>
                  <option value="inspection">Inspección</option>
                  <option value="installation">Instalación</option>
                  <option value="maintenance">Mantenimiento</option>
                  <option value="other">Otro</option>
                </select>
                {errors.workType && (
                  <p className="text-red-500 text-xs mt-1">{errors.workType}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Costo Total *
                </label>
                <input
                  type="number"
                  name="totalCost"
                  step="0.01"
                  min="0"
                  value={formData.totalCost}
                  onChange={handleInputChange}
                  className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                    errors.totalCost 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="0.00"
                />
                {errors.totalCost && (
                  <p className="text-red-500 text-xs mt-1">{errors.totalCost}</p>
                )}
              </div>
            </div>

            {/* Client Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Información del Cliente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                      errors.firstName 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Nombre del cliente"
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                      errors.lastName 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="Apellido del cliente"
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                      errors.email 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="email@example.com"
                  />
                  {errors.email && (
                    <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                      errors.phone 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Dirección</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección *
                  </label>
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-1 ${
                      errors.address 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    placeholder="123 Main Street"
                  />
                  {errors.address && (
                    <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Ciudad"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Estado"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción del Trabajo
              </label>
              <textarea
                name="description"
                rows={4}
                value={formData.description}
                onChange={handleInputChange}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe los detalles del trabajo a realizar..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-4 p-6 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : (editingWork ? 'Actualizar' : 'Crear')} Trabajo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateSimpleWorkModal;
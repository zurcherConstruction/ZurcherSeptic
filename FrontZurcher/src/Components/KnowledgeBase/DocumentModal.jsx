import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaTimes, FaPlus, FaTimes as FaTimesCircle, FaCloudUploadAlt, FaFilePdf, FaFileImage, FaTrash, FaFileWord, FaFileExcel, FaEye } from 'react-icons/fa';
import { createDocument, updateDocument } from '../../Redux/Actions/knowledgeBaseActions';
import api from '../../utils/axios';
import FilePreviewModal from './FilePreviewModal';

const DocumentModal = ({ document, isEditing, onClose, defaultCategoryId }) => {
  const dispatch = useDispatch();
  const categories = useSelector((state) => state.knowledgeBase.categories);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    categoryId: defaultCategoryId || '',
    title: '',
    description: '',
    fileType: 'PDF',
    tags: []
  });
  const [uploadedFiles, setUploadedFiles] = useState([]); // Archivos ya subidos a Cloudinary
  const [selectedFiles, setSelectedFiles] = useState([]); // Archivos seleccionados para subir
  const [tagInput, setTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (document) {
      setFormData({
        categoryId: document.categoryId || '',
        title: document.title || '',
        description: document.description || '',
        fileType: document.fileType || 'PDF',
        tags: document.tags || []
      });
      
      // Parsear archivos existentes
      if (document.fileUrl) {
        try {
          const files = typeof document.fileUrl === 'string' 
            ? JSON.parse(document.fileUrl) 
            : document.fileUrl;
          setUploadedFiles(Array.isArray(files) ? files : [{ url: files }]);
        } catch (e) {
          setUploadedFiles([{ url: document.fileUrl }]);
        }
      }
    } else {
      // RESET: Limpiar formulario cuando NO hay documento (crear nuevo)
      setFormData({
        categoryId: defaultCategoryId || '',
        title: '',
        description: '',
        fileType: 'PDF',
        tags: []
      });
      setUploadedFiles([]);
      setSelectedFiles([]);
      setTagInput('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [document, defaultCategoryId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeUploadedFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToCloudinary = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await api.post('/knowledge-base/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (!response.data || !response.data.files) {
        throw new Error('La respuesta del servidor no tiene el formato esperado');
      }

      setUploadedFiles(prev => [...prev, ...response.data.files]);
      setSelectedFiles([]); // Limpiar archivos seleccionados
      
      // Limpiar el input file usando ref
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ Error al subir archivos:', error);
      alert(`Error al subir archivos: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const getFileIcon = (file) => {
    const format = file.format?.toLowerCase() || file.type?.split('/')[1] || file.name?.split('.').pop()?.toLowerCase();
    
    if (format === 'pdf') {
      return <FaFilePdf className="text-red-500 text-2xl" />;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'image'].includes(format)) {
      return <FaFileImage className="text-blue-500 text-2xl" />;
    } else if (['doc', 'docx'].includes(format)) {
      return <FaFileWord className="text-blue-600 text-2xl" />;
    } else if (['xls', 'xlsx'].includes(format)) {
      return <FaFileExcel className="text-green-600 text-2xl" />;
    }
    return <FaFilePdf className="text-gray-500 text-2xl" />;
  };

  const isImage = (file) => {
    if (file.type) {
      return file.type.startsWith('image/');
    }
    const format = file.format?.toLowerCase() || file.url?.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(format);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getPreviewUrl = (file) => {
    if (file.url) return file.url; // Ya subido a Cloudinary
    if (file instanceof File) return URL.createObjectURL(file); // Archivo local
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validaciones
    if (!formData.title.trim()) {
      alert('El título es obligatorio');
      return;
    }
    if (uploadedFiles.length === 0 && selectedFiles.length === 0) {
      alert('Debes subir al menos un archivo');
      return;
    }

    // Si hay archivos pendientes, subirlos primero
    if (selectedFiles.length > 0) {
      alert('Debes hacer clic en "Subir archivos" antes de guardar');
      return;
    }

    const dataToSend = {
      ...formData,
      fileUrl: JSON.stringify(uploadedFiles),
      fileSize: uploadedFiles.reduce((acc, file) => acc + (file.size || 0), 0)
    };

    try {
      if (isEditing) {
        await dispatch(updateDocument(document.id, dataToSend));
      } else {
        await dispatch(createDocument(dataToSend));
      }
      onClose();
    } catch (error) {
      console.error('Error guardando documento:', error);
      alert('Error al guardar el documento');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800">
              {isEditing ? 'Editar Documento' : 'Nuevo Documento'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
            >
              <FaTimes className="text-xl sm:text-2xl" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría *
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar categoría</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Título del Documento *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Ej: Manual de inspecciones 2024"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Breve descripción del contenido del documento..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Subir Archivos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Archivos * (PDFs, Imágenes, etc.)
              </label>
              
              <div className="space-y-3">
                {/* Input File */}
                <label
                  htmlFor="file-input"
                  className="w-full px-4 sm:px-6 py-3 sm:py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all flex flex-col items-center space-y-1 sm:space-y-2"
                >
                  <FaCloudUploadAlt className="text-3xl sm:text-4xl text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-700 text-center">
                    Click para seleccionar archivos
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-500 text-center px-2">
                    PDFs, imágenes (JPG, PNG), Excel, Word - Máximo 10MB por archivo
                  </span>
                </label>
                <input
                  id="file-input"
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Archivos Seleccionados (pendientes de subir) */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm font-medium text-gray-700">
                        Archivos seleccionados ({selectedFiles.length}):
                      </p>
                      <button
                        type="button"
                        onClick={uploadFilesToCloudinary}
                        disabled={isUploading}
                        className={`w-full sm:w-auto px-4 py-2 rounded-lg text-white text-xs sm:text-sm flex items-center justify-center space-x-2 ${
                          isUploading
                            ? 'bg-blue-300 cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <FaCloudUploadAlt />
                        <span>{isUploading ? 'Subiendo...' : 'Subir archivos'}</span>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="border border-yellow-200 bg-yellow-50 rounded-lg p-2 sm:p-3 flex items-start space-x-2 sm:space-x-3"
                        >
                          {/* Preview o Icono */}
                          <div className="flex-shrink-0">
                            {isImage(file) ? (
                              <img
                                src={getPreviewUrl(file)}
                                alt={file.name}
                                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded"
                              />
                            ) : (
                              <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-white rounded">
                                {getFileIcon(file)}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                              {file.name}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              {formatBytes(file.size)}
                            </p>
                            <span className="text-[10px] sm:text-xs text-yellow-600 font-medium">
                              Pendiente de subir
                            </span>
                          </div>

                          {/* Botón eliminar */}
                          <button
                            type="button"
                            onClick={() => removeSelectedFile(index)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Archivos Ya Subidos */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm font-medium text-green-700">
                      ✓ Archivos subidos ({uploadedFiles.length}):
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="border border-green-200 bg-green-50 rounded-lg p-2 sm:p-3 flex items-start space-x-2 sm:space-x-3"
                        >
                          {/* Preview o Icono */}
                          <div className="flex-shrink-0 cursor-pointer" onClick={() => setPreviewFile(file)}>
                            {isImage(file) ? (
                              <img
                                src={file.url}
                                alt={file.originalFilename || 'Preview'}
                                className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded hover:opacity-80"
                              />
                            ) : (
                              <div className="w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center bg-white rounded hover:bg-gray-50">
                                {getFileIcon(file)}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                              {file.originalFilename || `Archivo ${index + 1}`}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              {file.format?.toUpperCase()} • {formatBytes(file.size)}
                            </p>
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="text-[10px] sm:text-xs text-blue-600 hover:text-blue-700 flex items-center space-x-1 mt-1"
                            >
                              <FaEye size={10} className="sm:w-3 sm:h-3" />
                              <span>Vista previa</span>
                            </button>
                          </div>

                          {/* Botón eliminar */}
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(index)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          >
                            <FaTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Etiquetas
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Agregar etiqueta..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FaPlus />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm flex items-center space-x-2"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FaTimesCircle size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isUploading || (uploadedFiles.length === 0 && selectedFiles.length === 0)}
                className="w-full sm:w-auto px-6 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                {isEditing ? 'Guardar Cambios' : 'Crear Documento'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Preview */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </>
  );
};

export default DocumentModal;

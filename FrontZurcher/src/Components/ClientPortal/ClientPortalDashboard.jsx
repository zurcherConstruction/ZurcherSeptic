import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaHome, FaFileContract, FaImages, FaClipboardList, 
  FaPhone, FaEnvelope, FaCalendarAlt, FaDollarSign,
  FaCheckCircle, FaClock, FaExclamationTriangle, FaTools, FaSpinner,
  FaFileAlt, FaFileSignature, FaInfoCircle
} from 'react-icons/fa';
import { XMarkIcon } from '@heroicons/react/24/outline';
import SEOHelmet from '../SEO/SEOHelmet';
import PdfModal from '../Budget/PdfModal';

// URL de la API desde variables de entorno
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const ClientPortalDashboard = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [works, setWorks] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedWork, setSelectedWork] = useState(null); // New state for selected work detail view
  const [workDocuments, setWorkDocuments] = useState(null);
  const [workPhotos, setWorkPhotos] = useState(null);
  const [workReceipts, setWorkReceipts] = useState(null);
  
  // Modal states
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState('');
  const [selectedPdfTitle, setSelectedPdfTitle] = useState('');
  const [selectedContentType, setSelectedContentType] = useState('pdf'); // 'pdf' o 'image'
  const [selectedImage, setSelectedImage] = useState(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [currentPhotos, setCurrentPhotos] = useState([]);
  const [loadingPdf, setLoadingPdf] = useState(false);

  // Work status labels in English for client portal
  //  ALIGNED WITH PROGRESSTRACKER: States map to same steps as ProgressTracker
  const workStatusLabels = {
    pending: { label: 'Pending Assignment', color: 'bg-gray-500', icon: FaClock, step: 0 },
    assigned: { label: 'Purchase in Progress', color: 'bg-blue-500', icon: FaTools, step: 1 },
    inProgress: { label: 'Installing', color: 'bg-yellow-500', icon: FaTools, step: 2 },
    installed: { label: 'Inspection Pending', color: 'bg-orange-500', icon: FaClipboardList, step: 3 },
    firstInspectionPending: { label: 'Inspection Pending', color: 'bg-orange-500', icon: FaClipboardList, step: 3 },
    approvedInspection: { label: 'Inspection Pending', color: 'bg-green-400', icon: FaCheckCircle, step: 3 },
    rejectedInspection: { label: 'Inspection Pending', color: 'bg-orange-500', icon: FaClipboardList, step: 3 },
    coverPending: { label: 'Cover Pending', color: 'bg-purple-500', icon: FaTools, step: 4 },
    covered: { label: 'Cover Pending', color: 'bg-purple-500', icon: FaTools, step: 4 },
    invoiceFinal: { label: 'Final Payment Pending', color: 'bg-indigo-500', icon: FaDollarSign, step: 5 },
    paymentReceived: { label: 'Final Inspection Pending', color: 'bg-blue-400', icon: FaClipboardList, step: 6 },
    finalInspectionPending: { label: 'Final Inspection Pending', color: 'bg-blue-400', icon: FaClipboardList, step: 6 },
    finalRejected: { label: 'Final Inspection Pending', color: 'bg-orange-500', icon: FaClipboardList, step: 6 },
    finalApproved: { label: 'Work Completed', color: 'bg-green-600', icon: FaCheckCircle, step: 7 },
    maintenance: { label: 'Work Completed', color: 'bg-green-600', icon: FaCheckCircle, step: 7 }
  };

  // Progress steps for visual tracker (showing consecutive numbers 1-7 to client)
  // ✅ ALIGNED WITH PROGRESSTRACKER
  const progressSteps = [
    { id: 1, label: 'Purchase in Progress', status: 'assigned' },
    { id: 2, label: 'Installing', status: 'inProgress' },
    { id: 3, label: 'Inspection Pending', status: 'installed' },
    { id: 4, label: 'Cover Pending', status: 'coverPending' },
    { id: 5, label: 'Final Payment Pending', status: 'invoiceFinal' },
    { id: 6, label: 'Final Inspection Pending', status: 'paymentReceived' },
    { id: 7, label: 'Work Completed', status: 'maintenance' }
  ];

  // Cargar información del cliente
  useEffect(() => {
    fetchClientInfo();
    fetchClientWorks();
  }, [token]);

  const fetchClientInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/client-portal/${token}/info`);
      const data = await response.json();
      
      if (data.success) {
        setClientInfo(data.data);
      } else {
        setError('Invalid or expired token');
      }
    } catch (error) {
      console.error('Error fetching client info:', error);
      setError('Error loading client information');
    }
  };

  const fetchClientWorks = async () => {
    try {
      const response = await fetch(`${API_URL}/client-portal/${token}/works`);
      const data = await response.json();
      
      if (data.success) {
        setWorks(data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching works:', error);
      setError('Error loading projects');
      setLoading(false);
    }
  };

  // Handle work selection for detailed view
  const selectWork = (work) => {
    setSelectedWork(work);
    setActiveTab('project-detail');
    // Load work-specific data
    loadWorkDocuments(work.idWork);
    loadWorkPhotos(work.idWork);
    loadWorkReceipts(work.idWork);
  };

  const goBackToProjects = () => {
    setSelectedWork(null);
    setActiveTab('projects');
    // Clear work-specific data
    setWorkDocuments(null);
    setWorkPhotos(null);
    setWorkReceipts(null);
  };

  // Load work documents
  const loadWorkDocuments = async (workId) => {
    try {
      const response = await fetch(`${API_URL}/client-portal/${token}/work/${workId}/documents`);
      const data = await response.json();
      if (data.success) {
        setWorkDocuments(data.data);
      }
    } catch (error) {
      console.error('Error loading work documents:', error);
    }
  };

  // Load work photos
  const loadWorkPhotos = async (workId) => {
    try {
      const response = await fetch(`${API_URL}/client-portal/${token}/work/${workId}/photos`);
      const data = await response.json();
      if (data.success) {
        setWorkPhotos(data.data);
      }
    } catch (error) {
      console.error('Error loading work photos:', error);
    }
  };

  // Load work receipts
  const loadWorkReceipts = async (workId) => {
    try {
      const response = await fetch(`${API_URL}/client-portal/${token}/work/${workId}/receipts`);
      const data = await response.json();
      if (data.success) {
        setWorkReceipts(data.data);
      }
    } catch (error) {
      console.error('Error loading work receipts:', error);
    }
  };

  // Handle document viewing
  const viewDocument = async (documentType) => {
    if (!workDocuments || !selectedWork) return;
    
    setLoadingPdf(true);
    
    // Limpiar URL anterior si existe
    if (selectedPdfUrl && selectedPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(selectedPdfUrl);
    }
    
    try {
      switch (documentType) {
        case 'signedBudget':
          if (workDocuments.signedBudget.available && workDocuments.signedBudget.budgetId) {
            // Siempre usar endpoint del backend (maneja tanto Cloudinary como local)
            console.log('🔍 Loading signed budget through backend proxy');
            
            const response = await fetch(`${API_URL}/client-portal/${token}/pdf/signed-budget/${workDocuments.signedBudget.budgetId}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/pdf',
              },
              credentials: 'include'
            });
            
            console.log('📋 Budget Response status:', response.status);
            console.log('📋 Budget Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (response.ok) {
              const blob = await response.blob();
              console.log('📄 Budget Blob size:', blob.size, 'type:', blob.type);
              const objectUrl = URL.createObjectURL(blob);
              console.log('🔗 Budget Object URL created:', objectUrl);
              setSelectedPdfUrl(objectUrl);
              setSelectedPdfTitle('Signed Budget');
              setSelectedContentType(blob.type.startsWith('image/') ? 'image' : 'pdf');
              setShowPdfModal(true);
            } else {
              console.error('❌ Error response:', await response.text());
              alert('Error loading signed budget PDF');
            }
          } else {
            alert('Signed budget not available yet.');
          }
          break;
          
        case 'permit':
          if (workDocuments.operationPermit.available && workDocuments.operationPermit.url) {
            console.log('🔍 Loading operation permit via blob endpoint from:', 
              `${API_URL}${workDocuments.operationPermit.url}`);
            
            const response = await fetch(`${API_URL}${workDocuments.operationPermit.url}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/pdf',
              },
              credentials: 'include'
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              console.log('🔗 Operation Permit Object URL created:', objectUrl);
              setSelectedPdfUrl(objectUrl);
              setSelectedPdfTitle('Operation Permit');
              setSelectedContentType(blob.type.startsWith('image/') ? 'image' : 'pdf');
              setShowPdfModal(true);
            } else {
              console.error('❌ Error response:', await response.text());
              alert('Error loading operation permit PDF');
            }
          } else {
            alert('Operation permit not available yet.');
          }
          break;
          
        case 'maintenance':
          if (workDocuments.maintenanceService.available && workDocuments.maintenanceService.url) {
            console.log('🔍 Loading maintenance service via blob endpoint from:', 
              `${API_URL}${workDocuments.maintenanceService.url}`);
            
            const response = await fetch(`${API_URL}${workDocuments.maintenanceService.url}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/pdf',
              },
              credentials: 'include'
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              console.log('🔗 Maintenance Service Object URL created:', objectUrl);
              setSelectedPdfUrl(objectUrl);
              setSelectedPdfTitle('Maintenance Service');
              setSelectedContentType(blob.type.startsWith('image/') ? 'image' : 'pdf');
              setShowPdfModal(true);
            } else {
              console.error('❌ Error response:', await response.text());
              alert('Error loading maintenance service PDF');
            }
          } else {
            alert('Maintenance service documentation not available yet.');
          }
          break;
          
        case 'extra':
          if (workDocuments.extraDocument.available && workDocuments.extraDocument.url) {
            console.log('🔍 Loading extra document via blob endpoint from:', 
              `${API_URL}${workDocuments.extraDocument.url}`);
            
            const response = await fetch(`${API_URL}${workDocuments.extraDocument.url}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/pdf,image/*',
              },
              credentials: 'include'
            });
            
            if (response.ok) {
              const blob = await response.blob();
              const objectUrl = URL.createObjectURL(blob);
              console.log('🔗 Extra Document Object URL created:', objectUrl);
              console.log('📎 Extra Document MIME type:', blob.type);
              setSelectedPdfUrl(objectUrl);
              setSelectedPdfTitle('Additional Document');
              setSelectedContentType(blob.type.startsWith('image/') ? 'image' : 'pdf');
              setShowPdfModal(true);
            } else {
              console.error('❌ Error response:', await response.text());
              alert('Error loading extra document');
            }
          } else {
            alert('Extra document not available.');
          }
          break;
          
        case 'finalInvoice':
          if (workDocuments.finalInvoice.available) {
            // Si hay FinalInvoice generado, usar el endpoint de preview
            if (workDocuments.finalInvoice.hasFinalInvoice && workDocuments.finalInvoice.finalInvoiceId) {
              console.log('🔍 Loading generated final invoice via blob endpoint from:', 
                `${API_URL}/client-portal/${token}/work/${selectedWork.idWork}/pdf/final-invoice-generated/${workDocuments.finalInvoice.finalInvoiceId}`);
              
              const response = await fetch(`${API_URL}/client-portal/${token}/work/${selectedWork.idWork}/pdf/final-invoice-generated/${workDocuments.finalInvoice.finalInvoiceId}`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/pdf',
                },
                credentials: 'include'
              });
              
              console.log('📋 Response status:', response.status);
              console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
              
              if (response.ok) {
                const blob = await response.blob();
                console.log('📄 Blob size:', blob.size, 'type:', blob.type);
                const objectUrl = URL.createObjectURL(blob);
                console.log('🔗 Object URL created:', objectUrl);
                setSelectedPdfUrl(objectUrl);
                setSelectedPdfTitle(`Final Invoice #${workDocuments.finalInvoice.invoiceNumber}`);
                setSelectedContentType(blob.type.startsWith('image/') ? 'image' : 'pdf');
                setShowPdfModal(true);
              } else {
                console.error('❌ Error response:', await response.text());
                alert('Error loading final invoice PDF');
              }
            } else {
              // Fallback: No hay FinalInvoice generado aún
              alert('Final invoice not generated yet. Coming soon.');
            }
          } else {
            alert('Final invoice not available yet. Coming soon.');
          }
          break;
          
        default:
          alert('Document type not recognized.');
      }
    } catch (error) {
      console.error('Error loading document:', error);
      alert('Error loading document. Please try again.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Handle photo gallery viewing
  const viewPhotos = (photoType) => {
    if (!workPhotos) return;
    
    const photos = photoType === 'installation' ? workPhotos.installation : workPhotos.cover;
    
    if (photos && photos.length > 0) {
      setCurrentPhotos(photos);
      setCurrentPhotoIndex(0);
      setShowPhotoGallery(true);
    } else {
      alert(`No ${photoType} photos available yet.`);
    }
  };

  // Navigate photo gallery
  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => 
      prev < currentPhotos.length - 1 ? prev + 1 : 0
    );
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => 
      prev > 0 ? prev - 1 : currentPhotos.length - 1
    );
  };

  // Close photo gallery
  const closePhotoGallery = () => {
    setShowPhotoGallery(false);
    setCurrentPhotos([]);
    setCurrentPhotoIndex(0);
  };

  // Handle PPI signature
  const handlePPISign = async () => {
    if (!selectedWork) return;
    
    try {
      setLoadingPdf(true);
      console.log('🔗 === INICIANDO PROCESO PPI ===');
      console.log('Work ID:', selectedWork.idWork);
      
      const response = await fetch(`${API_URL}/client-portal/${token}/ppi-sign/${selectedWork.idWork}`);
      console.log('Response status:', response.status);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        if (data.data.isSigned) {
          console.log('✅ PPI ya está firmado - cargando PDF');
          // Documento ya firmado - cargar el PDF firmado desde el backend
          if (data.data.signedPdfUrl) {
            console.log('📄 Loading signed PPI through backend proxy');
            const blobResponse = await fetch(`${API_URL}/client-portal/${token}/work/${selectedWork.idWork}/pdf/ppi-signed`, {
              method: 'GET',
              headers: {
                'Accept': 'application/pdf',
              },
              credentials: 'include'
            });
            
            console.log('📋 PPI Response status:', blobResponse.status);
            
            if (blobResponse.ok) {
              const blob = await blobResponse.blob();
              console.log('📄 PPI Blob size:', blob.size, 'type:', blob.type);
              const objectUrl = URL.createObjectURL(blob);
              setSelectedPdfUrl(objectUrl);
              setSelectedPdfTitle('PPI Document - Signed');
              setSelectedContentType(blob.type.startsWith('image/') ? 'image' : 'pdf');
              setShowPdfModal(true);
            } else {
              console.error('❌ Error response:', await blobResponse.text());
              alert('Error loading signed PPI document. Please try again or contact support.');
            }
          } else {
            alert('PPI document is signed but file is not available. Please contact support.');
          }
        } else if (data.data.notSentYet) {
          console.log('⚠️ PPI no enviado aún');
          // Documento no enviado aún
          alert(data.data.message || 'PPI document has not been sent for signature yet. Please contact support.');
        } else {
          console.log('🔗 Abriendo DocuSign para firma');
          // Documento NO firmado - abrir enlace de DocuSign en nueva pestaña
          if (data.data.signUrl) {
            console.log('✅ Signing URL:', data.data.signUrl.substring(0, 80) + '...');
            console.log('📧 Client Email:', data.data.clientEmail);
            console.log('📋 Envelope ID:', data.data.envelopeId);
            
            // Abrir en nueva pestaña
            const newWindow = window.open(data.data.signUrl, '_blank');
            
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
              // El popup fue bloqueado
              alert('Pop-up blocked. Please allow pop-ups for this site to sign the PPI document, or copy this link: ' + data.data.signUrl);
            } else {
              console.log('✅ DocuSign window opened successfully');
              // Opcional: Mostrar mensaje de éxito
              alert('DocuSign signing page opened in a new tab. Please complete the signature process there.');
            }
          } else {
            console.error('❌ No signUrl in response');
            alert('Signature link not available. Please contact support.');
          }
        }
      } else {
        console.error('❌ Request failed:', data.message);
        alert(data.message || 'Error accessing PPI document. Please contact support.');
      }
    } catch (error) {
      console.error('❌ Error accessing PPI signature:', error);
      alert('Error accessing PPI signature link. Please check your connection and try again.');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Format image date and time
  const formatImageDateTime = (dateTimeString) => {
    if (!dateTimeString || dateTimeString === 'null' || dateTimeString === 'undefined') return "No date";
    
    try {
      const date = new Date(dateTimeString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return "No date";
      }
      
      // Format as MM-DD-YYYY HH:MM AM/PM
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 hours should be 12
      
      return `${month}-${day}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      console.error('Error formatting image dateTime:', dateTimeString, error);
      return "No date";
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not defined';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };

  const getProgressPercentage = (status) => {
    const statusInfo = workStatusLabels[status];
    if (!statusInfo || statusInfo.step === 0) return 0;
    
    // ✅ 7 pasos visuales (1-7), alineados con ProgressTracker
    return (statusInfo.step / 7) * 100;
  };

  // Get current step for visual tracker
  // ✅ ALIGNED WITH PROGRESSTRACKER
  const getCurrentStep = (status) => {
    const statusInfo = workStatusLabels[status];
    if (!statusInfo || statusInfo.step === 0) return 0;
    
    return statusInfo.step;
  };

  // Progress Tracker Component
  const ProgressTracker = ({ currentStatus }) => {
    const currentStep = getCurrentStep(currentStatus);
    
    return (
      <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl shadow-md p-4 lg:p-6 mb-6 border border-slate-200">
        <h3 className="text-base lg:text-lg font-semibold text-slate-800 mb-4 lg:mb-6">Project Progress</h3>
        
        {/* Desktop/Tablet: Horizontal Layout */}
        <div className="hidden md:block">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-7 left-0 right-0 h-1 bg-slate-200 rounded-full mx-8">
              <div 
                className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                style={{ width: `${Math.max(0, (currentStep - 1) / (progressSteps.length - 1) * 100)}%` }}
              ></div>
            </div>
            
            {/* Steps */}
            <div className="flex justify-between items-start relative z-10">
              {progressSteps.map((step, index) => {
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                const isUpcoming = currentStep < step.id;
                
                return (
                  <div key={step.id} className="flex flex-col items-center w-20 lg:w-24">
                    {/* Step Circle */}
                    <div className={`
                      w-14 h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center text-sm lg:text-base font-bold transition-all duration-300 shadow-lg
                      ${
                        isCompleted 
                          ? 'bg-gradient-to-br from-green-400 to-green-600 text-white scale-110 ring-4 ring-green-200' 
                          : isCurrent 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white scale-110 ring-4 ring-blue-300 animate-pulse' 
                          : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500 shadow-inner'
                      }
                    `}>
                      {isCompleted ? (
                        <FaCheckCircle className="text-xl lg:text-2xl" />
                      ) : (
                        step.id
                      )}
                    </div>
                    
                    {/* Step Label */}
                    <div className="mt-3 text-center">
                      <p className={`text-xs lg:text-sm font-semibold leading-tight ${
                        isCompleted || isCurrent 
                          ? 'text-slate-800' 
                          : 'text-slate-500'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile: Vertical Layout */}
        <div className="md:hidden">
          <div className="relative">
            {/* Vertical Progress Line */}
            <div className="absolute top-0 bottom-0 left-6 w-1 bg-slate-200 rounded-full">
              <div 
                className="w-full bg-gradient-to-b from-green-400 to-green-600 rounded-full transition-all duration-1000 ease-out shadow-sm"
                style={{ height: `${Math.max(0, (currentStep - 1) / (progressSteps.length - 1) * 100)}%` }}
              ></div>
            </div>
            
            {/* Steps */}
            <div className="flex flex-col space-y-4 relative z-10">
              {progressSteps.map((step, index) => {
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;
                const isUpcoming = currentStep < step.id;
                
                return (
                  <div key={step.id} className="flex items-center">
                    {/* Step Circle */}
                    <div className={`
                      flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shadow-lg
                      ${
                        isCompleted 
                          ? 'bg-gradient-to-br from-green-400 to-green-600 text-white ring-4 ring-green-200' 
                          : isCurrent 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-4 ring-blue-300 animate-pulse' 
                          : 'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500 shadow-inner'
                      }
                    `}>
                      {isCompleted ? (
                        <FaCheckCircle className="text-lg" />
                      ) : (
                        step.id
                      )}
                    </div>
                    
                    {/* Step Label */}
                    <div className="ml-4 flex-1">
                      <p className={`text-sm font-semibold ${
                        isCompleted || isCurrent 
                          ? 'text-slate-800' 
                          : 'text-slate-500'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center relative overflow-hidden">
        {/* Background Watermark */}
        <div className="fixed inset-0 pointer-events-none opacity-5">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <img 
              src="/logo.png" 
              alt="Zurcher Septic"
              className="w-96 h-96 md:w-[600px] md:h-[600px] object-contain"
            />
          </div>
        </div>
        <div className="text-center relative z-10 bg-white/80 backdrop-blur-sm p-8 lg:p-12 rounded-2xl shadow-2xl border border-slate-200">
          <div className="mb-6">
            <img src="/logo.png" alt="Zurcher Septic Logo" className="h-16 w-auto mx-auto" />
          </div>
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-6"></div>
          <p className="text-slate-700 text-lg font-semibold">Loading your portal...</p>
          <p className="text-slate-500 text-sm mt-2">Please wait a moment</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 flex items-center justify-center relative overflow-hidden p-4">
        {/* Background Watermark */}
        <div className="fixed inset-0 pointer-events-none opacity-5">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <img 
              src="/logo.png" 
              alt="Zurcher Septic"
              className="w-96 h-96 md:w-[600px] md:h-[600px] object-contain"
            />
          </div>
        </div>
        <div className="text-center max-w-md mx-auto bg-white/90 backdrop-blur-sm p-8 lg:p-12 rounded-2xl shadow-2xl border border-red-200 relative z-10">
          <div className="mb-6">
            <img src="/logo.png" alt="Zurcher Septic Logo" className="h-16 w-auto mx-auto mb-4" />
          </div>
          <FaExclamationTriangle className="text-red-500 text-6xl mx-auto mb-6" />
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-4">Unauthorized Access</h1>
          <p className="text-slate-600 mb-6 leading-relaxed">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl transition-all shadow-lg hover:shadow-xl font-semibold"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHelmet 
        title={`Portal del Cliente - ${clientInfo?.name || 'Zurcher Septic'}`}
        description="Portal privado para seguimiento de proyectos de sistemas sépticos"
        canonicalUrl={`https://zurcherseptic.com/client-portal/${token}`}
      />
      
      {/* Background with Watermark Logo */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 relative overflow-hidden">
        {/* Watermark Background */}
        <div className="fixed inset-0 pointer-events-none opacity-5 z-0">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <img 
              src="/logo.png" 
              alt="Zurcher Septic"
              className="w-96 h-96 md:w-[600px] md:h-[600px] object-contain"
            />
          </div>
        </div>
        
        {/* Main Content Container */}
        <div className="relative z-10">
        {/* Professional Header */}
        <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 text-white shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              {/* Logo and Title */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white rounded-lg p-2 shadow-lg flex-shrink-0">
                  <img 
                    src="/logo.png" 
                    alt="Zurcher Septic Logo" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-center lg:text-left">
                  <h1 className="text-2xl lg:text-4xl font-bold tracking-tight">Client Portal</h1>
                  <p className="text-blue-100 mt-1 text-sm lg:text-base">
                    Welcome, {clientInfo?.company || clientInfo?.name}
                  </p>
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="text-center lg:text-right bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 lg:px-6 lg:py-4">
                <p className="text-xs lg:text-sm text-blue-100 mb-1 font-medium">ZURCHER SEPTIC SERVICES</p>
                <a 
                  href="tel:+19546368200" 
                  className="text-xl lg:text-2xl font-bold hover:text-blue-200 transition-colors flex items-center gap-2 justify-center lg:justify-end"
                >
                  <FaPhone className="text-sm" />
                  (954) 636-8200
                </a>
                <a 
                  href="mailto:admin@zurcherseptic.com" 
                  className="text-xs lg:text-sm text-blue-100 hover:text-white transition-colors flex items-center gap-2 justify-center lg:justify-end mt-1"
                >
                  <FaEnvelope className="text-xs" />
                  admin@zurcherseptic.com
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white/80 backdrop-blur-md shadow-lg border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-4 lg:space-x-8 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: FaHome },
                { id: 'projects', label: 'My Projects', icon: FaTools },
                // { id: 'documents', label: 'Documents', icon: FaFileContract },
                // { id: 'gallery', label: 'Gallery', icon: FaImages }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'projects' && selectedWork) {
                        goBackToProjects();
                      } else {
                        setActiveTab(tab.id);
                      }
                    }}
                    className={`flex items-center gap-2 py-3 lg:py-4 px-3 lg:px-4 border-b-3 font-medium text-sm lg:text-base transition-all whitespace-nowrap ${
                      activeTab === tab.id || (activeTab === 'project-detail' && tab.id === 'projects')
                        ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="text-base lg:text-lg" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {activeTab === 'overview' && (
            <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Summary Cards */}
              <div className="lg:col-span-2 space-y-4 lg:space-y-6">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200 hover:shadow-xl transition-shadow">
                  <h2 className="text-xl lg:text-2xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <FaClipboardList className="text-white text-sm" />
                    </div>
                    Projects Summary
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3 lg:gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 lg:p-5 rounded-xl border border-blue-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 lg:gap-4">
                        <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg flex items-center justify-center">
                          <FaTools className="text-white text-xl lg:text-2xl" />
                        </div>
                        <div>
                          <p className="text-xs lg:text-sm text-slate-600 font-medium">Total Projects</p>
                          <p className="text-2xl lg:text-3xl font-bold text-slate-800">{works.length}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 lg:p-5 rounded-xl border border-green-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 lg:gap-4">
                        <div className="w-12 h-12 lg:w-14 lg:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg flex items-center justify-center">
                          <FaCheckCircle className="text-white text-xl lg:text-2xl" />
                        </div>
                        <div>
                          <p className="text-xs lg:text-sm text-slate-600 font-medium">Active Projects</p>
                          <p className="text-2xl lg:text-3xl font-bold text-slate-800">
                            {works.filter(w => w.status !== 'maintenance' && w.status !== 'finalApproved').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Latest Project Progress with Modern Tracker */}
                {works.length > 0 && (
                  <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200 hover:shadow-xl transition-shadow">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Latest Project Progress</h3>
                    {(() => {
                      const latestWork = works[0];
                      const statusInfo = workStatusLabels[latestWork.status] || workStatusLabels.pending;
                      
                      return (
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-semibold text-slate-800 text-lg">{latestWork.propertyAddress}</p>
                              <p className="text-slate-600">{statusInfo.label}</p>
                            </div>
                            {latestWork.startDate && (
                              <p className="text-sm text-slate-500">
                                Started: {formatDate(latestWork.startDate)}
                              </p>
                            )}
                          </div>
                          <ProgressTracker currentStatus={latestWork.status} />
                        </div>
                      );
                    })()}
                    
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200 hover:shadow-xl transition-shadow">
                <h3 className="text-lg lg:text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <FaPhone className="text-white text-sm" />
                  </div>
                  Contact Information
                </h3>
                <div className="space-y-3 lg:space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaPhone className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Phone</p>
                      <a href="tel:+19546368200" className="text-blue-700 hover:text-blue-800 font-medium text-base">
                        (954) 636-8200
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                    <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FaEnvelope className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Email</p>
                      <a href="mailto:admin@zurcherseptic.com" className="text-blue-700 hover:text-blue-800 font-medium text-sm break-all">
                        admin@zurcherseptic.com
                      </a>
                    </div>
                  </div>
                  <div className="mt-4 lg:mt-6 p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <p className="text-sm text-blue-900">
                      <strong className="font-bold">Business Hours:</strong><br />
                      <span className="text-blue-800">Monday - Friday: 7:00 AM - 5:00 PM<br />
                      Saturday: 8:00 AM - 2:00 PM</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'projects' && (
            <div className="space-y-4 lg:space-y-6">
              <h2 className="text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <FaTools className="text-white" />
                </div>
                My Projects
              </h2>
              {works.length === 0 ? (
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-8 lg:p-12 text-center border border-slate-200">
                  <FaTools className="text-slate-300 text-5xl lg:text-6xl mx-auto mb-4" />
                  <p className="text-slate-600 text-lg">No projects at this time.</p>
                </div>
              ) : (
                <div className="grid gap-4 lg:gap-6">
                  {works.map(work => {
                    const statusInfo = workStatusLabels[work.status] || workStatusLabels.pending;
                    const StatusIcon = statusInfo.icon;
                    const progress = getProgressPercentage(work.status);
                    const isCompleted = work.status === 'maintenance' || work.status === 'finalApproved';
                    
                    return (
                      <div key={work.idWork} className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200 transition-all duration-300 hover:shadow-2xl hover:scale-[1.01]">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4">
                          <div className="flex items-start gap-3 lg:gap-4">
                            <div className={`w-12 h-12 lg:w-14 lg:h-14 ${statusInfo.color} rounded-xl shadow-lg flex items-center justify-center text-white flex-shrink-0`}>
                              <StatusIcon className="text-xl lg:text-2xl" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg lg:text-xl font-bold text-slate-800">{work.propertyAddress}</h3>
                                {isCompleted && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    <FaCheckCircle className="mr-1" />
                                    Completed
                                  </span>
                                )}
                              </div>
                              <p className="text-slate-600 font-medium text-sm lg:text-base">{statusInfo.label}</p>
                              <div className="mt-2 space-y-1 text-xs lg:text-sm text-slate-500">
                                {work.startDate && (
                                  <p className="flex items-center gap-1">
                                    <FaCalendarAlt className="text-blue-500" />
                                    Started: {formatDate(work.startDate)}
                                  </p>
                                )}
                                {work.installationStartDate && (
                                  <p className="flex items-center gap-1">
                                    <FaTools className="text-green-500" />
                                    Installation: {formatDate(work.installationStartDate)}
                                  </p>
                                )}
                                {work.budget?.applicantName && (
                                  <p className="font-medium text-slate-600">
                                    Client: {work.budget.applicantName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex lg:flex-col gap-2">
                            <span className={`px-3 lg:px-4 py-2 rounded-xl text-sm font-bold text-white ${statusInfo.color} shadow-md text-center whitespace-nowrap`}>
                              {Math.round(progress)}% Complete
                              {work.budget?.initialPayment && (
                                <div className="text-xs mt-1">
                                  Initial: ${work.budget.initialPayment}
                                </div>
                              )}
                            </span>
                          </div>
                        </div>
                        
                        {/* Progress Tracker */}
                        <div className="mb-4">
                          <ProgressTracker currentStatus={work.status} />
                        </div>

                        {/* View Details Button - Always enabled */}
                        <div className="mb-4">
                          <button 
                            onClick={() => selectWork(work)}
                            className={`w-full lg:w-auto ${
                              isCompleted 
                                ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700' 
                                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                            } text-white px-6 py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105`}
                          >
                            <FaFileContract className="text-base" />
                            {isCompleted ? 'View Completed Project' : 'View Project Details'}
                          </button>
                        </div>

                        {/* Work Notes visible to client */}
                        {work.workNotes && work.workNotes.length > 0 && (
                          <div className="border-t border-slate-200 pt-4">
                            <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                              <FaClipboardList className="text-blue-500" />
                              Project Updates:
                            </h4>
                            <div className="space-y-2">
                              {work.workNotes.slice(0, 2).map((note, index) => (
                                <div key={index} className="bg-gradient-to-br from-slate-50 to-slate-100 p-3 lg:p-4 rounded-lg border border-slate-200">
                                  <p className="text-sm text-slate-700 leading-relaxed">{note.note}</p>
                                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <FaCalendarAlt className="text-blue-500" />
                                    {formatDate(note.createdAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'project-detail' && selectedWork && (
            <div className="space-y-4 lg:space-y-6">
              {/* Header with back button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
                <button 
                  onClick={goBackToProjects}
                  className="bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
                >
                  ← Back to Projects
                </button>
                <div>
                  <h2 className="text-xl lg:text-3xl font-bold text-slate-800">{selectedWork.propertyAddress}</h2>
                  <p className="text-slate-600 font-medium text-sm lg:text-base">{workStatusLabels[selectedWork.status]?.label || 'Unknown Status'}</p>
                </div>
              </div>

              {/* Project Progress */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200">
                <h3 className="text-lg lg:text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <FaClipboardList className="text-white text-sm" />
                  </div>
                  Current Progress
                </h3>
                <ProgressTracker currentStatus={selectedWork.status} />
              </div>

              {/* Project Documentation */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200">
                <h3 className="text-lg lg:text-xl font-semibold text-slate-800 mb-4 lg:mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                    <FaFileContract className="text-white text-sm" />
                  </div>
                  Project Documents
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                  
                  {/* Signed Budget */}
                  <div className="border border-slate-200 rounded-xl p-4 lg:p-5 bg-gradient-to-br from-white to-blue-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <FaFileContract className="text-white text-lg" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-base">Signed Budget</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">View your approved project budget</p>
                    <button 
                      onClick={() => viewDocument('signedBudget')}
                      disabled={!workDocuments?.signedBudget?.available || loadingPdf}
                      className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        workDocuments?.signedBudget?.available && !loadingPdf
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg' 
                          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {loadingPdf ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Loading...
                        </>
                      ) : workDocuments?.signedBudget?.available ? (
                        'View Document'
                      ) : (
                        'Not Available'
                      )}
                    </button>
                  </div>

                  {/* Final Invoice */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <FaDollarSign className="text-green-600 text-xl" />
                      <h4 className="font-medium text-slate-800">
                        Final Invoice
                        {workDocuments?.finalInvoice?.invoiceNumber && (
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            #{workDocuments.finalInvoice.invoiceNumber}
                          </span>
                        )}
                      </h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      {workDocuments?.finalInvoice?.hasFinalInvoice 
                        ? 'Complete project final invoice' 
                        : 'Final project invoice'}
                      {workDocuments?.finalInvoice?.amount && (
                        <span className="block font-medium text-slate-700 mt-1">
                          Amount Due: ${Number(workDocuments.finalInvoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                      {workDocuments?.finalInvoice?.status && (
                        <span className={`block text-xs mt-1 font-medium ${
                          workDocuments.finalInvoice.status === 'paid' ? 'text-green-600' :
                          workDocuments.finalInvoice.status === 'pending' ? 'text-orange-600' :
                          'text-slate-600'
                        }`}>
                          Status: {workDocuments.finalInvoice.status.charAt(0).toUpperCase() + workDocuments.finalInvoice.status.slice(1)}
                        </span>
                      )}
                      {!workDocuments?.finalInvoice?.hasFinalInvoice && !workDocuments?.finalInvoice?.available && (
                        <span className="block text-xs text-orange-600 mt-1">
                          Coming soon
                        </span>
                      )}
                    </p>
                    <button 
                      onClick={() => viewDocument('finalInvoice')}
                      disabled={!workDocuments?.finalInvoice?.available || loadingPdf}
                      className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-2 ${
                        workDocuments?.finalInvoice?.available && !loadingPdf
                          ? 'bg-green-500 hover:bg-green-600 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {loadingPdf ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Loading...
                        </>
                      ) : workDocuments?.finalInvoice?.available ? (
                        'View Invoice'
                      ) : (
                        'Coming Soon'
                      )}
                    </button>
                  </div>

                  {/* Operation Permit */}
                  <div className="border border-slate-200 rounded-xl p-4 lg:p-5 bg-gradient-to-br from-white to-orange-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                        <FaClipboardList className="text-white text-lg" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-base">Operation Permit</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      Official operation permit
                    </p>
                    {workDocuments?.operationPermit?.sentAt && (
                      <p className="text-xs text-slate-500 mb-3">
                        📅 Uploaded: {formatDate(workDocuments.operationPermit.sentAt)}
                      </p>
                    )}
                    {!workDocuments?.operationPermit?.sentAt && workDocuments?.operationPermit?.available && (
                      <p className="text-xs text-slate-500 mb-3">
                        📄 Available
                      </p>
                    )}
                    {!workDocuments?.operationPermit?.available && (
                      <p className="text-xs text-slate-400 mb-3">
                        ⏳ Not yet uploaded
                      </p>
                    )}
                    <button 
                      onClick={() => viewDocument('permit')}
                      disabled={!workDocuments?.operationPermit?.available || loadingPdf}
                      className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-2 ${
                        workDocuments?.operationPermit?.available && !loadingPdf
                          ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {loadingPdf ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Loading...
                        </>
                      ) : workDocuments?.operationPermit?.available ? (
                        'View Document'
                      ) : (
                        'Not Available'
                      )}
                    </button>
                  </div>

                  {/* Maintenance Service */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <FaTools className="text-purple-600 text-xl" />
                      <h4 className="font-medium text-slate-800">Maintenance Service</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      Maintenance service documentation
                    </p>
                    {workDocuments?.maintenanceService?.sentAt && (
                      <p className="text-xs text-slate-500 mb-3">
                        📅 Uploaded: {formatDate(workDocuments.maintenanceService.sentAt)}
                      </p>
                    )}
                    {!workDocuments?.maintenanceService?.sentAt && workDocuments?.maintenanceService?.available && (
                      <p className="text-xs text-slate-500 mb-3">
                        📄 Available
                      </p>
                    )}
                    {!workDocuments?.maintenanceService?.available && (
                      <p className="text-xs text-slate-400 mb-3">
                        ⏳ Not yet uploaded
                      </p>
                    )}
                    <button 
                      onClick={() => viewDocument('maintenance')}
                      disabled={!workDocuments?.maintenanceService?.available || loadingPdf}
                      className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-2 ${
                        workDocuments?.maintenanceService?.available && !loadingPdf
                          ? 'bg-purple-500 hover:bg-purple-600 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {loadingPdf ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Loading...
                        </>
                      ) : workDocuments?.maintenanceService?.available ? (
                        'View Document'
                      ) : (
                        'Not Available'
                      )}
                    </button>
                  </div>

                  {/* Extra Document */}
                  <div className="border border-slate-200 rounded-xl p-4 lg:p-5 bg-gradient-to-br from-white to-teal-50 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                        <FaFileAlt className="text-white text-lg" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-base">Additional Document</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-1">
                      Additional documentation or images (optional)
                    </p>
                    {workDocuments?.extraDocument?.sentAt && (
                      <p className="text-xs text-slate-500 mb-3">
                        📅 Uploaded: {formatDate(workDocuments.extraDocument.sentAt)}
                      </p>
                    )}
                    {!workDocuments?.extraDocument?.sentAt && workDocuments?.extraDocument?.available && (
                      <p className="text-xs text-slate-500 mb-3">
                        📄 Available
                      </p>
                    )}
                    {!workDocuments?.extraDocument?.available && (
                      <p className="text-xs text-slate-400 mb-3">
                        ⏳ Not yet uploaded
                      </p>
                    )}
                    <button 
                      onClick={() => viewDocument('extra')}
                      disabled={!workDocuments?.extraDocument?.available || loadingPdf}
                      className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-2 ${
                        workDocuments?.extraDocument?.available && !loadingPdf
                          ? 'bg-teal-500 hover:bg-teal-600 text-white' 
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {loadingPdf ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Loading...
                        </>
                      ) : workDocuments?.extraDocument?.available ? (
                        'View Document'
                      ) : (
                        'Not Available'
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* PPI Signature Section - Solo mostrar si está disponible */}
              {selectedWork && workDocuments && workDocuments.ppiSignature?.available && (
                <div className={`border-2 rounded-xl p-4 lg:p-6 shadow-lg ${
                  workDocuments.ppiSignature.signed 
                    ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-300' 
                    : 'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      workDocuments.ppiSignature.signed
                        ? 'bg-green-500'
                        : 'bg-yellow-500'
                    }`}>
                      {workDocuments.ppiSignature.signed ? (
                        <FaCheckCircle className="text-white text-2xl" />
                      ) : (
                        <FaExclamationTriangle className="text-white text-2xl" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg lg:text-xl font-bold text-slate-800">
                        {workDocuments.ppiSignature.signed ? 'PPI Document Signed ✓' : 'PPI Signature Required'}
                      </h3>
                      {workDocuments.ppiSignature.status && !workDocuments.ppiSignature.signed && (
                        <p className="text-xs text-slate-600 mt-1">
                          Status: {workDocuments.ppiSignature.status}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-slate-700 mb-4 leading-relaxed text-sm lg:text-base">
                    {workDocuments.ppiSignature.signed 
                      ? 'Your PPI (Pre-Installation Information) document has been signed successfully. Click below to view the signed document.'
                      : 'Your project requires a PPI (Pre-Installation Information) signature before proceeding. Click below to complete the digital signature process through DocuSign. The same link was sent to your email.'
                    }
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={handlePPISign}
                      disabled={loadingPdf}
                      className={`flex-1 sm:flex-none px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold shadow-md hover:shadow-lg ${
                        loadingPdf 
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : workDocuments.ppiSignature.signed
                            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                            : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white'
                      }`}
                    >
                      {loadingPdf ? (
                        <>
                          <FaSpinner className="animate-spin" />
                          Loading...
                        </>
                      ) : workDocuments.ppiSignature.signed ? (
                        <>
                          <FaFileAlt />
                          View Signed PPI
                        </>
                      ) : (
                        <>
                          <FaFileSignature />
                          Sign PPI Document via DocuSign
                        </>
                      )}
                    </button>
                    {!workDocuments.ppiSignature.signed && workDocuments.ppiSignature.envelopeId && (
                      <div className="text-xs text-slate-500 flex items-center gap-2 px-3">
                        <FaInfoCircle />
                        <span>Opens in new tab • Valid for 120 days from approval</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Project Gallery */}
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200">
                <h3 className="text-lg lg:text-xl font-semibold text-slate-800 mb-4 lg:mb-6 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <FaImages className="text-white text-sm" />
                  </div>
                  Project Gallery
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                  
                  {/* Installation Photos */}
                  <div className="border-2 border-slate-200 rounded-xl p-4 lg:p-5 bg-gradient-to-br from-white to-blue-50 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <FaImages className="text-white text-lg" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-base">System Installation</h4>
                    </div>
                    <div className="bg-slate-100 rounded-xl h-40 lg:h-48 flex items-center justify-center mb-3 overflow-hidden shadow-inner">
                      {workPhotos?.installation?.length > 0 ? (
                        <img 
                          src={workPhotos.installation[0].imageUrl} 
                          alt="Installation preview" 
                          className="h-full w-full object-cover rounded-xl hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <p className="text-slate-500 text-sm">Installation photos will appear here</p>
                      )}
                    </div>
                    <button 
                      onClick={() => viewPhotos('installation')}
                      disabled={!workPhotos?.installation?.length}
                      className={`text-sm font-semibold transition-all w-full px-4 py-2 rounded-lg shadow-md ${
                        workPhotos?.installation?.length 
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white hover:shadow-lg' 
                          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {workPhotos?.installation?.length ? `View All Photos (${workPhotos.installation.length})` : 'No Photos Yet'}
                    </button>
                  </div>

                  {/* Cover Photos */}
                  <div className="border-2 border-slate-200 rounded-xl p-4 lg:p-5 bg-gradient-to-br from-white to-green-50 hover:shadow-lg transition-all">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                        <FaImages className="text-white text-lg" />
                      </div>
                      <h4 className="font-semibold text-slate-800 text-base">Cover Installation</h4>
                    </div>
                    <div className="bg-slate-100 rounded-xl h-40 lg:h-48 flex items-center justify-center mb-3 overflow-hidden shadow-inner">
                      {workPhotos?.cover?.length > 0 ? (
                        <img 
                          src={workPhotos.cover[0].imageUrl} 
                          alt="Cover preview" 
                          className="h-full w-full object-cover rounded-xl hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <p className="text-slate-500 text-sm">Cover photos will appear here</p>
                      )}
                    </div>
                    <button 
                      onClick={() => viewPhotos('cover')}
                      disabled={!workPhotos?.cover?.length}
                      className={`text-sm font-semibold transition-all w-full px-4 py-2 rounded-lg shadow-md ${
                        workPhotos?.cover?.length 
                          ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-lg' 
                          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {workPhotos?.cover?.length ? `View All Photos (${workPhotos.cover.length})` : 'No Photos Yet'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Project Updates */}
              {selectedWork.workNotes && selectedWork.workNotes.length > 0 && (
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 lg:p-6 border border-slate-200">
                  <h3 className="text-lg lg:text-xl font-semibold text-slate-800 mb-4 lg:mb-6 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center">
                      <FaClipboardList className="text-white text-sm" />
                    </div>
                    Project Updates
                  </h3>
                  <div className="space-y-3 lg:space-y-4">
                    {selectedWork.workNotes.map((note, index) => (
                      <div key={index} className="bg-gradient-to-br from-slate-50 to-blue-50 p-4 lg:p-5 rounded-xl border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-slate-700 mb-2 leading-relaxed text-sm lg:text-base">{note.note}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <FaCalendarAlt className="text-blue-500" />
                          {formatDate(note.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Project Documents</h2>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-slate-600 text-center py-8">
                  Select a project from "My Projects" tab to view specific documents.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-slate-800">Project Gallery</h2>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-slate-600 text-center py-8">
                  Select a project from "My Projects" tab to view specific photos.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Professional Footer */}
        <div className="mt-8 lg:mt-12 pb-6 lg:pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white/70 backdrop-blur-md rounded-xl shadow-lg p-6 lg:p-8 border border-slate-200">
              <div className="text-center">
                <div className="flex justify-center mb-4">
                  <img src="/logo.png" alt="Zurcher Septic Logo" className="h-12 w-auto" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">ZURCHER SEPTIC SERVICES</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Professional Septic System Installation & Maintenance
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                  <a 
                    href="tel:+19546368200" 
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    <FaPhone />
                    (954) 636-8200
                  </a>
                  <span className="hidden sm:inline text-slate-400">|</span>
                  <a 
                    href="mailto:admin@zurcherseptic.com" 
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                  >
                    <FaEnvelope />
                    admin@zurcherseptic.com
                  </a>
                </div>
                <div className="text-xs text-slate-500 border-t border-slate-200 pt-4">
                  <p>&copy; {new Date().getFullYear()} Zurcher Septic Services. All rights reserved.</p>
                  <p className="mt-1">Licensed & Insured | Serving South Florida</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* PDF Modal */}
      <PdfModal
        isOpen={showPdfModal}
        onClose={() => {
          // Limpiar blob URL si existe
          if (selectedPdfUrl && selectedPdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(selectedPdfUrl);
          }
          setShowPdfModal(false);
          setSelectedPdfUrl('');
          setSelectedPdfTitle('');
          setSelectedContentType('pdf');
        }}
        pdfUrl={selectedPdfUrl}
        title={selectedPdfTitle}
        contentType={selectedContentType}
      />

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedImage(null);
            }
          }}
        >
          <div
            className="relative bg-white p-4 md:p-6 rounded shadow-lg flex flex-col max-h-[90vh] w-auto max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-semibold text-gray-700">Project Photo</h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-500 hover:text-gray-700 p-1"
                title="Close"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-y-auto flex-grow mb-4">
              <img
                src={selectedImage.imageUrl}
                alt="Project photo"
                className="w-full h-auto object-contain rounded"
              />
            </div>
            <p className="text-center text-sm text-gray-600">{formatImageDateTime(selectedImage.dateTime)}</p>
            {selectedImage.comment && (
              <p className="text-center text-xs text-gray-500 mt-1 italic">"{selectedImage.comment}"</p>
            )}
            <div className="flex justify-center mt-4 pt-4 border-t">
              <button
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-2 rounded text-sm"
                onClick={() => setSelectedImage(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {showPhotoGallery && currentPhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closePhotoGallery();
            }
          }}
        >
          <div className="relative max-w-5xl w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 text-white">
              <h3 className="text-lg font-semibold">
                Project Photos ({currentPhotoIndex + 1} of {currentPhotos.length})
              </h3>
              <button
                onClick={closePhotoGallery}
                className="text-white hover:text-gray-300 p-2"
                title="Close Gallery"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center relative">
              <img
                src={currentPhotos[currentPhotoIndex].imageUrl}
                alt={`Project photo ${currentPhotoIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded"
              />
              
              {/* Navigation Arrows */}
              {currentPhotos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
                    title="Previous Photo"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
                    title="Next Photo"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Image Info */}
            <div className="mt-4 text-center text-white">
              <p className="text-sm">{formatImageDateTime(currentPhotos[currentPhotoIndex].dateTime)}</p>
              {currentPhotos[currentPhotoIndex].comment && (
                <p className="text-xs text-gray-300 mt-1 italic">"{currentPhotos[currentPhotoIndex].comment}"</p>
              )}
            </div>
            
            {/* Thumbnail Navigation */}
            {currentPhotos.length > 1 && (
              <div className="flex justify-center mt-4 space-x-2 overflow-x-auto pb-2">
                {currentPhotos.map((photo, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded border-2 transition-all ${
                      index === currentPhotoIndex 
                        ? 'border-white ring-2 ring-white' 
                        : 'border-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={photo.imageUrl}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover rounded"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ClientPortalDashboard;
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { FaTimes, FaCalendar, FaTools, FaCheckCircle, FaUser, FaFileUpload, FaChevronRight, FaChevronLeft } from 'react-icons/fa';
import { sendContact } from '../../Redux/Actions/contactActions';

const ScheduleQuoteModal = ({ isOpen, onClose, defaultService = 'New Installation' }) => {
  const dispatch = useDispatch();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fileList, setFileList] = useState([]); // [{name, file, id}]
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    serviceType: defaultService,
    preferredDate: '',
    additionalMessage: ''
  });

  const serviceTypes = [
    'New Installation',
    'Repair',
    'Maintenance',
    'Other'
  ];

  const steps = [
    { number: 1, title: 'Personal Info', icon: FaUser },
    { number: 2, title: 'Service Details', icon: FaTools },
    { number: 3, title: 'Additional Info', icon: FaFileUpload },
    { number: 4, title: 'Review', icon: FaCheckCircle }
  ];

  const generateFileId = (file) => `${file.name}_${file.size}_${file.lastModified}`;

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'files') {
      let newFiles = Array.from(files);
      setFileList((prev) => {
        const existingIds = new Set(prev.map((f) => f.id));
        const filtered = newFiles.filter((file) => !existingIds.has(generateFileId(file)));
        return [
          ...prev,
          ...filtered.map((file) => ({ file, name: file.name, id: generateFileId(file) })),
        ];
      });
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleRemoveFile = (id) => {
    setFileList((prev) => prev.filter((f) => f.id !== id));
  };

  const validateStep = () => {
    if (currentStep === 1) {
      if (!form.name || !form.email || !form.phone) {
        setError('Please fill in all required fields');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setError('Please enter a valid email address');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!form.preferredDate) {
        setError('Please select a preferred date');
        return false;
      }
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  const handleSubmit = async () => {
    setError('');

    const fullMessage = `
📅 SOLICITUD DE PRESUPUESTO

Tipo de servicio: ${form.serviceType}
Fecha preferida: ${new Date(form.preferredDate).toLocaleDateString('es-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
})}

${form.additionalMessage ? `Detalles del proyecto:\n${form.additionalMessage}` : ''}

${fileList.length > 0 ? `\n📎 Archivos adjuntos: ${fileList.length}` : ''}
    `.trim();

    const formData = new FormData();
    formData.append('name', form.name);
    formData.append('email', form.email);
    formData.append('phone', form.phone);
    formData.append('message', fullMessage);
    
    if (fileList.length > 0) {
      fileList.forEach(({ file }) => formData.append('attachments', file));
    }

    try {
      await dispatch(sendContact(formData));
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setCurrentStep(1);
        setForm({
          name: '',
          email: '',
          phone: '',
          serviceType: defaultService,
          preferredDate: '',
          additionalMessage: ''
        });
        setFileList([]);
      }, 3000);
    } catch (err) {
      setError('There was an error sending your request. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: 'url(https://res.cloudinary.com/dt4ah1jmy/image/upload/v1770149965/tank_kyplf8_poster.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        ></div>

        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-4 md:px-6 py-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-2 md:right-3 text-white/80 hover:text-white transition-colors z-10"
          >
            <FaTimes className="text-lg md:text-xl" />
          </button>
          <h2 className="text-lg md:text-2xl font-bold mb-4 pr-8 md:pr-0">Schedule Your Free Quote</h2>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-base transition-all duration-300 ${
                      currentStep >= step.number
                        ? 'bg-white text-blue-600 shadow-lg'
                        : 'bg-white/20 text-white/60'
                    }`}
                  >
                    {currentStep > step.number ? (
                      <FaCheckCircle />
                    ) : (
                      <step.icon />
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-medium hidden md:block ${
                    currentStep >= step.number ? 'text-white' : 'text-white/60'
                  }`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 transition-all duration-300 ${
                    currentStep > step.number ? 'bg-white' : 'bg-white/20'
                  }`}></div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="relative p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {!submitted ? (
            <>
              {/* Step 1: Personal Info */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Tell us about yourself</h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Service Details */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">What service do you need?</h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Service Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {serviceTypes.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, serviceType: type }))}
                          className={`p-3 rounded-lg border-2 font-semibold text-sm transition-all duration-300 ${
                            form.serviceType === type
                              ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                              : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                          }`}
                        >
                          <FaTools className="inline mr-1 text-xs" />
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      <FaCalendar className="inline mr-1" />
                      Preferred Date for Visit <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="preferredDate"
                      value={form.preferredDate}
                      onChange={handleChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We'll confirm the exact time with you after receiving your request
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Additional Info */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Project Details (Optional)</h3>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Tell us more about your project
                    </label>
                    <textarea
                      name="additionalMessage"
                      value={form.additionalMessage}
                      onChange={handleChange}
                      rows="4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      placeholder="Property size, current system details, specific concerns, etc."
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      <FaFileUpload className="inline mr-2" />
                      Attach Files (Optional)
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                      <input
                        type="file"
                        name="files"
                        onChange={handleChange}
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <FaFileUpload className="text-3xl text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 font-medium text-sm">Click to upload or drag and drop</p>
                        <p className="text-xs text-gray-400 mt-1">Photos, plans, permits (PDF, DOC, JPG, PNG)</p>
                      </label>
                    </div>
                    
                    {fileList.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {fileList.map(({ name, id }) => (
                          <div key={id} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg">
                            <span className="text-sm text-gray-700 truncate flex-1">{name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(id)}
                              className="text-red-500 hover:text-red-700 ml-3"
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className="text-xl font-bold text-gray-800 mb-4">Review Your Information</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Personal Information</h4>
                      <p className="text-gray-600"><strong>Name:</strong> {form.name}</p>
                      <p className="text-gray-600"><strong>Email:</strong> {form.email}</p>
                      <p className="text-gray-600"><strong>Phone:</strong> {form.phone}</p>
                    </div>

                    <div className="border-t pt-4">
                      <h4 className="font-semibold text-gray-700 mb-2">Service Details</h4>
                      <p className="text-gray-600"><strong>Service Type:</strong> {form.serviceType}</p>
                      <p className="text-gray-600">
                        <strong>Preferred Date:</strong> {new Date(form.preferredDate).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>

                    {form.additionalMessage && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-700 mb-2">Project Details</h4>
                        <p className="text-gray-600 whitespace-pre-wrap">{form.additionalMessage}</p>
                      </div>
                    )}

                    {fileList.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-gray-700 mb-2">Attachments</h4>
                        <p className="text-gray-600">{fileList.length} file(s) attached</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <FaCheckCircle className="inline mr-2" />
                      By submitting this form, you agree to be contacted by Zurcher Septic regarding your quote request.
                    </p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">
                  {error}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3 mt-6 pt-4 border-t">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex items-center justify-center gap-2 px-5 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                  >
                    <FaChevronLeft />
                    Back
                  </button>
                )}
                
                {currentStep < 4 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all font-semibold"
                  >
                    Continue
                    <FaChevronRight />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all font-semibold"
                  >
                    <FaCheckCircle />
                    Submit Request
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 animate-fade-in">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaCheckCircle className="text-4xl text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">
                Request Sent Successfully!
              </h3>
              <p className="text-gray-600 mb-1">
                We've received your quote request.
              </p>
              <p className="text-gray-500 text-sm">
                Our team will contact you within 24 hours to confirm your appointment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleQuoteModal;

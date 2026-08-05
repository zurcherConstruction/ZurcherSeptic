// Validar correo electrónico
export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "El correo electrónico es obligatorio.";
    if (!emailRegex.test(email)) return "El correo electrónico no es válido.";
    return null;
  };
  
  // Validar número de teléfono
  export const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10}$/; // Ejemplo: 10 dígitos numéricos
    if (!phone) return "El número de teléfono es obligatorio.";
    if (!phoneRegex.test(phone)) return "El número de teléfono debe contener 10 dígitos.";
    return null;
  };
  
  // Validar contraseña
  export const validatePassword = (password) => {
    if (!password) return "La contraseña es obligatoria.";
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    return null;
  };
  
  // Validar nombre
  export const validateName = (name) => {
    if (!name) return "El nombre es obligatorio.";
    if (name.length < 3) return "El nombre debe tener al menos 3 caracteres.";
    return null;
  };
  
// Validar rol
export const validateRole = (role) => {
  const validRoles = ["admin", "worker", "recept", "owner", "finance", "finance-viewer", "maintenance", "sales_rep", "follow-up", "capataz"];
  if (!role) return "El rol es obligatorio.";
  if (!validRoles.includes(role)) return "El rol no es válido.";
  return null;
}; // Validar formulario completo
export const validateForm = (formData, isEditing = false) => {
    const errors = {};
  
    // Validar email
    errors.email = validateEmail(formData.email);
  
    // Validar teléfono
    errors.phone = validatePhone(formData.phone);
  
    // Validar contraseña solo si no estás editando
    if (!isEditing) {
      errors.password = validatePassword(formData.password);
    }
  
    // Validar nombre
    errors.name = validateName(formData.name);
  
    // Validar rol
    errors.role = validateRole(formData.role);
  
    // Filtrar errores nulos
    return Object.fromEntries(Object.entries(errors).filter(([_, value]) => value !== null));
  };

  export const validateFile = (file) => {
    if (!file) {
      alert("Debe seleccionar un archivo.");
      return false;
    }
  
    if (file.type !== "application/pdf") {
      alert("Solo se permiten archivos PDF.");
      return false;
    }
  
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo no debe superar los 5 MB.");
      return false;
    }
  
    return true;
  };
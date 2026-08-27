const { Staff } = require('../../data');
const { CustomError } = require('../../middleware/error');
const { catchedAsync } = require('../../utils/catchedAsync');
const bcrypt = require('bcrypt');
const {uploadBufferToCloudinary, deleteFromCloudinary} = require('../../utils/cloudinaryUploader');
const { Op } = require('sequelize');


const getAllStaff = async (req, res) => {
    const staffers = await Staff.findAll({
        attributes: { exclude: ['password'] },
        order: [['createdAt', 'DESC']]
    });

    res.json({
        error: false,
        message: 'Staffers recuperados exitosamente',
        data: staffers
    });
};

const createStaff = async (req, res, next) => { // Añadido next para manejo de errores con Cloudinary
    let idFrontCloudinaryResult = null;
    let idBackCloudinaryResult = null;
    try {
        const { name, email, password, role, phone, address, salesRepCommission, ...staffData } = req.body; // Añadido address y salesRepCommission

        // Los archivos estarán en req.files gracias a multer
        const idFrontImageFile = req.files && req.files.idFrontImage ? req.files.idFrontImage[0] : null;
        const idBackImageFile = req.files && req.files.idBackImage ? req.files.idBackImage[0] : null;

 // Validar campos requeridos
 if (!name || !email || !password || !role) {
    throw new CustomError('Nombre, email, contraseña y rol son requeridos', 400);
}

const lowercasedEmail = email.toLowerCase();

        // Normalizar el rol a minúsculas para evitar problemas de caso
        const normalizedRole = role ? role.toLowerCase().trim() : null;

        // Validar rol permitido
        const allowedRoles = ['recept', 'admin', 'owner', 'worker', 'finance', 'finance-viewer', 'maintenance', 'sales_rep', 'follow-up', 'capataz', 'contractor'];

        if (!normalizedRole || !allowedRoles.includes(normalizedRole)) {
            throw new CustomError('Rol no válido o no proporcionado para staff', 400);
        }

        // Verificar email único
        const existingStaff = await Staff.findOne({ where: { email, deletedAt: null } });
        if (existingStaff) {
            throw new CustomError('El correo ya está registrado', 400);
        }

        let idFrontUrl, idFrontPublicId, idBackUrl, idBackPublicId;

        if (idFrontImageFile) {
            idFrontCloudinaryResult = await uploadBufferToCloudinary(idFrontImageFile.buffer, { folder: 'staff_ids' });
            idFrontUrl = idFrontCloudinaryResult.secure_url;
            idFrontPublicId = idFrontCloudinaryResult.public_id;
        }

        if (idBackImageFile) {
            idBackCloudinaryResult = await uploadBufferToCloudinary(idBackImageFile.buffer, { folder: 'staff_ids' });
            idBackUrl = idBackCloudinaryResult.secure_url;
            idBackPublicId = idBackCloudinaryResult.public_id;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Procesar salesRepCommission
        let commissionValue = null;
        if (normalizedRole === 'sales_rep' && salesRepCommission) {
            const parsed = parseFloat(salesRepCommission);
            if (!isNaN(parsed) && parsed > 0) {
                commissionValue = parsed;
            }
        }

        const newStaff = await Staff.create({
            ...staffData,
            name,
            email: lowercasedEmail,
            password: hashedPassword,
            role: normalizedRole, // Usar el rol normalizado
            phone,
            address, // Guardar dirección
            salesRepCommission: commissionValue,
            idFrontUrl,
            idFrontPublicId,
            idBackUrl,
            idBackPublicId,
            isActive: true, // O según la lógica de 'isActive' que viene en staffData
            createdBy: req.staff.id // Asumiendo que req.staff.id está disponible por verifyToken
        });

        const staffResponse = { ...newStaff.toJSON() };
        delete staffResponse.password;

        res.status(201).json({
            error: false,
            message: 'Usuario staff creado exitosamente',
            data: staffResponse
        });
    } catch (error) {
        // Limpieza de Cloudinary si falla la creación del staff
        if (idFrontCloudinaryResult && idFrontCloudinaryResult.public_id) {
            try { await deleteFromCloudinary(idFrontCloudinaryResult.public_id); } catch (e) { console.error("Error cleaning front ID", e); }
        }
        if (idBackCloudinaryResult && idBackCloudinaryResult.public_id) {
            try { await deleteFromCloudinary(idBackCloudinaryResult.public_id); } catch (e) { console.error("Error cleaning back ID", e); }
        }
        next(error); // Pasa el error al manejador de errores global
    }
};

const updateStaff = async (req, res, next) => { // Añadido next
    const { id } = req.params;
    let idFrontCloudinaryResult = null;
    let idBackCloudinaryResult = null;
    let oldFrontPublicId = null;
    let oldBackPublicId = null;

    try {
        const { name, email, role, phone, password, address, isActive, salesRepCommission, ...updateData } = req.body;

        const staffToUpdate = await Staff.findByPk(id);
        if (!staffToUpdate) {
            throw new CustomError('Staff no encontrado', 404);
        }

        oldFrontPublicId = staffToUpdate.idFrontPublicId; // Guardar IDs antiguos para posible borrado
        oldBackPublicId = staffToUpdate.idBackPublicId;

        // Los archivos estarán en req.files gracias a multer
        const idFrontImageFile = req.files && req.files.idFrontImage ? req.files.idFrontImage[0] : null;
        const idBackImageFile = req.files && req.files.idBackImage ? req.files.idBackImage[0] : null;

        if (email && email !== staffToUpdate.email) {
            const existingEmail = await Staff.findOne({ where: { email, id: { [Op.ne]: id }, deletedAt: null } });
            if (existingEmail) {
                throw new CustomError('El correo ya está en uso por otro staff', 400);
            }
            staffToUpdate.email = email;
        }

        const allowedRoles = ['admin', 'recept', 'worker', 'owner', 'finance', 'finance-viewer', 'maintenance', 'sales_rep', 'follow-up', 'capataz', 'contractor'];
        if (role) {
            // Normalizar el rol para la actualización también
            const normalizedUpdateRole = role.toLowerCase().trim();
            
            if (!allowedRoles.includes(normalizedUpdateRole)) {
                throw new CustomError('Rol no válido para staff', 400);
            }
            staffToUpdate.role = normalizedUpdateRole;
        }


        if (password) {
            staffToUpdate.password = await bcrypt.hash(password, 10);
        }

        if (idFrontImageFile) {
            idFrontCloudinaryResult = await uploadBufferToCloudinary(idFrontImageFile.buffer, { folder: 'staff_ids' });
            staffToUpdate.idFrontUrl = idFrontCloudinaryResult.secure_url;
            staffToUpdate.idFrontPublicId = idFrontCloudinaryResult.public_id;
        }

        if (idBackImageFile) {
            idBackCloudinaryResult = await uploadBufferToCloudinary(idBackImageFile.buffer, { folder: 'staff_ids' });
            staffToUpdate.idBackUrl = idBackCloudinaryResult.secure_url;
            staffToUpdate.idBackPublicId = idBackCloudinaryResult.public_id;
        }

        // Actualizar otros campos
        if (name) staffToUpdate.name = name;
        if (phone) staffToUpdate.phone = phone;
        if (address) staffToUpdate.address = address;
        if (isActive !== undefined && typeof isActive === 'boolean') { // Manejar isActive explícitamente
            staffToUpdate.isActive = isActive;
        }
        
        // Actualizar comisión solo si es sales_rep
        if (staffToUpdate.role === 'sales_rep') {
            if (salesRepCommission !== undefined) {
                const parsed = parseFloat(salesRepCommission);
                staffToUpdate.salesRepCommission = (!isNaN(parsed) && parsed > 0) ? parsed : null;
            }
        } else {
            // Si cambia de rol y ya no es sales_rep, limpiar la comisión
            staffToUpdate.salesRepCommission = null;
        }
        
        // Sobrescribir cualquier otro dato de updateData si es necesario
        // Object.assign(staffToUpdate, updateData); // Cuidado con esto, podría sobrescribir campos no deseados

        staffToUpdate.updatedBy = req.staff.id;
        await staffToUpdate.save();

        // Borrar imágenes antiguas de Cloudinary si se subieron nuevas
        if (idFrontImageFile && oldFrontPublicId && oldFrontPublicId !== staffToUpdate.idFrontPublicId) {
            try { await deleteFromCloudinary(oldFrontPublicId); } catch (e) { console.error("Error deleting old front ID", e); }
        }
        if (idBackImageFile && oldBackPublicId && oldBackPublicId !== staffToUpdate.idBackPublicId) {
            try { await deleteFromCloudinary(oldBackPublicId); } catch (e) { console.error("Error deleting old back ID", e); }
        }

        const staffResponse = { ...staffToUpdate.toJSON() };
        delete staffResponse.password;

        res.json({
            error: false,
            message: 'Usuario actualizado exitosamente',
            data: staffResponse,
        });
    } catch (error) {
        // Si se subieron nuevas imágenes pero falló el guardado, borrarlas
        if (idFrontCloudinaryResult && idFrontCloudinaryResult.public_id) {
            try { await deleteFromCloudinary(idFrontCloudinaryResult.public_id); } catch (e) { console.error("Error cleaning new front ID on update failure", e); }
        }
        if (idBackCloudinaryResult && idBackCloudinaryResult.public_id) {
            try { await deleteFromCloudinary(idBackCloudinaryResult.public_id); } catch (e) { console.error("Error cleaning new back ID on update failure", e); }
        }
        next(error);
    }
};


const deactivateOrDeleteStaff = async (req, res) => {
    const { id } = req.params;
    const { action } = req.body; // "deactivate" o "delete"

    // Buscar al usuario en la base de datos
    const staff = await Staff.findByPk(id); // Buscar por ID sin importar el estado
    if (!staff) {
        throw new CustomError('Usuario no encontrado', 404);
    }

    // Prevenir desactivación/eliminación del usuario owner principal
    if (staff.role === 'owner' && staff.id === 1) {
        throw new CustomError('No se puede modificar al usuario principal', 403);
    }

    if (req.method === 'DELETE' || action === 'delete') {
        // Eliminar permanentemente el registro
        await staff.destroy();
        return res.json({
            error: false,
            message: 'Usuario eliminado permanentemente',
        });
    } else if (action === 'deactivate') {
        // Desactivar el usuario
        await staff.update({
            isActive: false,
            deactivatedAt: new Date(),
            deactivatedBy: req.staff.id,
        });
        return res.json({
            error: false,
            message: 'Usuario desactivado exitosamente',
        });
    } else {
        throw new CustomError('Acción no válida', 400);
    }
};

module.exports = {
    getAllStaff,
    createStaff,
    updateStaff,
    deactivateOrDeleteStaff
};
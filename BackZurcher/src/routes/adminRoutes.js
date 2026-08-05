const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/isAuth");
const { allowRoles } = require("../middleware/byRol");
const {
  getAllStaff,
  createStaff,
  updateStaff,
  deactivateOrDeleteStaff,
} = require("../controllers/User/adminController");
const { upload } = require('../middleware/multer');
// All routes require authentication
router.use(verifyToken);

// Staff management routes with role-based access
router.get("/staff", allowRoles(['admin', 'recept', 'owner', 'worker', 'finance', 'finance-viewer', 'maintenance', 'capataz']), getAllStaff);
router.post(
  "/staff",
  allowRoles(['owner']), // Primero el control de roles
  upload.fields([        // Luego multer para procesar archivos
      { name: 'idFrontImage', maxCount: 1 },
      { name: 'idBackImage', maxCount: 1 }
  ]),
  createStaff            // Finalmente el controlador
);
router.put(
  "/staff/:id",
  allowRoles(['owner']),
  upload.fields([ // También para actualizar si se permite cambiar imágenes
      { name: 'idFrontImage', maxCount: 1 },
      { name: 'idBackImage', maxCount: 1 }
  ]),
  updateStaff
);
router.post("/staff/:id/deactivate", allowRoles(['owner']), deactivateOrDeleteStaff);
router.delete("/staff/:id", allowRoles(['owner']), deactivateOrDeleteStaff);

module.exports = router;

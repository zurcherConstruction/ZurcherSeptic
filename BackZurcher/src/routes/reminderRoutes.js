const express = require('express');
const router = express.Router();
const ReminderController = require('../controllers/ReminderController');
const { verifyToken } = require('../middleware/isAuth');

router.use(verifyToken);

// Mis recordatorios (los que me están asignados)
router.get('/', ReminderController.getMyReminders);

// Tablero por empleado (owner ve todos, otros ven solo el suyo)
router.get('/board', ReminderController.getBoardReminders);

// Todos (admin/owner)
router.get('/all', ReminderController.getAllReminders);

// Crear recordatorio
router.post('/', ReminderController.createReminder);

// Editar recordatorio
router.patch('/:id', ReminderController.updateReminder);

// Eliminar recordatorio
router.delete('/:id', ReminderController.deleteReminder);

// Marcar/desmarcar completado (mi assignment)
router.patch('/:id/complete', ReminderController.toggleComplete);

// Agregar comentario
router.post('/:id/comments', ReminderController.addComment);

// Editar comentario
router.patch('/:id/comments/:commentId', ReminderController.updateComment);

// Eliminar comentario
router.delete('/:id/comments/:commentId', ReminderController.deleteComment);

module.exports = router;

const express = require('express');
const router = express.Router();
const NotificationRoutingController = require('../controllers/NotificationRoutingController');
const { allowRoles } = require('../middleware/byRol');

router.use(allowRoles(['owner', 'admin']));

router.get('/', NotificationRoutingController.getAll);
router.put('/', NotificationRoutingController.upsert);

module.exports = router;

const express = require('express');
const router = express.Router();
const { callback } = require('../../controllers/integrations/auth.controller');

router.post('/callback', callback);

module.exports = router;


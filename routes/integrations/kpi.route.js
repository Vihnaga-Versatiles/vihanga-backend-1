const express = require('express');
const router = express.Router();
const { 
    createKPI, 
    getKPIs, 
    getKPIById, 
    updateKPIById,
    deleteKPIById,
    querySalesforce,
    getSalesforceUser,
    getKPIsByEnabled
} = require('../../controllers/integrations/kpis.controller');

const prefix = '/integrations/kpi'
router.post(`${prefix}/createKPI`, createKPI);
router.get(`${prefix}/getKPIs/:enabled?`, getKPIs);
router.get(`${prefix}/getKPIById/:id`, getKPIById);
router.put(`${prefix}/updateKPIById/:id`, updateKPIById);
router.delete(`${prefix}/deleteKPIById/:id`, deleteKPIById);

// Salesforce
router.post(`${prefix}/querySalesforce`, querySalesforce);
router.get(`${prefix}/getSalesforceUser`, getSalesforceUser);

module.exports = router;
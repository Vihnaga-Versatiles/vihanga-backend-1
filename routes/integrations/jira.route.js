const router = require("express").Router();
const {
  saveJiraConfig,
  getJiraConfig,
  getJiraIssues,
  getJiraTasks,
  syncJiraStatuses,
} = require("../../controllers/integrations/jira.controller");

const prefix = "/integrations/jira";

router.post(`${prefix}/config`, saveJiraConfig);
router.get(`${prefix}/config`, getJiraConfig);
router.get(`${prefix}/issues`, getJiraIssues);
router.get(`${prefix}/tasks`, getJiraTasks);
router.post(`${prefix}/sync`, syncJiraStatuses);

module.exports = router;

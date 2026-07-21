const { syncJiraStatuses } = require("../controllers/integrations/jira.controller");

const registerJiraSyncJob = () => {
    // Run sync every 1 hour
    const ONE_HOUR = 60 * 60 * 1000;

    console.log("[JiraSync] Registering Jira status sync job (every 1 hour)");

    // Run once on startup after a short delay to ensure DB connection is stable
    setTimeout(() => {
        console.log("[JiraSync] Running initial Jira status sync in background...");
        // Pass empty req and res to run for all companies silently
        syncJiraStatuses({ body: {} }, null).catch(err => console.error(err));
    }, 15000);

    setInterval(() => {
        console.log("[JiraSync] Running scheduled Jira status sync...");
        syncJiraStatuses({ body: {} }, null).catch(err => console.error(err));
    }, ONE_HOUR);
};

module.exports = { registerJiraSyncJob };

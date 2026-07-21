const JiraConfig = require("../../models/jiraConfig.model");
const Objectives = require("../../models/objectives.model");
const KeyResults = require("../../models/keyResults.model");
const Tasks = require("../../models/tasks2.model");
const EmployModel = require("../../models/employee.model");
const axios = require("axios");

const successResponse = ({ message, data }) => ({
  success: true,
  data: data !== undefined ? data : null,
  message,
});

const failResponse = ({ message }) => ({
  success: false,
  data: null,
  message,
});

// Save or update Jira config (company-level, no email - passed when fetching)
const saveJiraConfig = async (req, res) => {
  try {
    const { domain, apiToken } = req.body;
    const companyId = req.body.companyId || req.user?.companyId || "";

    if (!domain || !apiToken) {
      return res.status(400).send(
        failResponse({ message: "Domain and API token are required" })
      );
    }

    const normalizedDomain = domain.replace(/^https?:\/\//, "").replace(/\.atlassian\.net.*$/, "").trim();

    const config = await JiraConfig.findOneAndUpdate(
      { companyId },
      {
        domain: normalizedDomain,
        apiToken,
        companyId,
      },
      { upsert: true, new: true }
    );

    res.json(
      successResponse({
        message: "Jira configuration saved successfully",
        data: { domain: config.domain },
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({ message: err?.message || "Failed to save Jira config" })
    );
  }
};

// Get Jira config (company-level, no apiToken in response)
const getJiraConfig = async (req, res) => {
  try {
    const companyId = req.query.companyId || req.user?.companyId || "";

    const config = await JiraConfig.findOne({ companyId }).select("-apiToken");
    if (!config) {
      return res.json(
        successResponse({ message: "No Jira config found", data: null })
      );
    }

    res.json(
      successResponse({
        message: "Jira config retrieved",
        data: { domain: config.domain },
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({ message: err?.message || "Failed to get Jira config" })
    );
  }
};

// Fetch Jira issues (authEmail passed from Key Result screen for Jira API auth)
const getJiraIssues = async (req, res) => {
  try {
    const { objectiveId, employeeEmail, authEmail } = req.query;
    const companyId = req.query.companyId || req.user?.companyId || "";

    // Assignee for JQL - from request or derived from objective
    let assigneeEmail = employeeEmail;
    if (!assigneeEmail && objectiveId) {
      const objective = await Objectives.findById(objectiveId);
      if (!objective || !objective.employeeReferenceId) {
        return res.status(400).send(
          failResponse({ message: "Objective not found or has no owner" })
        );
      }
      const employee = await EmployModel.findById(objective.employeeReferenceId);
      if (!employee?.contactInformation?.email) {
        return res.status(400).send(
          failResponse({ message: "Employee email not found" })
        );
      }
      assigneeEmail = employee.contactInformation.email;
    }

    if (!assigneeEmail) {
      return res.status(400).send(
        failResponse({ message: "Employee email or objectiveId is required" })
      );
    }

    const config = await JiraConfig.findOne({ companyId });
    if (!config) {
      return res.status(400).send(
        failResponse({ message: "Jira is not configured. Please set up Jira integration first." })
      );
    }

    // Jira Basic auth: use authEmail (passed from Key Result screen) or assigneeEmail as fallback
    const emailForAuth = authEmail || assigneeEmail;
    const baseUrl = `https://${config.domain}.atlassian.net`;
    const auth = Buffer.from(`${emailForAuth}:${config.apiToken}`).toString("base64");

    const headers = {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Jira Cloud uses accountId for assignee in JQL, not email. When authEmail === assigneeEmail,
    // we're authenticated as that user, so currentUser() returns their issues.
    let jql;
    if (authEmail && assigneeEmail && authEmail.toLowerCase() === assigneeEmail.toLowerCase()) {
      jql = "assignee = currentUser()";
    } else {
      // Look up Jira accountId from email via user search, then use in JQL
      let accountId = null;
      try {
        const userSearchRes = await axios.get(
          `${baseUrl}/rest/api/3/user/search`,
          {
            params: { query: assigneeEmail },
            headers,
          }
        );
        const users = Array.isArray(userSearchRes.data) ? userSearchRes.data : userSearchRes.data?.values || [];
        const match = users.find(
          (u) => u.emailAddress?.toLowerCase() === assigneeEmail.toLowerCase()
        ) || (users.length === 1 ? users[0] : null);
        accountId = match?.accountId;
      } catch (userErr) {
        // user search failed; fallback to email in JQL
      }
      jql = accountId ? `assignee = "${accountId}"` : `assignee = "${assigneeEmail}"`;
    }

    const searchResponse = await axios.post(
      `${baseUrl}/rest/api/latest/search/jql`,
      {
        jql,
        maxResults: 50,
        fields: ["summary", "status", "parent", "issuetype"],
      },
      { headers }
    );

    const rawResponse = searchResponse.data;
    const rawIssues = rawResponse?.issues || rawResponse?.values || [];

    const issues = rawIssues
      .filter((issue) => {
        if (!(issue.key || issue.id)) return false;
        const issuetype = issue.fields?.issuetype?.name || "";
        return issuetype.toLowerCase() === "story";
      })
      .map((issue) => {
        const key = issue.key || issue.id;
        const summary = issue.fields?.summary || "";
        const status = issue.fields?.status?.name || "";
        const parent = issue.fields?.parent;
        let label = "";

        if (parent) {
          const epicSummary = parent.fields?.summary || parent.key || "";
          label = `${epicSummary} - ${key}: ${summary}`;
        } else {
          label = `${key}: ${summary}`;
        }

        return {
          key,
          summary,
          status,
          label,
        };
      });

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(
      successResponse({
        message: "Jira issues retrieved successfully",
        data: issues,
      })
    );
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const msg =
      data?.errorMessages?.join?.(" ") ||
      data?.errors?.join?.(" ") ||
      data?.message ||
      err?.message;
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.status(status && status >= 400 ? status : 500).send(
      failResponse({
        message: msg || "Failed to fetch Jira issues. Check your Jira configuration.",
      })
    );
  }
};

const getJiraTasks = async (req, res) => {
  try {
    const { storyKey, authEmail } = req.query;
    const companyId = req.query.companyId || req.user?.companyId || "";

    if (!storyKey) {
      return res.status(400).send(
        failResponse({ message: "Story key is required" })
      );
    }

    const config = await JiraConfig.findOne({ companyId });
    if (!config) {
      return res.status(400).send(
        failResponse({ message: "Jira is not configured. Please set up Jira integration first." })
      );
    }

    const emailForAuth = authEmail;
    const baseUrl = `https://${config.domain}.atlassian.net`;
    const auth = Buffer.from(`${emailForAuth}:${config.apiToken}`).toString("base64");

    const headers = {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const jql = `parent = "${storyKey}"`;

    const searchResponse = await axios.post(
      `${baseUrl}/rest/api/latest/search/jql`,
      {
        jql,
        maxResults: 100,
        fields: ["summary", "status", "description", "issuetype", "priority", "created", "updated"],
      },
      { headers }
    );

    const rawIssues = searchResponse.data?.issues || [];
    const tasks = rawIssues.map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || "",
      status: "notstarted",
      jiraStatus: issue.fields?.status?.name || "",
      description: issue.fields?.description?.text || issue.fields?.description || "",
      priority: issue.fields?.priority?.name || "Medium",
    }));

    res.json(
      successResponse({
        message: "Jira tasks retrieved successfully",
        data: tasks,
      })
    );
  } catch (err) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.message || err?.message;
    res.status(status && status >= 400 ? status : 500).send(
      failResponse({
        message: msg || "Failed to fetch Jira tasks.",
      })
    );
  }
};

const syncJiraStatuses = async (req, res) => {
  try {
    const targetCompanyId = req.body?.companyId;
    const authEmailFromRequest = req.body?.authEmail;
    const isApiCall = Boolean(res);

    const query = targetCompanyId ? { companyId: targetCompanyId } : {};
    const configs = await JiraConfig.find(query);
    let totalUpdated = 0;

    for (const config of configs) {
      const companyId = (config.companyId && String(config.companyId).trim()) || "";
      if (!companyId) continue;

      let emailForAuth = authEmailFromRequest;
      if (!emailForAuth) {
        if (isApiCall) {
          if (res) {
            return res.status(400).send(
              failResponse({ message: "authEmail is required. Pass the Jira user email from the frontend (same as fetch issues)." })
            );
          }
        }
        // Hourly sync: fetch employees for this company and use first employee email for Jira auth
        const employees = await EmployModel.find({
          companyId,
          $or: [
            { "contactInformation.email": { $exists: true, $ne: "" } },
            { "contactInformation.workEmail": { $exists: true, $ne: "" } },
          ],
        })
          .select("contactInformation.email contactInformation.workEmail")
          .limit(1)
          .lean();
        const first = employees[0];
        const firstEmployeeEmail = first?.contactInformation?.email || first?.contactInformation?.workEmail;
        if (!firstEmployeeEmail) {
          console.warn(`[JiraSync] No employees with email for company ${companyId}; skipping.`);
          continue;
        }
        emailForAuth = firstEmployeeEmail;
      }

      const baseUrl = `https://${config.domain}.atlassian.net`;
      const auth = Buffer.from(`${emailForAuth}:${config.apiToken}`).toString("base64");
      const headers = { Authorization: `Basic ${auth}`, "Content-Type": "application/json" };

      // 1. Sync Tasks
      const tasks = await Tasks.find({ companyId, jiraKey: { $exists: true, $ne: "" } });
      for (const t of tasks) {
        try {
          const issueRes = await axios.get(`${baseUrl}/rest/api/latest/issue/${t.jiraKey}?fields=status`, { headers });
          const statusName = issueRes.data?.fields?.status?.name || "";
          const norm = statusName.toLowerCase();
          const isJiraDone = ["done", "completed", "closed"].includes(norm);
          const isLocalDone = t.status === "completed";

          let taskUpdated = false;
          if (statusName !== t.jiraStatus) {
            t.jiraStatus = statusName;
            taskUpdated = true;
          }

          if (isJiraDone && !isLocalDone) {
            t.status = "completed";
            t.progressStatus = 100;
            t.actualCompletionDate = new Date();
            taskUpdated = true;
          } else if (!isJiraDone && isLocalDone) {
            // Regression: Jira moved from Done to something else
            t.status = (norm.includes("to do") || norm.includes("new")) ? "notstarted" : "inprogress";
            t.progressStatus = 0;
            t.actualCompletionDate = null;
            taskUpdated = true;
          }

          if (taskUpdated) {
            await t.save();
            totalUpdated++;
          }
        } catch (e) {
          console.error(`[JiraSync] Task ${t.jiraKey} error:`, e.message);
        }
      }

      // 2. Sync KRs (and calculate actual based on tasks)
      const krs = await KeyResults.find({ companyId, jiraKey: { $exists: true, $ne: "" } });
      for (const kr of krs) {
        try {
          const issueRes = await axios.get(`${baseUrl}/rest/api/latest/issue/${kr.jiraKey}?fields=status`, { headers });
          const statusName = issueRes.data?.fields?.status?.name || "";
          let krUpdated = false;

          if (statusName !== kr.jiraStatus) {
            kr.jiraStatus = statusName;
            krUpdated = true;
          }

          const norm = statusName.toLowerCase();
          const targetNum = Number(kr.target) || 0;
          const isJiraDone = ["done", "completed", "closed"].includes(norm);

          if (isJiraDone) {
            // Story is completed -> KR is completed
            if (kr.status !== "completed" || Number(kr.actual) !== targetNum) {
              kr.status = "completed";
              kr.actual = String(targetNum);
              kr.actualDate = new Date();
              krUpdated = true;
            }
          } else {
            // Calculate based on sub-tasks
            // Explicitly convert _id to string for reliable match if krReferenceId is a string in Task model
            const krTasks = await Tasks.find({ krReferenceId: kr._id.toString() });
            if (krTasks.length > 0) {
              const completedTasksCount = krTasks.filter(t => t.status === "completed").length;
              const ratio = completedTasksCount / krTasks.length;
              const newActual = Math.round(targetNum * ratio);

              if (Number(kr.actual) !== newActual) {
                kr.actual = String(newActual);

                if (ratio === 1) {
                  kr.status = "completed";
                  kr.actualDate = new Date();
                } else {
                  // Regression or Progress update
                  if (kr.status === "completed" || kr.status === "notStarted") {
                    kr.status = "inProgress";
                  }
                }
                krUpdated = true;
              }
            } else {
              // No sub-tasks, but Story itself is not Done anymore
              if (kr.status === "completed") {
                kr.status = "inProgress";
                kr.actual = "0";
                kr.actualDate = null;
                krUpdated = true;
              }
            }
          }

          if (krUpdated) {
            await kr.save();
            totalUpdated++;
          }

        } catch (e) {
          console.error(`[JiraSync] KR ${kr.jiraKey} error:`, e.message);
        }
      }
    }

    if (res) {
      res.json(successResponse({ message: `Sync complete. Updated ${totalUpdated} records.`, data: { totalUpdated } }));
    } else if (totalUpdated > 0) {
      console.log(`[JiraSync] Background sync complete. Updated ${totalUpdated} record(s).`);
    }
    return totalUpdated;
  } catch (err) {
    console.error("[JiraSync] Global failure:", err);
    if (res) {
      res.status(500).send(failResponse({ message: err.message }));
    }
  }
};

module.exports = {
  saveJiraConfig,
  getJiraConfig,
  getJiraIssues,
  getJiraTasks,
  syncJiraStatuses,
};

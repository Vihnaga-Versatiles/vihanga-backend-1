const entityRoutes = require('./entity.route');
const companyRoutes = require('./company.route');
const departmentRoutes = require('./department.route');
const designationRoutes = require('./designation.route')
const gradeRoutes = require('./grade.route')
const uploadRoutes = require('./uploads.route')
const employRoutes = require('./employ.route')
const objectiveRoute = require('./objectives.route')
const keyResults = require('./keyResults.route')
const tasks = require('./tasks.route')
const tasks2 = require('./tasks2.route')
const comments = require('./comments.route')
const landing = require('./landing.route')
const user = require('./user.route')
const privileges = require('./privileges.route')
const privilegesGroup = require('./privilegesGroup.route')
const notification = require('./notification.route')
const notificationSettings = require('./notificationSettings.route')
const okrManagementLibraryTab = require('./okrLibraryTab.route')
const okrManagementTab = require('./okrTab.route')
const rewardsManagement = require('./rewardManagement.route')
const rewards = require('./rewards.route')
const chatbot = require('./chatbot.route')
const tasksChat = require('./tasksChat.route')
const getSearchBarData = require('./navbarSearch.route')
const chatbotReviews = require('./chatbotReviews.route')
const chatbotReviews_v2 = require('./chatbotReviews_v2.route')
const goals = require('./goals.route')
const competency = require('./competency.route')
const reviewForm = require('./reviewForm.route')
const templateScreen = require('./templateScreen.route')
const sessionScreen = require('./sessionScreen.route')
const guidelinesScreen = require('./guidelinesScreen.route')
const launchform = require('./launchform.route')
const advancedlaunchform = require('./advancedLaunchform.route')
const preference = require('./preferences.route')
const apm = require('./apm.route')
const chatbot_v2 = require('./chatbot.route_v2')
const chatbotQuestions = require('./chatbotQuestions.route')
const chatbotQuestionsV2 = require('./chatbotQuestions_v2.route')
const rewardpoints = require('./rewardpoints.route')
const issues = require('./issueRised.route')
const integrationsAuth = require('./integrations/auth.route')
const integrationsKPI = require('./integrations/kpi.route')
const integrationsJira = require('./integrations/jira.route')
// const ExitInterviewRoutes = require('../routes/ExitInterviewRoutes/exitInterviewRouter')
const Lookups = require('../routes/LookupsRoutes/lookupRoutes')
const dashboard = require('./dashboard.route')
const exportsRoute = require('./exports.route')
const sessions = require('./sessions.route')
const themeSetting = require('./themeSetting/ThemeSettingRoutes')
const errorLogs = require('./errorLogs.route')
                   
module.exports = {
  entityRoutes,
  templateScreen,
  sessionScreen,
  guidelinesScreen,
  departmentRoutes,
  designationRoutes,
  gradeRoutes,
  uploadRoutes,
  companyRoutes,
  employRoutes,
  objectiveRoute,
  keyResults,
  tasks,
  chatbotReviews,
  tasks2,
  comments,
  landing,
  user,
  privilegesGroup,
  privileges,
  notification,
  notificationSettings,
  okrManagementLibraryTab,
  okrManagementTab,
  rewardsManagement,
  rewards,
  chatbot,
  tasksChat,
  getSearchBarData,
  goals,
  competency,
  reviewForm,
  launchform,
  preference,
  apm,
  chatbot_v2,
  chatbotReviews_v2,
  chatbotQuestions,
  chatbotQuestionsV2,
  rewardpoints,
  advancedlaunchform,
  issues,
  integrationsAuth,
  integrationsKPI,
  integrationsJira,
  // ExitInterviewRoutes,
  Lookups,
  dashboard
  , exportsRoute
  , sessions
  , themeSetting
  , errorLogs
};

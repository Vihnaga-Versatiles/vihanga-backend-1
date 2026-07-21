const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require('./config/db');
const multer = require('multer');
var upload = multer();
const fs = require('fs').promises;  // Using fs.promises for async file operations
const assetsManagementRoute = require('./routes/assetsmanagement/assetsManagementRoute')
// const resignationRoute = require('./routes/');
const holidaysCalendar = require('./routes/holidaysCalendar/holidaysCalendar.route')


//API Automatic Documentation
const swaggerUi = require('swagger-ui-express')
const swaggerFile = require('./public/swagger_output.json')

//Database Connection
connectDB();

const { registerLeaveAccrualJobs } = require('./middlewares/leaves');
registerLeaveAccrualJobs();
const { registerMongoBackupJob } = require('./middlewares/mongoBackup');
registerMongoBackupJob();
const { registerJiraSyncJob } = require('./middlewares/jiraSync');
registerJiraSyncJob();
//App Configuration
const app = express();
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
}));
// app.use(upload.any());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));



const { entityRoutes, companyRoutes, departmentRoutes, designationRoutes, gradeRoutes, uploadRoutes, tasksChat, employRoutes, objectiveRoute, keyResults, tasks, comments, landing, user, privileges, notification, notificationSettings, privilegesGroup, okrManagementLibraryTab, okrManagementTab, rewardsManagement, rewards, chatbot, getSearchBarData, tasks2, chatbotReviews, goals, competency, reviewForm, templateScreen, sessionScreen, guidelinesScreen, launchform, preference, apm, chatbot_v2, chatbotReviews_v2, chatbotQuestions, chatbotQuestionsV2, rewardpoints, advancedlaunchform, issues, integrationsAuth, integrationsKPI, integrationsJira, Lookups, dashboard, exportsRoute, sessions, themeSetting, errorLogs } = require("./routes");

const recruitmentRoutes = require("./routes/recruitment");
const psychometricRoutes = require("./routes/psychometric/psychometricUserRoutes");
app.use('/api', assetsManagementRoute)
app.use('/api', Lookups);
app.use('/api', errorLogs);
// app.use('/api',ExitInterviewRoutes)
// app.use('/api', resignationRoute);
app.use('/api', entityRoutes);
app.use('/api', companyRoutes);
app.use('/api', departmentRoutes);
app.use('/api', designationRoutes);
app.use('/api', gradeRoutes)
app.use('/api', uploadRoutes)
app.use('/api', employRoutes)
app.use('/api', objectiveRoute)
app.use('/api', keyResults)
app.use('/api', tasks)
app.use('/api', tasks2)
app.use('/api', comments)
app.use('/api', landing)
app.use('/api', user)
app.use('/api', privilegesGroup)
app.use('/api', privileges)
app.use('/api', notificationSettings)
app.use('/api', notification)
app.use('/api', okrManagementLibraryTab)
app.use('/api', okrManagementTab)
app.use('/api', rewardsManagement)
app.use('/api', rewards)
app.use('/api', goals)
app.use('/api', chatbot)
app.use('/api', tasksChat)
app.use('/api', getSearchBarData)
app.use('/api', chatbotReviews)
app.use('/api', competency)
app.use('/api', reviewForm)
app.use('/api', templateScreen)
app.use('/api', sessionScreen)
app.use('/api', guidelinesScreen)
app.use('/api', launchform)
app.use('/api', advancedlaunchform)
app.use('/api', preference)
app.use('/api', holidaysCalendar)
app.use('/api', apm)
app.use('/api', chatbot_v2)
app.use('/api', chatbotReviews_v2)
app.use('/api', chatbotQuestions)
app.use('/api', chatbotQuestionsV2)
app.use('/api', rewardpoints)
app.use('/api', issues)
app.use('/api', integrationsAuth)
app.use('/api', integrationsKPI)
app.use('/api', integrationsJira)
app.use('/api', dashboard)
app.use('/api', exportsRoute)
app.use('/api', sessions)
app.use('/api/theme', themeSetting)
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile, {
  customCssUrl: "https://cdn.jsdelivr.net/npm/swagger-ui-dist@4.3.0/swagger-ui.css"
}))




//recruitment routes here

app.use("/api", recruitmentRoutes);

//psychometric assessment routes here
app.use("/api/psychometric", psychometricRoutes);

app.use("*", (req, res) => {
  res.status(404).send("Route not found  this helps :)");
});

//recruitment routes here



//Default Route
app.get("/", (req, res) => {
  res.send(`<h1>Welcome to Talent Spotify Backend Server</h1>`,);
});

// Email queue status endpoint
const { getQueueStatus } = require("./middlewares/recruitment/sendMail");
app.get("/api/email-queue/status", (req, res) => {
  const status = getQueueStatus();
  res.json({
    success: true,
    message: "Email queue status",
    data: status
  });
});

app.get('/.well-known/pki-validation/:filename', async (req, res) => {
  const { filename } = req.params;
  const filePath = `${__dirname}/${filename}`;  // Constructing the file path dynamically

  try {
    // Read the file contents asynchronously
    const fileContent = await fs.readFile(filePath, 'utf8');

    // Send the file content as the response
    res.send(fileContent);
  } catch (err) {
    console.error(`Error reading file '${filename}':`, err);
    res.status(500).send('Error reading file');
  }
});

//Server Configuration
const { PORT } = require("./config/environment");
const port = PORT || 3600;
const server = app.listen(port, () => {
  console.log("Server is running on port: " + port);
});

// Graceful shutdown handling
const { shutdownEmailQueue } = require("./middlewares/recruitment/sendMail");

const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(async () => {
    console.log("HTTP server closed");

    try {
      // Wait for all queued emails to be sent
      await shutdownEmailQueue();
      console.log("Email queue shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown:", error);
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

// Handle various shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

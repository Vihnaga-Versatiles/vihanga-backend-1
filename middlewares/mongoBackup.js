const path = require('path');
const fs = require('fs');
const fsp = require('fs').promises;
const { spawn } = require('child_process');
const { DATABASE_URL } = require('../config/environment');

const BACKUP_DIR = '/home/ubuntu/talent-spotify-backend-nodejs/mongo-backup';

function getLogFile() {
  return path.join(BACKUP_DIR, 'cron.log');
}

function formatTimestamp() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function logToFile(message) {
  try {
    fs.appendFileSync(getLogFile(), `[${formatTimestamp()}] ${message}\n`);
  } catch (e) {
    console.error('Failed to write to backup log:', e.message);
  }
}

function getMsUntilNextRun(targetHour = 23, targetMinute = 0) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function runBackupOnce() {
  const scriptPath = path.resolve(__dirname, '..', 'scripts', 'mongo_backup.sh');
  const logFile = getLogFile();

  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
  } catch (e) {
    console.error('Failed to create backup directory:', e.message);
  }

  logToFile(`Starting scheduled mongo backup via ${scriptPath}`);

  // Pass DATABASE_URL explicitly from config to the child process
  const envPath = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
  const childEnv = {
    ...process.env,
    PATH: `${envPath}:${process.env.PATH || ''}`,
    DATABASE_URL: DATABASE_URL // Explicitly pass from config
  };

  const child = spawn('/bin/bash', [scriptPath], {
    env: childEnv
  });

  child.stdout.on('data', (data) => {
    fs.appendFileSync(logFile, data);
  });
  child.stderr.on('data', (data) => {
    fs.appendFileSync(logFile, data);
  });
  child.on('error', (err) => {
    logToFile(`ERROR: Failed to spawn backup process: ${err.message}`);
  });
  child.on('close', (code, signal) => {
    const exitMsg = code !== null ? `with code ${code}` : `with signal ${signal}`;
    logToFile(`Backup process exited ${exitMsg}`);
  });
}

function registerMongoBackupJob() {
  const scheduleNext = () => {
    const delay = getMsUntilNextRun(23, 0);
    const nextRunTime = new Date(Date.now() + delay);
    
    console.log(`[MongoDB Backup] Next backup scheduled at ${nextRunTime.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
    logToFile(`Scheduled next backup for ${nextRunTime.toISOString()}`);

    setTimeout(async () => {
      try {
        await runBackupOnce();
      } catch (err) {
        console.error('[MongoDB Backup] Error running backup:', err);
        logToFile(`ERROR: ${err.message}`);
      } finally {
        // Schedule the next run after today's execution completes
        scheduleNext();
      }
    }, delay);
  };

  // Log startup
  console.log('[MongoDB Backup] Job scheduler initialized');
  logToFile('MongoDB backup scheduler started');
  
  scheduleNext();
}

module.exports = {
  registerMongoBackupJob,
  runBackupOnce
};







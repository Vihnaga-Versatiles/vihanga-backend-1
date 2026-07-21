/**
 * Email Queue Test Script
 * 
 * This script tests the email queue system to ensure it handles
 * concurrent emails properly without exceeding connection limits.
 * 
 * Usage: node test-email-queue.js
 */

require("dotenv").config();
const { sendEmail, getQueueStatus } = require("./middlewares/recruitment/sendMail");

// Configuration
const TEST_EMAIL = process.env.TEST_EMAIL || "interviewtesting345@yopmail.com";
const NUM_EMAILS = 5; // Number of concurrent emails to test

console.log("🧪 Email Queue Test Script");
console.log("=" .repeat(50));
console.log(`Testing with ${NUM_EMAILS} concurrent emails`);
console.log(`Target email: ${TEST_EMAIL}`);
console.log("=" .repeat(50));
console.log("");

async function runTest() {
  try {
    console.log("📊 Initial queue status:");
    console.log(getQueueStatus());
    console.log("");

    console.log(`🚀 Sending ${NUM_EMAILS} emails concurrently...`);
    const startTime = Date.now();

    // Create array of email promises
    const emailPromises = Array.from({ length: NUM_EMAILS }, (_, i) => {
      return sendEmail(
        TEST_EMAIL,
        `Test Email ${i + 1}/${NUM_EMAILS}`,
        `This is test email number ${i + 1}. Sent at ${new Date().toISOString()}`,
        false
      );
    });

    // Display queue status while emails are being sent
    const statusInterval = setInterval(() => {
      const status = getQueueStatus();
      console.log(`📊 Queue Status - Pending: ${status.queueLength}, Processing: ${status.processing}/${status.maxConcurrent}`);
    }, 1000);

    // Wait for all emails to complete
    const results = await Promise.all(emailPromises);

    clearInterval(statusInterval);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("");
    console.log("=" .repeat(50));
    console.log("📈 Test Results:");
    console.log("=" .repeat(50));

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`✅ Successful: ${successful}/${NUM_EMAILS}`);
    console.log(`❌ Failed: ${failed}/${NUM_EMAILS}`);
    console.log(`⏱️  Total time: ${duration}s`);
    console.log(`📊 Average: ${(duration / NUM_EMAILS).toFixed(2)}s per email`);
    console.log("");

    // Show final queue status
    console.log("📊 Final queue status:");
    console.log(getQueueStatus());
    console.log("");

    // Show details of failed emails
    if (failed > 0) {
      console.log("❌ Failed email details:");
      results.forEach((result, index) => {
        if (!result.success) {
          console.log(`  Email ${index + 1}: ${result.error}`);
        }
      });
      console.log("");
    }

    // Test results
    if (successful === NUM_EMAILS) {
      console.log("🎉 Test PASSED: All emails sent successfully!");
      console.log("✅ Email queue is working properly.");
    } else if (successful > 0) {
      console.log("⚠️  Test PARTIAL: Some emails failed.");
      console.log("Please check SMTP configuration and network connectivity.");
    } else {
      console.log("❌ Test FAILED: All emails failed.");
      console.log("Please verify:");
      console.log("  1. SMTP credentials in .env file");
      console.log("  2. Network connectivity");
      console.log("  3. SMTP server is accessible");
    }

    console.log("");
    console.log("=" .repeat(50));

    // Exit after a short delay to allow any remaining queue processing
    setTimeout(() => {
      process.exit(successful === NUM_EMAILS ? 0 : 1);
    }, 2000);

  } catch (error) {
    console.error("");
    console.error("=" .repeat(50));
    console.error("❌ Test Error:");
    console.error("=" .repeat(50));
    console.error(error);
    console.error("");
    
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
}

// Verify SMTP configuration
console.log("🔍 Checking SMTP configuration...");
const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingVars.forEach(varName => {
    console.error(`  - ${varName}`);
  });
  console.error("");
  console.error("Please set these variables in your .env file");
  process.exit(1);
}

console.log("✅ SMTP configuration found");
console.log(`   Host: ${process.env.SMTP_HOST}`);
console.log(`   Port: ${process.env.SMTP_PORT}`);
console.log(`   User: ${process.env.EMAIL_USER}`);
console.log("");

// Give user a chance to cancel
console.log("⏳ Starting test in 3 seconds...");
console.log("   (Press Ctrl+C to cancel)");
console.log("");

setTimeout(() => {
  runTest();
}, 3000);

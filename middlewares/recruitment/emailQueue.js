const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const { statusUpdateTemplate } = require("../../templatees/sendMailStatusTemplate");

dotenv.config();

// Email queue configuration
const MAX_CONCURRENT_EMAILS = 2; // Outlook allows limited concurrent connections
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // Initial delay before retry
const QUEUE_PROCESS_INTERVAL = 500; // Check queue every 500ms

class EmailQueue {
  constructor() {
    this.queue = [];
    this.processing = 0;
    this.isProcessing = false;
    
    // Create transporter with connection pooling
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      pool: true, // Enable connection pooling
      maxConnections: MAX_CONCURRENT_EMAILS, // Limit concurrent connections
      maxMessages: 100, // Max messages per connection
      rateDelta: 1000, // Time window for rate limiting (1 second)
      rateLimit: 5, // Max emails per rateDelta
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Start processing queue
    this.startProcessing();
  }

  /**
   * Add email to queue
   */
  async addToQueue(to, subject, body, useHtmlTemplate = false, template) {
    return new Promise((resolve, reject) => {
      const emailJob = {
        to,
        subject,
        body,
        useHtmlTemplate,
        template,
        attempts: 0,
        resolve,
        reject,
        addedAt: Date.now(),
      };
      
      this.queue.push(emailJob);
      console.log(`📧 Email queued for ${to}. Queue length: ${this.queue.length}`);
    });
  }

  /**
   * Process email queue
   */
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    setInterval(async () => {
      // Process emails if we have capacity and emails in queue
      while (this.processing < MAX_CONCURRENT_EMAILS && this.queue.length > 0) {
        const emailJob = this.queue.shift();
        this.processEmail(emailJob);
      }
    }, QUEUE_PROCESS_INTERVAL);
  }

  /**
   * Process individual email with retry logic
   */
  async processEmail(emailJob) {
    this.processing++;
    
    try {
      const result = await this.sendEmailWithRetry(emailJob);
      emailJob.resolve(result);
    } catch (error) {
      console.error(`❌ Failed to send email to ${emailJob.to} after ${emailJob.attempts} attempts:`, error.message);
      emailJob.reject(error);
    } finally {
      this.processing--;
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmailWithRetry(emailJob) {
    const { to, subject, body, useHtmlTemplate, template } = emailJob;
    
    while (emailJob.attempts < RETRY_ATTEMPTS) {
      emailJob.attempts++;
      
      try {
        console.log(`📤 Attempting to send email to ${to} (attempt ${emailJob.attempts}/${RETRY_ATTEMPTS})`);
        
        const mailOptions = {
          from: "contact@talentspotify.com",
          to,
          subject,
          text: useHtmlTemplate ? undefined : body,
          html: template ? template(body) : (useHtmlTemplate ? statusUpdateTemplate(body) : undefined),
        };

        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to}:`, info.messageId);
        
        return { success: true, messageId: info.messageId };
      } catch (error) {
        console.error(`⚠️ Email attempt ${emailJob.attempts} failed for ${to}:`, error.message);
        
        // Check if it's a concurrent connection error
        const isConcurrentError = error.message?.includes('Concurrent connections') || 
                                 error.message?.includes('432 4.3.2');
        
        // Check if it's a rate limit error
        const isRateLimitError = error.message?.includes('rate limit') || 
                                error.message?.includes('Too many');
        
        // If not the last attempt and it's a retryable error, wait before retrying
        if (emailJob.attempts < RETRY_ATTEMPTS && (isConcurrentError || isRateLimitError)) {
          // Exponential backoff with jitter
          const delay = RETRY_DELAY_MS * Math.pow(2, emailJob.attempts - 1) + Math.random() * 1000;
          console.log(`⏳ Waiting ${Math.round(delay)}ms before retry...`);
          await this.sleep(delay);
        } else if (emailJob.attempts >= RETRY_ATTEMPTS) {
          // All attempts exhausted
          throw error;
        } else {
          // Non-retryable error
          throw error;
        }
      }
    }
    
    throw new Error(`Failed to send email after ${RETRY_ATTEMPTS} attempts`);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      maxConcurrent: MAX_CONCURRENT_EMAILS,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log("🛑 Shutting down email queue...");
    
    // Wait for all processing emails to complete
    while (this.processing > 0 || this.queue.length > 0) {
      console.log(`⏳ Waiting for ${this.processing} emails to finish, ${this.queue.length} in queue...`);
      await this.sleep(1000);
    }
    
    // Close transporter
    this.transporter.close();
    console.log("✅ Email queue shutdown complete");
  }
}

// Create singleton instance
const emailQueue = new EmailQueue();

/**
 * Send email through queue
 */
const sendEmail = async (to, subject, body, useHtmlTemplate = false, template) => {
  console.log("body at mail", to, body);
  
  try {
    const result = await emailQueue.addToQueue(to, subject, body, useHtmlTemplate, template);
    return result;
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get queue status
 */
const getQueueStatus = () => {
  return emailQueue.getStatus();
};

/**
 * Graceful shutdown
 */
const shutdownEmailQueue = async () => {
  await emailQueue.shutdown();
};

module.exports = {
  sendEmail,
  getQueueStatus,
  shutdownEmailQueue
};

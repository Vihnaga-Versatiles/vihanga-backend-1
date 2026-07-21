const AWS = require("aws-sdk");
require("dotenv").config();

// Configure AWS SDK with environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create S3 service object
const s3 = new AWS.S3();

// Function to upload buffer to S3 with optional key prefix
const uploadFileToDrive = async (fileBuffer, fileName, mimeType, keyPrefix = "recruitementfiles") => {
  console.log(process.env.AWS_ACCESS_KEY_ID,'sdfasf')
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: `${keyPrefix}/${fileName}`,
      Body: fileBuffer,
      ContentType: mimeType || "application/octet-stream",
    };

    const response = await s3.upload(params).promise();

    console.log("File uploaded successfully. URL:", response.Location);

    return {
      key: response.Key,
      url: response.Location,
    };
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    // Surface the actual AWS error details to help debugging
    const code = error?.code ? `${error.code}: ` : "";
    const msg = error?.message || "Unknown S3 error";
    throw new Error(`Error uploading file to S3 - ${code}${msg}`);
  }
};

module.exports = {
  uploadFileToDrive,
};

// Delete object from S3 by key
const deleteFileFromDrive = async (key) => {
  if (!key) return { success: false, message: 'No S3 key provided' };
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    };
    await s3.deleteObject(params).promise();
    return { success: true };
  } catch (error) {
    console.error('Error deleting file from S3:', error.message);
    return { success: false, message: error.message };
  }
};

module.exports.deleteFileFromDrive = deleteFileFromDrive;

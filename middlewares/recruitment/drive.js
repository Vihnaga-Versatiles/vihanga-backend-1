const AWS = require("aws-sdk");
require("dotenv").config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();
const DEFAULT_SIGNED_URL_EXPIRY = 60 * 60; // 1 hour

const KNOWN_S3_PREFIXES = ["recruitementfiles/", "feedbackfiles/", "theme-logos/"];

const isS3Reference = (value) => {
  if (!value || typeof value !== "string") return false;
  if (value.includes("amazonaws.com")) return true;
  if (process.env.AWS_BUCKET_NAME && value.includes(process.env.AWS_BUCKET_NAME)) return true;
  return KNOWN_S3_PREFIXES.some((prefix) => value.startsWith(prefix));
};

const extractS3Key = (urlOrKey) => {
  if (!urlOrKey || typeof urlOrKey !== "string") return null;

  const trimmed = urlOrKey.trim();
  if (!trimmed.startsWith("http")) {
    return trimmed.replace(/^\/+/, "");
  }

  try {
    const parsed = new URL(trimmed);
    const pathname = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

    if (parsed.hostname.startsWith("s3.") || parsed.hostname === "s3.amazonaws.com") {
      const segments = pathname.split("/");
      if (segments[0] === process.env.AWS_BUCKET_NAME) {
        return segments.slice(1).join("/");
      }
      return pathname;
    }

    if (parsed.hostname.includes(".s3.") || parsed.hostname.endsWith(".s3.amazonaws.com")) {
      return pathname;
    }

    const bucketMarker = `${process.env.AWS_BUCKET_NAME}/`;
    const bucketIndex = trimmed.indexOf(bucketMarker);
    if (bucketIndex !== -1) {
      return decodeURIComponent(trimmed.slice(bucketIndex + bucketMarker.length).split("?")[0]);
    }
  } catch (error) {
    console.error("Failed to parse S3 URL:", error.message);
  }

  return null;
};

const getSignedDownloadUrl = (urlOrKey, expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRY) => {
  const key = extractS3Key(urlOrKey);
  if (!key) {
    throw new Error("Invalid S3 file reference");
  }

  return s3.getSignedUrl("getObject", {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Expires: expiresInSeconds,
  });
};

const getFileFromS3 = async (urlOrKey) => {
  const key = extractS3Key(urlOrKey);
  if (!key) {
    throw new Error("Invalid S3 file reference");
  }

  return s3.getObject({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  }).promise();
};

const signS3UrlIfNeeded = async (urlOrKey) => {
  if (!urlOrKey || typeof urlOrKey !== "string") return urlOrKey;
  if (!isS3Reference(urlOrKey)) return urlOrKey;

  try {
    return getSignedDownloadUrl(urlOrKey);
  } catch (error) {
    console.error("Failed to sign S3 URL:", error.message);
    return urlOrKey;
  }
};

const signS3UrlsInValue = async (value) => {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => signS3UrlsInValue(item)));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const result = value.toObject ? value.toObject() : { ...value };

  for (const [key, nestedValue] of Object.entries(result)) {
    if (typeof nestedValue === "string" && isS3Reference(nestedValue)) {
      result[key] = await signS3UrlIfNeeded(nestedValue);
    } else if (Array.isArray(nestedValue) || (nestedValue && typeof nestedValue === "object")) {
      result[key] = await signS3UrlsInValue(nestedValue);
    }
  }

  return result;
};

const uploadFileToDrive = async (fileBuffer, fileName, mimeType, keyPrefix = "recruitementfiles") => {
  try {
    const key = `${keyPrefix}/${fileName}`;
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType || "application/octet-stream",
    };

    await s3.upload(params).promise();

    const storedUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return {
      key,
      url: storedUrl,
    };
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    const code = error?.code ? `${error.code}: ` : "";
    const msg = error?.message || "Unknown S3 error";
    throw new Error(`Error uploading file to S3 - ${code}${msg}`);
  }
};

const deleteFileFromDrive = async (keyOrUrl) => {
  const key = extractS3Key(keyOrUrl);
  if (!key) return { success: false, message: "No S3 key provided" };

  try {
    await s3.deleteObject({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
    }).promise();
    return { success: true };
  } catch (error) {
    console.error("Error deleting file from S3:", error.message);
    return { success: false, message: error.message };
  }
};

module.exports = {
  uploadFileToDrive,
  deleteFileFromDrive,
  extractS3Key,
  getSignedDownloadUrl,
  getFileFromS3,
  signS3UrlIfNeeded,
  signS3UrlsInValue,
};

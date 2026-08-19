const AWS = require("aws-sdk");

const PORT = 4000;

const JWT_SECRET =
  "$2a$12$e9HMflla.nPm9t8LOopEdeTYD.fmAYbxQ4p6XbLNylKRgcDEMXPba";
// const CLIENTURL = "http://localhost:4300";
// const CLIENTURL="https://talentspotifyapp.com"
const CLIENTURL="https://hr.vihanga.io"

const PhsychometricURL = `${CLIENTURL}/psychometric-test`;
const expireTime = 24;

async function initializeEnvironment() {
  require("dotenv").config();

  try {
    const client = new AWS.SecretsManager({ region: "ap-south-1" });
    const result = await client
      .getSecretValue({ SecretId: "vihanga/prod/backend" })
      .promise();

    Object.assign(process.env, JSON.parse(result.SecretString));
    console.log("[Config] Loaded from .env + AWS Secrets Manager");
  } catch (error) {
    console.log("[Config] Loaded from .env only");
  }
}

module.exports = {
  initializeEnvironment,
  PORT,
  get DATABASE_URL() {
    return process.env.DATABASE_URL;
  },
  JWT_SECRET,
  CLIENTURL,
  PhsychometricURL,
  expireTime,
};

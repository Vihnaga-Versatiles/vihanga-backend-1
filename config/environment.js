const PORT = 4000

// const DATABASE_URL = `mongodb+srv://prasanth:Sai%4012345@cluster0.gmxleae.mongodb.net/vihanga-prod?retryWrites=true&w=majority`
const DATABASE_URL = `mongodb+srv://admin_db_user:7032031366@Aa@hr-vihanga.wzt14u.mongodb.net/pre-prod?retryWrites=true&w=majority`
//const DATABASE_URL = "mongodb://localhost:27017/talentSpotifyDB"

const JWT_SECRET = "$2a$12$e9HMflla.nPm9t8LOopEdeTYD.fmAYbxQ4p6XbLNylKRgcDEMXPba"
  // const CLIENTURL="http://localhost:4300";
// const CLIENTURL="https://talentspotifyapp.com"
const CLIENTURL="https://preprodhr.vihanga.io"

// Psychometric assessment now lives inside the main frontend app
const PhsychometricURL=`${CLIENTURL}/psychometric-test`;

const expireTime=24
module.exports = {
  PORT,
  DATABASE_URL,
  JWT_SECRET,
  CLIENTURL,
  PhsychometricURL,
}

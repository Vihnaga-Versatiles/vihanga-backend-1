const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const PsychometricUser = require("../../models/psychometric/PsychometricUserModel");
const { sendEmail } = require("../../middlewares/recruitment/sendMail");
const {
  JWT_SECRET,
  GOOGLE_CLIENT_ID,
} = require("../../config/environment");

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const successResponse = (res, statusCode, message, data = {}) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

// Email template sent to HR when a candidate submits the assessment
const assessmentSubmissionTemplate = ({
  candidateEmail,
  candidateId,
  customMessage,
}) => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Assessment Submitted</h2>
      <p><strong>Candidate Email:</strong> ${candidateEmail}</p>
      <p><strong>Candidate ID:</strong> ${candidateId}</p>
      <p>${customMessage}</p>
    </div>
  `;
};

// @desc  Get all psychometric users
// @route GET /api/psychometric/users
const fetchAllUsers = async (req, res) => {
  try {
    const users = await PsychometricUser.find();
    successResponse(res, 200, "Users fetched successfully", users);
  } catch (error) {
    console.error("Error fetching psychometric users:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc  Create a psychometric user
// @route POST /api/psychometric/users
const createUser = async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res
        .status(400)
        .json({ error: "Username and email are required" });
    }

    const userExists = await PsychometricUser.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = await PsychometricUser.create({ name: username, email });
    successResponse(res, 201, "User created successfully", user);
  } catch (error) {
    console.error("Error creating psychometric user:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc  Login/register a candidate via Google
// @route POST /api/psychometric/google-login
const loginGoogleUser = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const { email, name } = ticket.getPayload();

    if (!email) {
      return res
        .status(400)
        .json({ error: "Email not found in Google token" });
    }

    let user = await PsychometricUser.findOne({ email });

    if (user) {
      return res.status(200).json({
        message: "User already exists",
        token: jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "1d" }),
        user: { email: user.email, name: user.name },
      });
    }

    user = await PsychometricUser.create({ email, name });

    const jwtToken = jwt.sign({ id: user._id }, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      message: "User logged in successfully",
      token: jwtToken,
      user: { email: user.email, name: user.name },
    });
  } catch (error) {
    console.error("Error logging in user:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc  Save a candidate's assessment results
// @route POST /api/psychometric/save-results
const saveUserResults = async (req, res) => {
  try {
    const { email, results, candidateId, hr } = req.body;

    if (!email || !results) {
      return res.status(400).json({ error: "Email and results are required" });
    }

    let user = await PsychometricUser.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.results = results;
    if (candidateId) {
      user.candidateId = candidateId;
    }
    await user.save();

    if (hr) {
      sendEmail(
        hr,
        "Assessment Submission Notification",
        {
          candidateEmail: email,
          candidateId: candidateId || "Not Provided",
          customMessage: `The candidate has successfully submitted the assessment.`,
        },
        false,
        assessmentSubmissionTemplate
      );
    }

    res.status(200).json({ message: "User results saved successfully", user });
  } catch (error) {
    console.error("Error saving user results:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc  Fetch a candidate's assessment results
// @route GET /api/psychometric/user-results?candidateId=
const getUserResults = async (req, res) => {
  try {
    const { candidateId } = req.query;
    if (!candidateId) {
      return res.status(400).json({ error: "No Results Found For you !" });
    }

    const user = await PsychometricUser.findOne({ candidateId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      name: user?.name,
      email: user?.email,
      candidateId: user?.candidateId,
      results: user?.results || {},
    });
  } catch (error) {
    console.error("Error fetching user results:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  fetchAllUsers,
  createUser,
  loginGoogleUser,
  saveUserResults,
  getUserResults,
};

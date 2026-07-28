const jwt = require("jsonwebtoken");
const PsychometricUser = require("../../models/psychometric/PsychometricUserModel");
const { sendEmail } = require("../../middlewares/recruitment/sendMail");
const { JWT_SECRET } = require("../../config/environment");

const inviteJwtSecret = () => process.env.JWT_SECRET || JWT_SECRET;

const successResponse = (res, statusCode, message, data = {}) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const isAssessmentCompleted = (user) => {
  if (!user) return false;
  if (user.assessmentCompleted) return true;
  const results = user.results;
  if (!results || typeof results !== "object") return false;
  return Object.values(results).some(
    (value) => typeof value === "number" && value > 0
  );
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

// @desc  Authenticate candidate via invite link (token + email + candidateId)
// @route POST /api/psychometric/invite-login
const inviteLogin = async (req, res) => {
  try {
    const { token, email, candidateId } = req.body;

    if (!token || !email || !candidateId) {
      return res.status(400).json({
        error: "token, email, and candidateId are required",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, inviteJwtSecret());
    } catch (err) {
      const message =
        err.name === "TokenExpiredError"
          ? "This test link has expired. Please ask HR to resend the invitation."
          : "This test link is invalid. Please use the link from your email.";
      return res.status(401).json({ error: message });
    }

    const tokenEmail = decoded?.email?.toLowerCase?.()?.trim?.();
    const requestEmail = email.toLowerCase().trim();
    const tokenCandidateId = String(decoded?.candidateId || "");
    const requestCandidateId = String(candidateId);

    if (
      !tokenEmail ||
      tokenEmail !== requestEmail ||
      tokenCandidateId !== requestCandidateId
    ) {
      return res.status(401).json({
        error: "This test link does not match the candidate details.",
      });
    }

    let user = await PsychometricUser.findOne({
      $or: [{ candidateId: requestCandidateId }, { email: requestEmail }],
    });

    if (!user) {
      user = await PsychometricUser.create({
        email: requestEmail,
        candidateId: requestCandidateId,
        name: decoded?.name || requestEmail.split("@")[0],
      });
    } else {
      let dirty = false;
      if (!user.candidateId) {
        user.candidateId = requestCandidateId;
        dirty = true;
      }
      if (!user.email) {
        user.email = requestEmail;
        dirty = true;
      }
      if (dirty) {
        await user.save();
      }
    }

    const completed = isAssessmentCompleted(user);

    return res.status(200).json({
      message: completed
        ? "Assessment already completed"
        : "Invite verified successfully",
      completed,
      user: {
        email: user.email,
        name: user.name,
        candidateId: user.candidateId,
      },
    });
  } catch (error) {
    console.error("Error during invite login:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// @desc  Save a candidate's assessment results
// @route POST /api/psychometric/save-results
const saveUserResults = async (req, res) => {
  try {
    const { email, results, candidateId, hr, token } = req.body;

    if (!email || !results) {
      return res.status(400).json({ error: "Email and results are required" });
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, inviteJwtSecret());
        if (
          decoded?.email?.toLowerCase?.()?.trim?.() !==
            email.toLowerCase().trim() ||
          (candidateId &&
            String(decoded?.candidateId || "") !== String(candidateId))
        ) {
          return res.status(401).json({ error: "Invalid session token" });
        }
      } catch (err) {
        return res.status(401).json({
          error:
            err.name === "TokenExpiredError"
              ? "Session expired. Please open the link from your email again."
              : "Invalid session token",
        });
      }
    }

    let user = await PsychometricUser.findOne({
      $or: [
        ...(candidateId ? [{ candidateId: String(candidateId) }] : []),
        { email: email.toLowerCase().trim() },
      ],
    });

    if (!user) {
      user = await PsychometricUser.create({
        email: email.toLowerCase().trim(),
        candidateId: candidateId ? String(candidateId) : undefined,
      });
    }

    if (isAssessmentCompleted(user)) {
      return res.status(400).json({
        error: "Assessment already completed",
        completed: true,
      });
    }

    user.results = results;
    user.assessmentCompleted = true;
    if (candidateId) {
      user.candidateId = String(candidateId);
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

    const completed = isAssessmentCompleted(user);

    res.status(200).json({
      name: user?.name,
      email: user?.email,
      candidateId: user?.candidateId,
      results: user?.results || {},
      completed,
    });
  } catch (error) {
    console.error("Error fetching user results:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  fetchAllUsers,
  createUser,
  inviteLogin,
  saveUserResults,
  getUserResults,
};

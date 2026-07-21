const JobModel = require("../models/job.model");
const JobApplicationModel = require("../models/jobApplication.model");
const CandidateModel = require("../models/recruitment/Candidate/CandidateModel");
const path = require("path");
const ejs = require("ejs");
const { sendEmail } = require("../middlewares/recruitment/sendMail");

/** Default companyId for candidates created from career-page job applications (optional env) */
const DEFAULT_COMPANY_ID_LANDING = process.env.DEFAULT_COMPANY_ID_FOR_LANDING || "";

/**
 * Create a candidate in recruitment list (first stage "New Applied") from a job application.
 * Best-effort: does not fail the application flow if candidate create fails (e.g. duplicate).
 * @param {object} application - Saved JobApplication document
 * @param {object} job - Job document
 * @param {string} [companyIdFromRequest] - companyId from request body (e.g. sent by landing app); overrides env default
 */
const createCandidateFromJobApplication = async (application, job, companyIdFromRequest) => {
  try {
    const companyId = (companyIdFromRequest && String(companyIdFromRequest).trim()) || DEFAULT_COMPANY_ID_LANDING;
    const candidateId = `CAND-JA-${application._id}`;
    const dobPlaceholder = "1990-01-01"; // Required by Candidate model; applicant can update later

    const existing = await CandidateModel.findOne({
      ...(companyId ? { companyId } : {}),
      $or: [
        { email: application.email },
        { candidateId },
      ],
    });
    if (existing) {
      return;
    }

    await CandidateModel.create({
      candidateId,
      candidateName: application.name,
      email: application.email,
      phone: application.phone,
      dob: dobPlaceholder,
      status: "New Applied",
      source: "Career Page",
      designation: job.title,
      department: job.department || "",
      location: job.location || "",
      resume: application.cvURL,
      companyId,
      appliedOn: application.createdAt || new Date(),
      interviewer1: {},
      interviewer2: {},
      reportingManager: {},
      profileDetails: {
        address: application.company ? String(application.company) : undefined,
        phoneNumber: application.phone,
        emailId: application.email,
      },
    });
  } catch (err) {
    if (err.code === 11000) {
      return;
    }
    console.error("createCandidateFromJobApplication:", err.message);
  }
};

const successResponse = ({ message, data, ...rest }) => ({
  success: true,
  data: data !== undefined ? data : null,
  message,
  ...rest,
});
const failResponse = ({ message, data, ...rest }) => ({
  success: false,
  data: data !== undefined ? data : null,
  message,
  ...rest,
});

// GET /landing/jobs - list open jobs (public)
const listJobs = async (req, res) => {
  try {
    const status = req.query.status || "open";
    const jobs = await JobModel.find({ status })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).send(
      successResponse({
        message: "Jobs retrieved successfully",
        data: jobs,
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to retrieve jobs",
      })
    );
  }
};

// GET /landing/jobs/all - list all jobs (admin)
const listAllJobs = async (req, res) => {
  try {
    const jobs = await JobModel.find().sort({ createdAt: -1 }).lean();
    return res.status(200).send(
      successResponse({
        message: "Jobs retrieved successfully",
        data: jobs,
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to retrieve jobs",
      })
    );
  }
};

// GET /landing/jobs/:id - get single job (public)
const getJobById = async (req, res) => {
  try {
    const job = await JobModel.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).send(
        failResponse({ message: "Job not found" })
      );
    }
    return res.status(200).send(
      successResponse({
        message: "Job retrieved successfully",
        data: job,
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to retrieve job",
      })
    );
  }
};

// POST /landing/jobs - create job (admin)
const createJob = async (req, res) => {
  try {
    const { title, description, location, department, status } = req.body;
    if (!title || !description) {
      return res.status(400).send(
        failResponse({ message: "Title and description are required" })
      );
    }
    const job = new JobModel({
      title,
      description: description || "",
      location: location || "",
      department: department || "",
      status: status || "open",
    });
    await job.save();
    return res.status(201).send(
      successResponse({
        message: "Job created successfully",
        data: job,
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to create job",
      })
    );
  }
};

// PUT /landing/jobs/:id - update job (admin)
const updateJob = async (req, res) => {
  try {
    const { title, description, location, department, status } = req.body;
    const payload = {};
    if (title !== undefined) payload.title = title;
    if (description !== undefined) payload.description = description;
    if (location !== undefined) payload.location = location;
    if (department !== undefined) payload.department = department;
    if (status !== undefined) payload.status = status;
    const job = await JobModel.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).lean();
    if (!job) {
      return res.status(404).send(
        failResponse({ message: "Job not found" })
      );
    }
    return res.status(200).send(
      successResponse({
        message: "Job updated successfully",
        data: job,
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to update job",
      })
    );
  }
};

// DELETE /landing/jobs/:id - delete job and its applications (admin)
const deleteJob = async (req, res) => {
  try {
    const job = await JobModel.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).send(
        failResponse({ message: "Job not found" })
      );
    }
    await JobApplicationModel.deleteMany({ jobId: req.params.id });
    await JobModel.findByIdAndDelete(req.params.id);
    return res.status(200).send(
      successResponse({
        message: "Job deleted successfully",
        data: null,
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to delete job",
      })
    );
  }
};

// POST /landing/jobs/:id/apply - submit application (public)
const submitApplication = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await JobModel.findById(jobId);
    if (!job) {
      return res.status(404).send(
        failResponse({ message: "Job not found" })
      );
    }
    if (job.status !== "open") {
      return res.status(400).send(
        failResponse({ message: "This job is no longer accepting applications" })
      );
    }
    const { name, email, phone, linkedinURL, cvURL, company, companyId } = req.body;
    if (!name || !email || !phone || !cvURL) {
      return res.status(400).send(
        failResponse({
          message: "Name, email, phone and CV are required",
        })
      );
    }
    const application = new JobApplicationModel({
      jobId,
      name,
      email,
      phone,
      linkedinURL: linkedinURL || "",
      cvURL,
      company: company || "",
    });
    await application.save();

    // Add to recruitment candidate list (first stage "New Applied"); use companyId from body so list can be fetched by company
    await createCandidateFromJobApplication(application, job, companyId);

    // Optional: send email using existing career template if needed
    const careerTemplate = path.resolve(
      __dirname,
      "../views/templates/career.ejs"
    );
    const logoUrl = process.env.DEFAULT_LOGO_URL || null;
    const requestBody = { name, linkedinURL: linkedinURL || "", email, phone, cvURL };
    ejs.renderFile(
      careerTemplate,
      { user: requestBody, logoUrl },
      function (err, data) {
        if (!err && data) {
          sendEmail(
            ["aneel@appsdreamz.com", "aneel@talentspotify.com", email],
            `Application: ${job.title}`,
            data,
            true,
            () => data
          ).catch(() => {});
        }
      }
    );

    return res.status(201).send(
      successResponse({
        message: "Application submitted successfully",
        data: { id: application._id },
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Application not submitted",
      })
    );
  }
};

// GET /landing/jobs/:id/applications - list applications for a job (admin)
const getApplicationsByJobId = async (req, res) => {
  try {
    const job = await JobModel.findById(req.params.id).lean();
    if (!job) {
      return res.status(404).send(
        failResponse({ message: "Job not found" })
      );
    }
    const applications = await JobApplicationModel.find({
      jobId: req.params.id,
    })
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).send(
      successResponse({
        message: "Applications retrieved successfully",
        data: { job, applications },
      })
    );
  } catch (err) {
    return res.status(500).send(
      failResponse({
        message: err ? err.message : "Failed to retrieve applications",
      })
    );
  }
};

module.exports = {
  listJobs,
  listAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  submitApplication,
  getApplicationsByJobId,
};

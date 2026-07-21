const express = require("express");
const { requestDemo, sendBirthdayWish, getAllWishes, contactUs, career, emailsignup } = require("../controllers/landing.controller");
const {
  listJobs,
  listAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  submitApplication,
  getApplicationsByJobId,
} = require("../controllers/jobs.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/landing";
router.post(`${prefix}/requestDemo`, requestDemo);
router.post(`${prefix}/contactus`, contactUs);
router.post(`${prefix}/career`, career);
router.post(`${prefix}/emailsignup`, emailsignup);
router.post(`${prefix}/sendBirthdayWish`, sendBirthdayWish);
router.get(`${prefix}/wishes`, getAllWishes);

// Jobs (career page + admin)
router.get(`${prefix}/jobs`, listJobs);
router.get(`${prefix}/jobs/all`, listAllJobs);
router.get(`${prefix}/jobs/:id`, getJobById);
router.post(`${prefix}/jobs`, createJob);
router.put(`${prefix}/jobs/:id`, updateJob);
router.delete(`${prefix}/jobs/:id`, deleteJob);
router.post(`${prefix}/jobs/:id/apply`, submitApplication);
router.get(`${prefix}/jobs/:id/applications`, getApplicationsByJobId);

module.exports = router;
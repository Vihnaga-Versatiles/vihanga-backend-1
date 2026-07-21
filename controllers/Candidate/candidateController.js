// imports

// const {sendEmail} = require("../../middlewares/recruitment/sendMail");
const { sendEmail } = require("../../middlewares/recruitment/sendMail");
const { uploadFileToDrive } = require("../../middlewares/recruitment/drive");
const CandidateModel = require("../../models/recruitment/Candidate/CandidateModel");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const {
  errorResponse,
  successResponse,
} = require("../../utils/recruitment/responseHandler");
var path = require("path");
var os = require("os");
const { CLIENTURL, PhsychometricURL } = require("../../config/environment");
const employeeModel = require("../../models/employee.model");


const createCandidate = async (req, res) => {
  try {
    const {
      candidateId,
      candidateName,
      email,
      phone,
      dob,
      gender,
      location,
      source,
      department,
      designation,
      legalEntity,
      status,
      appliedOn,
      interviewer1,
      interviewer2,
      reportingManager,
      projectName,
      grossSalary,
      noticePeriod,
      probationPeriod,
      moveToTalentPool,
      companyId,
      experience,
      educationQualification,
      // insurance details fields (restricted model)
      coverageFor,
      spouseName,
      spouseDob,
      child1Name,
      child1Dob,
      child2Name,
      child2Dob,
      // personalDetails fields
      personalDetails,
      profileDetails,
      bankDetails,
      familyDetails,
      // Root level fields
      title,
      middleName,
      panNumber,
      countryOfBirth,
      stateOfBirth,
      cityStateOfBirth,
      nationality,
      marriageDate,
      fatherName,
      bloodGroup,
      maritalStatus,
      pfNumber,
    } = req.body;

    // Validate required fields
    if (!candidateName || !dob) {
      return errorResponse(res, new Error("Candidate name and date of birth are required"), 400);
    }

    // Validate offer letter fields if status is Offer Letter
    if (status === "Offer Letter") {
      if (!grossSalary || !noticePeriod || !probationPeriod) {
        return errorResponse(res, new Error("Gross salary, notice period and probation period are required for Offer Letter status"), 400);
      }
    }

    // Build conditions for existing candidate check
    const existingConditions = [{ candidateName, dob: new Date(dob) }];
    
    if (email) existingConditions.push({ email });
    if (phone) existingConditions.push({ phone });

    // Single query to check for existing candidates within the same company
    const existingCandidate = await CandidateModel.findOne({
      $and: [
        { companyId },
        { $or: existingConditions }
      ]
    });

    if (existingCandidate) {
      // Determine exactly which field caused the conflict
      let conflictField;
      if (existingCandidate.candidateName === candidateName && 
          new Date(existingCandidate.dob).toISOString() === new Date(dob).toISOString()) {
        conflictField = "name and date of birth combination";
      } else if (email && existingCandidate.email === email) {
        conflictField = "email address";
      } else if (phone && existingCandidate.phone === phone) {
        conflictField = "phone number";
      }

      return errorResponse(res, new Error(`A candidate with this ${conflictField} already exists`), 400);
    }

    // Handle file uploads
    let imageUrl = null;
    let resumeUrl = null;
    // policyDocument handling deprecated

    if (req.files) {
      for (const file of req.files) {
        if (file.fieldname === "photo") {
          const uploaded = await uploadFileToDrive(
            file.buffer,
            file.originalname,
            file.mimetype
          );
          imageUrl = uploaded.url;
        }
        if (file.fieldname === "resume") {
          const uploaded = await uploadFileToDrive(
            file.buffer,
            file.originalname,
            file.mimetype
          );
          resumeUrl = uploaded.url;
        }
      }
    }

    // Assemble insurance details (support nested object or flat fields)
    let insuranceDetails = undefined;
    if (req.body.insuranceDetails && typeof req.body.insuranceDetails === 'string') {
      try {
        insuranceDetails = JSON.parse(req.body.insuranceDetails);
      } catch (_) {}
    } else if (req.body.insuranceDetails && typeof req.body.insuranceDetails === 'object') {
      insuranceDetails = req.body.insuranceDetails;
    } else {
      insuranceDetails = {
        coverageFor: coverageFor || 'self_only',
        spouseName,
        spouseDob: spouseDob ? new Date(spouseDob) : undefined,
        child1Name,
        child1Dob: child1Dob ? new Date(child1Dob) : undefined,
        child2Name,
        child2Dob: child2Dob ? new Date(child2Dob) : undefined,
      };
    }

    // Validate insurance details for family coverage
    if (insuranceDetails && insuranceDetails.coverageFor === 'self_family') {
      const missing = [];
      if (!insuranceDetails.spouseName) missing.push('spouseName');
      if (!insuranceDetails.spouseDob) missing.push('spouseDob');
      if (!insuranceDetails.child1Name) missing.push('child1Name');
      if (!insuranceDetails.child1Dob) missing.push('child1Dob');
      if (!insuranceDetails.child2Name) missing.push('child2Name');
      if (!insuranceDetails.child2Dob) missing.push('child2Dob');
      if (missing.length) {
        return errorResponse(res, new Error(`Missing required insurance fields for Self + Family: ${missing.join(', ')}`), 400);
      }
    }

    // Parse nested objects if they are strings
    const parsedPersonalDetails = personalDetails && typeof personalDetails === 'string' 
      ? JSON.parse(personalDetails) 
      : personalDetails;
    const parsedProfileDetails = profileDetails && typeof profileDetails === 'string' 
      ? JSON.parse(profileDetails) 
      : profileDetails;
    const parsedBankDetails = bankDetails && typeof bankDetails === 'string' 
      ? JSON.parse(bankDetails) 
      : bankDetails;
    const parsedFamilyDetails = familyDetails && typeof familyDetails === 'string' 
      ? JSON.parse(familyDetails) 
      : familyDetails;

    // Create new candidate
    const newCandidate = await CandidateModel.create({
      candidateId,
      candidateName,
      email,
      phone,
      dob: new Date(dob),
      gender,
      location,
      source,
      department,
      designation,
      legalEntity,
      status,
      projectName,
      appliedOn: appliedOn ? new Date(appliedOn) : new Date(),
      interviewer1: interviewer1 || {},
      interviewer2: interviewer2 || {},
      reportingManager: reportingManager || {},
      grossSalary,
      noticePeriod,
      probationPeriod,
      moveToTalentPool,
      image: imageUrl,
      resume: resumeUrl,
      companyId,
      experience,
      educationQualification,
      // Root level fields
      title,
      middleName,
      panNumber,
      countryOfBirth,
       cityStateOfBirth, // Map cityStateOfBirth to stateOfBirth
      nationality,
      marriageDate,
      maritalStatus,
      fatherName,
      bloodGroup,
      pfNumber, // Map pf to pfNumber
      ...(insuranceDetails ? { insuranceDetails } : {}),
      ...(parsedPersonalDetails ? { personalDetails: parsedPersonalDetails } : {}),
      ...(parsedProfileDetails ? { profileDetails: parsedProfileDetails } : {}),
      ...(parsedBankDetails ? { bankDetails: parsedBankDetails } : {}),
      ...(parsedFamilyDetails ? { familyDetails: parsedFamilyDetails } : {}),
    });

    return res.status(201).json({
      success: true,
      message: "Candidate created successfully",
      data: newCandidate
    });

  } catch (error) {
    console.error("Error creating candidate:", error);
    
    // Handle duplicate key error (race condition fallback)
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      let fieldName = duplicateField;
      
      if (duplicateField === 'candidateName') fieldName = 'name';
      if (duplicateField === 'dob') fieldName = 'date of birth';

      // Use shared error handler so it is persisted in ErrorLogs
      return errorResponse(res, {
        message: `A candidate with this ${fieldName} already exists`,
        conflictField: duplicateField,
        keyPattern: error.keyPattern,
        keyValue: error.keyValue,
      }, 400);
    }

    // Handle other errors
    return errorResponse(res, error, 500);
  }
};

const getAllCandidates = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;
    const companyId = req.query.companyId;

    const filters = {};

    // Company filter
    if (companyId) {
      filters.companyId = companyId;
    }

    // Status filter
    if (req.query.status && req?.query?.status.toLowerCase() !== "all") {
      let statusValue = req?.query?.status;
      filters.status = {
        $regex: `^${statusValue}$`,
        $options: "i",
      };
    }

    // Individual field filters
    if (req.query.candidateId) {
      filters.candidateId = { $regex: new RegExp(req.query.candidateId, "i") };
    }
    if (req.query.candidateName) {
      filters.candidateName = { $regex: new RegExp(req.query.candidateName, "i") };
    }
    if (req.query.department) {
      filters.department = { $regex: new RegExp(req.query.department, "i") };
    }
    if (req.query.position) {
      filters.designation = { $regex: new RegExp(req.query.position, "i") };
    }
    if (req.query.stage) {
      filters.status = { $regex: new RegExp(req.query.stage, "i") };
    }

    // Date range filters
    if (req.query.fromDate || req.query.toDate) {
      filters.appliedOn = {};
      if (req.query.fromDate) {
        filters.appliedOn.$gte = new Date(req.query.fromDate);
      }
      if (req.query.toDate) {
        filters.appliedOn.$lte = new Date(req.query.toDate);
      }
    }

    // Search functionality (across multiple fields)
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filters.$or = [
        { candidateId: searchRegex },
        { candidateName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { department: searchRegex },
        { designation: searchRegex },
        { location: searchRegex },
        { source: searchRegex },
      ];
    }

    const total = await CandidateModel.countDocuments(filters);
    const candidates = await CandidateModel.find(filters)
      .sort({ appliedOn: -1 }) // Sort by most recent applications first
      .skip(skip)
      .limit(limit);

    const result = {
      totalRecords: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: candidates,
    };

    return successResponse(res, result, "Fetched candidates with pagination");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getSummary = async (req, res) => {
  try {
    const companyId = req.query.companyId;

    // Create a base filter object
    const baseMatch = {};
    
    // Add companyId to filter if provided
    if (companyId) {
      baseMatch.companyId = companyId;
    }

    // Fetch documents with company filter applied to all stages
    const results = await CandidateModel.aggregate([
      {
        $facet: {
          newCandidate: [
            { $match: { ...baseMatch, status: "New Applied" } }
          ],
          inProgress: [
            { $match: { ...baseMatch, status: "Psychometric Test" } }
          ],
          waitingForFeedback: [
            { $match: { ...baseMatch, status: { $in: ["Interview 1", "Interview 2"] } } }
          ],
          offerReleased: [
            { $match: { ...baseMatch, status: { $in: ["Onboarding", "Shortlisted","Offer Letter"] } } }
          ],
          total: [
            { $match: baseMatch } 
          ],
        },
      },
    ]);

    return successResponse(
      res,
      results[0],
      "Candidate summary fetched successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};


const getCandidateById = async (req, res) => {
  try {
    const { _id: userId } = req?.query;

    // console.log("get by id for id chaking", userId);

    // console.log("user id", userId);
    if (!userId) {
      return errorResponse(
        res,
        new Error("UserId  query parameter is required"),

        400
      );
    }

    const candidate = await CandidateModel.find({ candidateId: userId });

    if (!candidate) {
      return errorResponse(res, new Error("Candidate not found"), 404);
    }

    return successResponse(res, candidate, "Candidate fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getCandidatesAll = async (req, res) => {
  try {
    const companyId = req.query.companyId;
    const filters = {};
    if (companyId) {
      filters.companyId = companyId;
    }
    const candidate = await CandidateModel.find(filters);

    if (!candidate) {
      return errorResponse(res, new Error("Candidate not found"), 404);
    }

    return successResponse(res, candidate, "Candidate fetched successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const deleteCandidateById = async (req, res) => {
  try {
    const { _id: userId } = req?.query;

    // console.log("user id", userId);
    if (!userId) {
      return errorResponse(
        res,
        new Error("UserId  query parameter is required"),
        400
      );
    }
    const deletedCandidate = await CandidateModel.findByIdAndDelete(userId);

    if (!deletedCandidate) {
      return errorResponse(res, new Error("Candidate not found"), 404);
    }

    return successResponse(
      res,
      deletedCandidate,
      "Candidate deleted successfully"
    );
  } catch (error) {
    return errorResponse(res, error);
  }
};






const UpdateCandiate = async (req, res) => {
  try {
    const { candidateId: userId, interviewer1, interviewer2, status, hr } = req.body;

    if (!userId) {
      return errorResponse(res, new Error("CandidateId is required"), 400);
    }

    const candidate = await CandidateModel.findOne({ candidateId: userId });
    if (!candidate) {
      return errorResponse(res, new Error("Candidate not found"), 404);
    }

    const updateData = { ...req.body };

    const fieldsToParse = ["profileDetails", "personalDetails", "bankDetails", "familyDetails", "insuranceDetails"];
    fieldsToParse.forEach((field) => {
      if (updateData[field] && typeof updateData[field] === "string") {
        try {
          updateData[field] = JSON.parse(updateData[field]);
        } catch (error) {
          console.error(`Error parsing ${field}:`, error);
        }
      }
    });

    // Handle childInfoList date conversion if provided
    if (updateData.childInfoList && Array.isArray(updateData.childInfoList)) {
      updateData.childInfoList = updateData.childInfoList.map(child => ({
        ...child,
        dateOfBirth: child.dateOfBirth ? new Date(child.dateOfBirth) : null
      }));
    }

    // Handle personalDetails.spouseDetails.dateOfBirth date conversion if provided
    if (updateData.personalDetails && updateData.personalDetails.spouseDetails && updateData.personalDetails.spouseDetails.dateOfBirth) {
      updateData.personalDetails.spouseDetails.dateOfBirth = new Date(updateData.personalDetails.spouseDetails.dateOfBirth);
    }

    // Validate insurance details on update if provided
    if (updateData.insuranceDetails) {
      const cov = updateData.insuranceDetails.coverageFor || 'self_only';
      if (cov === 'self_family') {
        const missing = [];
        if (!updateData.insuranceDetails.spouseName) missing.push('spouseName');
        if (!updateData.insuranceDetails.spouseDob) missing.push('spouseDob');
        if (!updateData.insuranceDetails.child1Name) missing.push('child1Name');
        if (!updateData.insuranceDetails.child1Dob) missing.push('child1Dob');
        if (!updateData.insuranceDetails.child2Name) missing.push('child2Name');
        if (!updateData.insuranceDetails.child2Dob) missing.push('child2Dob');
        if (missing.length) {
          return errorResponse(res, new Error(`Missing required insurance fields for Self + Family: ${missing.join(', ')}`), 400);
        }
      }
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await uploadFileToDrive(
          file.buffer,
          file.originalname,
          file.mimetype
        );
        if (file.fieldname === "photo") {
          updateData.image = uploaded.url;
        } else if (file.fieldname === "resume") {
          updateData.resume = uploaded.url;
        } else {
          updateData[file.fieldname] = uploaded.url;
        }
      }
    }

    //status get logic------------
    const previousStatus = candidate?.status?.toLowerCase().trim();
    const newStatus = status?.toLowerCase().trim();
    //status get logic------------

    if (
      newStatus === "psychometric test" &&
      previousStatus !== "psychometric test"
    ) {
      const payload = {
        candidateId: userId,
        email: updateData?.email,
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "2h" }
      );

      const testLink = `${PhsychometricURL}?candidateId=${userId}&token=${token}&hr=${hr}&email=${updateData?.email}`;

      sendEmail(
        updateData?.email,
        "Psychometric Test",
        {
          name: updateData?.candidateName,
          status: updateData?.status,
          testLink,
        },
        true
      );
    }

    const normalizedStatus = newStatus?.replace(/\s+/g, " ").toLowerCase();
    if (
      (normalizedStatus === "interview 1" ||
        normalizedStatus === "interview 2") &&
      previousStatus !== newStatus
    ) {
      const feedbackMap = {
        "interview 1": updateData?.interviewer1?.email,
        "interview 2": updateData?.interviewer2?.email,
      };
      // console.log(feedbackMap);
      const feedbackEmail = feedbackMap[normalizedStatus];
      // console.log(normalizedStatus, feedbackEmail, "testingg");
      if (feedbackEmail) {
        const payload = {
          candidateId: userId,
          email: feedbackEmail,
        };

        const token = jwt.sign(
          payload,
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "2h" }
        );
        const isInterviewer1 = normalizedStatus === "interview 1";

        const testLink = `${CLIENTURL}/candidate/interviewer/feedback?candidateId=${userId}&token=${token}&round=${normalizedStatus}&interviewer=${isInterviewer1 ? interviewer1?.name : interviewer2?.name}`;

        sendEmail(
          feedbackEmail,
          `Interview Feedback - ${updateData?.status}`,
          {
            name: isInterviewer1 ? (interviewer1?.name || interviewer1?.label)  : (interviewer2?.name || interviewer2?.label ),
            status: updateData?.status,
            testLink,
            isFeedback: true,
          },
          true
        );
      }
    }

    if (
      normalizedStatus === "interview 1" ||
      normalizedStatus === "interview 2"
    ) {
      const key =
        normalizedStatus === "interview 1" ? "interviewer1" : "interviewer2";
        const isInterviewer1 = normalizedStatus === "interview 1";
      updateData[key] = {
        name: isInterviewer1 ? (interviewer1?.name || interviewer1?.label)  : (interviewer2?.name || interviewer2?.label ),
        email: isInterviewer1 ? interviewer1?.email : interviewer2?.email,
        id: isInterviewer1 ? interviewer1?.key : interviewer2?.key,
        feedbackId: isInterviewer1 ? interviewer1?.feedbackId : interviewer2?.feedbackId || null,
      };
    }

    if (
      newStatus === "document upload" &&
      previousStatus !== "document upload"
    ) {
      const payload = {
        candidateId: userId,
        email: updateData?.email,
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "2h" }
      );

      const testLink = `${CLIENTURL}/candidate/document-upload?candidateId=${userId}&token=${token}&round=${normalizedStatus}&hr=${hr}`;

      console.log("testLinkat docuement upload", testLink);
      sendEmail(
        updateData?.email,
        `Document Upload`,
        {
          name: updateData?.candidateName,
          status: updateData?.status,
          testLink,
          documentUpload: true,
        },
        true
      );
    }

    //onboarding logicc --------------

    // console.log("previous and new statues",previousStatus,"---",newStatus)

    if (newStatus === "onboarding" && previousStatus !== "onboarding") {
      const payload = {
        candidateId: userId,
        email: updateData?.email,
      };

      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "2h" }
      );

      // http://localhost:4300/admin/previlages/profile

      const testLink = `${CLIENTURL}/candidate/profile?candidateId=${userId}&token=${token}&round=${normalizedStatus}${hr ? `&hr=${hr}` : ''}`;

      sendEmail(
        updateData?.email,
        `Onboarding`,
        {
          name: updateData?.candidateName,
          status: updateData?.status,
          testLink,
          Onboarding: true,
        },
        true
      );
    }
    if (newStatus?.toLowerCase() === ("Convert to Employee")?.toLowerCase() && previousStatus?.toLowerCase() !== ("Convert to Employee")?.toLowerCase()) {
      try {
        const employee = await convertToEmployee(candidate, updateData);
        if (employee) {
          console.log(`Candidate ${candidate.candidateId} ${employee.employmentInformation?.employeeNumber ? 'converted to' : 'already exists as'} employee ${employee.employmentInformation?.employeeNumber || 'N/A'}`);
          
          // Send email to candidate about conversion using credentialsEmail template
          sendEmail(
         updateData?.email,
            "Your Credentials",
            {
              name: updateData?.candidateName,
              email: employee.contactInformation?.email || updateData?.email,
              credentialsEmail: true,
              credentialsDetails: {
                loginEmail: employee.contactInformation?.email || updateData?.email,
                password: "Test@123", // Default password from employee model
                loginUrl: "https://vihanga.talentspotifyapp.com/auth/login",
              },
            },
            true
          );
        }
      } catch (error) {
        console.error("Error in convert to employee process:", error);
        // Don't fail the entire update if conversion fails
      }
    }

    // Offer Letter logic
    if (newStatus?.toLowerCase() == "offer letter") {
      updateData.showOfferLetter = true;
    }

    const updatedCandidate = await CandidateModel.findOneAndUpdate(
      { candidateId: userId },
      updateData,
      { new: true }
    );

    // Send email to HR when onboarding form is submitted
    // Check if candidate status is "Onboarding" (was already in onboarding, not just changed to it)
    // and onboarding form fields are being updated (indicating form submission)
    const wasAlreadyOnboarding = candidate?.status?.toLowerCase().trim() === "onboarding";
    const hasOnboardingFormFields = !!(updateData.personalDetails || 
                                       updateData.profileDetails || 
                                       updateData.bankDetails || 
                                       updateData.familyDetails || 
                                       updateData.insuranceDetails || 
                                       updateData.childInfoList);
    
    // Get HR email from request body or query params (fallback)
    const hrEmail = hr || req.query.hr;
    
    // Only send email if candidate was already in onboarding status and is submitting form data
    // This prevents sending email when status just changes to onboarding (that's handled above)
    if (wasAlreadyOnboarding && hasOnboardingFormFields && hrEmail) {
      try {
        await sendEmail(
          hrEmail,
          "Candidate Onboarding Form Submitted",
          {
            name: updatedCandidate?.candidateName || candidate?.candidateName,
            email: updatedCandidate?.email || candidate?.email,
            id: updatedCandidate?.candidateId || candidate?.candidateId,
            message: "Candidate has successfully submitted the onboarding form.",
            documentUploadTemplateHR: true, // Reusing the HR template for onboarding notification
          },
          true
        );
      } catch (emailError) {
        console.error("Error sending onboarding form submission email to HR:", emailError);
        // Don't fail the entire update if email fails
      }
    } else if (wasAlreadyOnboarding && hasOnboardingFormFields && !hrEmail) {
      console.warn(`Onboarding form submitted for candidate ${userId} but HR email not provided. Email notification skipped.`);
    }

    return successResponse(
      res,
      updatedCandidate,
      "Candidate updated successfully",
      200
    );
  } catch (error) {
    console.error("Update Error:", error);
    return errorResponse(res, error);
  }
};

const convertToEmployee = async (candidate, updateData) => {
  console.log(candidate,'sdkfjsndfkjdsn')
  try {
    // Check if employee already exists for this candidate
    const existingEmployee = await employeeModel.findOne({
      'candidateInformation.originalCandidateId': candidate.candidateId
    });

    if (existingEmployee) {
      console.log(`Employee already exists for candidate ${candidate.candidateId} with employee number ${existingEmployee.employmentInformation?.employeeNumber}`);
      return existingEmployee; // Return existing employee instead of creating new one
    }

    // Generate unique employee number by finding the last employee and incrementing
    let employeeNumber;
    try {
      // Find the last employee sorted by employeeNumber in descending order
      const lastEmployee = await employeeModel
        .findOne({ 'employmentInformation.employeeNumber': { $regex: /^EMP\d+$/ } })
        .sort({ 'employmentInformation.employeeNumber': -1 })
        .select('employmentInformation.employeeNumber')
        .lean();

      if (lastEmployee && lastEmployee.employmentInformation?.employeeNumber) {
        // Extract the numeric part from the last employee number (e.g., "EMP0123" -> 123)
        const lastNumber = parseInt(lastEmployee.employmentInformation.employeeNumber.replace('EMP', ''), 10);
        const nextNumber = lastNumber + 1;
        employeeNumber = `EMP${String(nextNumber).padStart(4, '0')}`;
      } else {
        // No employees exist yet, start with EMP0001
        employeeNumber = 'EMP0001';
      }

      // Double-check for uniqueness (in case of race conditions)
      const existingWithSameNumber = await employeeModel.findOne({
        'employmentInformation.employeeNumber': employeeNumber
      });

      if (existingWithSameNumber) {
        // If somehow the number already exists, use timestamp-based fallback
        const timestamp = Date.now().toString().slice(-4);
        employeeNumber = `EMP${timestamp}`;
        console.warn(`Race condition detected, using timestamp-based employee number: ${employeeNumber}`);
      }
    } catch (err) {
      console.error('Error generating employee number:', err);
      // Fallback to timestamp-based generation
      const timestamp = Date.now().toString().slice(-6);
      employeeNumber = `EMP${timestamp}`;
    }

    const capitalizeGender = (gender) => {
      if (!gender) return gender;
      return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
    };

    // Map candidate data to employee structure
    const employeeData = {
      personalInformation: {
        firstName: candidate.profileDetails?.firstName || candidate.candidateName?.split(' ')[0] || '',
        lastName: candidate.profileDetails?.lastName || candidate.candidateName?.split(' ').slice(1).join(' ') || '',
        gender:capitalizeGender(candidate.profileDetails?.gender || candidate.gender || ''),
        title: candidate.title || candidate.profileDetails?.title || '', // Required field
        PanNumber: candidate.panNumber || '', // Required field
        middleName: candidate.middleName || candidate.profileDetails?.middleName || '', // Optional field
        dateOfBirth: candidate.profileDetails?.dateOfBirth ? new Date(candidate.profileDetails.dateOfBirth) : (candidate.dob ? new Date(candidate.dob) : null),
        image: candidate.image || '',
        profilePicture: candidate.image || '',
      },
      contactInformation: {
        verified: true,
        email:  candidate.email || '',
        workEmail:  candidate.email || '',
        loginMethod: "Manual",
        mobileNumber: parseInt(candidate.profileDetails?.phoneNumber) || parseInt(candidate.phone) || 0,
        countryCode: 91, // Default to India, you can customize
        isSameWhatsapp: true,
        whatsappNumber: parseInt(candidate.profileDetails?.phoneNumber) || parseInt(candidate.phone) || 0,
        countryCode2: 91,
        homeAddress: candidate.profileDetails?.address || candidate.location || '',
        countryOfBirth: candidate.countryOfBirth || 'India', // Required field
        StateOfBirth: candidate.stateOfBirth || candidate.cityStateOfBirth || '', // Required field
        nationality: candidate.nationality || 'Indian', // Required field
        marriageDate: candidate.marriageDate || candidate.familyDetails?.marriageDate || '', // Required field
        maritalStatus: candidate.maritalStatus || candidate.familyDetails?.maritalStatus || '',
        Pf: candidate.pfNumber || '', // Required field
        FatherName: candidate.fatherName || '', // Required field
        BloodGroup: candidate.bloodGroup || '', // Required field
      },
      // Map spouse information from candidate personalDetails.spouseDetails
      SpouseInformation: {
        firstName: candidate.personalDetails?.spouseDetails?.firstName || '',
        lastName: candidate.personalDetails?.spouseDetails?.surName || '',
        Occupation: candidate.personalDetails?.spouseDetails?.occupation || '',
        dateOfBirth: candidate.personalDetails?.spouseDetails?.dateOfBirth || null,
      },
      // Map child information from candidate childInfoList (employee model expects array)
      ChildInformation: candidate.childInfoList && candidate.childInfoList.length > 0 
        ? candidate.childInfoList.map(child => ({
            firstName: child.firstName || '',
            lastName: child.lastName || '',
            gender: child.gender || '',
            dateOfBirth: child.dateOfBirth || null,
          }))
        : [],
      // Map present address from candidate personalDetails.presentAddress
      PresentAddress: {
        streetHouseNumber: candidate.personalDetails?.presentAddress?.streetHouseNumber || '',
        addressLine2: candidate.personalDetails?.presentAddress?.addressLine2 || '',
        city: candidate.personalDetails?.presentAddress?.city || '',
        postalCode: candidate.personalDetails?.presentAddress?.postalCode || '',
        country: candidate.personalDetails?.presentAddress?.country || '',
        regionState: candidate.personalDetails?.presentAddress?.regionState || '',
        district: candidate.personalDetails?.presentAddress?.district || '',
        primaryEmergencyContactNumber: parseInt(candidate.personalDetails?.presentAddress?.primaryEmergencyContact) || 0,
        secondaryEmergencyContactNumber: parseInt(candidate.personalDetails?.presentAddress?.secondaryEmergencyContact) || 0,
      },
      // Map permanent address from candidate personalDetails.permanentAddress
      PermanentAddress: {
        streetHouseNumber: candidate.personalDetails?.permanentAddress?.streetHouseNumber || '',
        addressLine2: candidate.personalDetails?.permanentAddress?.addressLine2 || '',
        city: candidate.personalDetails?.permanentAddress?.city || '',
        postalCode: candidate.personalDetails?.permanentAddress?.postalCode || '',
        country: candidate.personalDetails?.permanentAddress?.country || '',
        regionState: candidate.personalDetails?.permanentAddress?.regionState || '',
        district: candidate.personalDetails?.permanentAddress?.district || '',
        primaryEmergencyContactNumber: parseInt(candidate.personalDetails?.permanentAddress?.primaryEmergencyContact) || 0,
        secondaryEmergencyContactNumber: parseInt(candidate.personalDetails?.permanentAddress?.secondaryEmergencyContact) || 0,
      },
      employmentInformation: {
        hireDate: candidate.profileDetails?.joiningDate ? new Date(candidate.profileDetails.joiningDate) : (candidate.joiningDate ? new Date(candidate.joiningDate) : new Date()),
        employeeNumber: employeeNumber,
        status: "Active",
        inactiveDate: null, // Optional field
        legalEntity: candidate.profileDetails?.legalEntity || candidate.legalEntity || "",
        department: candidate.profileDetails?.department || candidate.department || '',
        designation: candidate.profileDetails?.designation || candidate.designation || '',
        grade: candidate.profileDetails?.grade || candidate.grade || "Grade1",
        location: candidate.location || '',
        lineManager: candidate.reportingManager?.id || '',
        jobCategory: candidate.profileDetails?.jobCategory || candidate.jobCategory || candidate.department || '',
        role: candidate.profileDetails?.role || "Employee",
        departmentHead: "No",
        maritalStatus: candidate.familyDetails?.maritalStatus || '',
        highestEducationLevel: candidate.educationQualification || '',
        religion: candidate.personalDetails?.religion || '', // Optional field
      },
      status: "Active",
      companyId: candidate.companyId || '',
      
      // Additional candidate-specific data
      candidateInformation: {
        originalCandidateId: candidate.candidateId,
        source: candidate.source,
        appliedOn: candidate.appliedOn,
        experience: candidate.experience,
        grossSalary: candidate.grossSalary,
        noticePeriod: candidate.noticePeriod,
        probationPeriod: candidate.probationPeriod,
        offerLetterDate: candidate.offerLetterDate,
        resume: candidate.resume,
        documents: candidate.documents || [],
        references: candidate.references || [],
        projectName: candidate.projectName,
        interviewer1: candidate.interviewer1,
        interviewer2: candidate.interviewer2,
        reportingManager: candidate.reportingManager,
        personalDetails: {
          aadharNumber: candidate.personalDetails?.aadharNumber,
          passportNumber: candidate.personalDetails?.passportNumber,
          driverLicenseNumber: candidate.personalDetails?.driverLicenseNumber,
          driverLicenseExpiry: candidate.personalDetails?.driverLicenseExpiry,
          driverLicensePeriod: candidate.personalDetails?.driverLicensePeriod,
        },
        bankDetails: {
          accountNumber: candidate.bankDetails?.accountNumber,
          ifscCode: candidate.bankDetails?.ifscCode,
          bankName: candidate.bankDetails?.bankName,
          branchName: candidate.bankDetails?.branchName,
          branchAddress: candidate.bankDetails?.branchAddress,
          city: candidate.bankDetails?.city,
          state: candidate.bankDetails?.state,
        },
        documentDetails: candidate.documentDetails || [],
        // Map insurance details to new structure
        insuranceDetails: candidate.insuranceDetails ? {
          coverageFor: candidate.insuranceDetails.coverageFor,
          spouseName: candidate.insuranceDetails.spouseName,
          spouseDob: candidate.insuranceDetails.spouseDob,
          child1Name: candidate.insuranceDetails.child1Name,
          child1Dob: candidate.insuranceDetails.child1Dob,
          child2Name: candidate.insuranceDetails.child2Name,
          child2Dob: candidate.insuranceDetails.child2Dob,
        } : undefined,
        moveToTalentPool: candidate.moveToTalentPool,
        nextSuitableRole: candidate.nextSuitableRole,
        feedbackId: candidate.feedbackId,
        educationQualification: candidate.educationQualification,
        dateOfJoining: candidate.dateOfJoining,
        showOfferLetter: candidate.showOfferLetter || false,
      }
    };

    // Create new employee record
    const newEmployee = new employeeModel(employeeData);
    await newEmployee.save();

    console.log(`Candidate ${candidate.candidateId} successfully converted to Employee ${employeeNumber}`);
    
    return newEmployee;
  } catch (error) {
    console.error("Error converting candidate to employee:", error);
    throw new Error(error);
  }
};


const uploadFiles = async (req, res) => {
  try {
    const file = req.file;
    const candidateId = req.body._id; // Make sure the field name for candidateId is '_id'

    // Check if file and candidateId are available
    if (!candidateId || !file) {
      return res
        .status(400)
        .json({ error: "Candidate ID and file are required" });
    }

    // Find the candidate in the database
    const candidate = await CandidateModel.findById(candidateId);
    if (!candidate) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    // Temporary file path
    const filePath = path.join(file.destination, file.filename);
    // console.log("file path before upload", filePath);

    // Assuming `uploadFileToDrive` is your cloud upload function (S3 or similar)
    const uploadResponse = await uploadFileToDrive(filePath);

    // Delete the temporary file after upload
    fs.unlinkSync(filePath);

    // Get the image URL from the upload response
    const imageUrl = uploadResponse?.url;

    // Update the candidate document with the image URL
    await CandidateModel.updateOne(
      { _id: candidateId },
      { $set: { image: imageUrl } }
    );

    // Send successful response with the image URL
    res.status(201).json({ image: imageUrl });
  } catch (error) {
    console.error("Error uploading candidate image:", error);
    res.status(400).json({ error: error.message });
  }
};

// Proxy endpoint to download files from S3 (bypasses CORS)
const proxyFileDownload = async (req, res) => {
  try {
    const { fileUrl } = req.query;
    
    if (!fileUrl) {
      return res.status(400).json({ error: "fileUrl parameter is required" });
    }

    console.log("Proxying download for:", fileUrl);

    // Use axios to fetch the file
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': '*/*'
      }
    });

    // Extract filename from URL
    const urlParts = fileUrl.split('/');
    const filename = decodeURIComponent(urlParts[urlParts.length - 1]);

    // Set proper headers for file download
    res.set({
      'Content-Type': response.headers['content-type'] || 'application/octet-stream',
      'Content-Length': response.headers['content-length'],
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    });

    // Send the file data
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error("Error proxying file download:", error.message);
    res.status(500).json({ 
      error: "Failed to download file", 
      message: error.message 
    });
  }
};

module.exports = {
  uploadFiles,
  createCandidate,
  getAllCandidates,
  UpdateCandiate,
  getCandidateById,
  deleteCandidateById,
  getSummary,
  getCandidatesAll,
  proxyFileDownload
};

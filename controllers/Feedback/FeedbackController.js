const mongoose = require("mongoose");
const { uploadFileToDrive, signS3UrlIfNeeded, signS3UrlsInValue } = require("../../middlewares/recruitment/drive");
const { sendEmail } = require("../../middlewares/recruitment/sendMail");
const CandidateModel = require("../../models/recruitment/Candidate/CandidateModel");
const {
  FeedbackModel,
} = require("../../models/recruitment/feedback/FeedbackModel");
const {
  successResponse,
  errorResponse,
  normalizeString,
} = require("../../utils/recruitment/responseHandler");

const submitFeedback = async (req, res) => {
  try {
    const { candidateId, ratings, ratings1, comments, competencyIds, round, feedbackId } = req.body;
    
    // Upload file to S3 if provided
    let uploadedFileUrl = null;
    if (req.file) {
      try {
        const uploaded = await uploadFileToDrive(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          "feedbackfiles"
        );
        uploadedFileUrl = uploaded.url;
        console.log("File uploaded to S3:", uploadedFileUrl);
      } catch (uploadError) {
        console.error("Error uploading file to S3:", uploadError);
        return errorResponse(res, "Failed to upload document to S3: " + uploadError.message, 500);
      }
    }
    
    console.log("req.file at feedback:", req.file);
    console.log("req.body at feedback:", req.body)

    // Validate required fields
    if (!candidateId || !round) {
      return errorResponse(res, "Candidate Id or Round is missing!", 400);
    }

    if (!ratings || !ratings1 || !comments) {
      return errorResponse(res, "Required feedback fields are missing", 400);
    }

    // Find candidate
    const candidate = await CandidateModel.findOne({ candidateId });
    if (!candidate) {
      return errorResponse(res, "Candidate not found", 404);
    }

    // Parse JSON data
    const parsedRatings = JSON.parse(ratings);
    const parsedRatings1 = JSON.parse(ratings1);
    const parsedComments = JSON.parse(comments);
    const parsedCompetencyIds = competencyIds ? JSON.parse(competencyIds) : [];

    // Determine which interviewer to update
    let updateField;
    if (normalizeString(round) === normalizeString("interview 1")) {
      updateField = "interviewer1";
    } else if (normalizeString(round) === normalizeString("interview 2")) {
      updateField = "interviewer2";
    } else {
      return errorResponse(res, "Invalid round specified", 400);
    }

    let savedFeedback;
    
    // Check if feedbackId exists and is a valid ObjectId (not 'null' string)
    const isValidFeedbackId = feedbackId && feedbackId !== 'null' && mongoose.isValidObjectId(feedbackId);
    
    if (isValidFeedbackId) {
      // UPDATE existing feedback for this specific round
      const updateData = {
        ratings: parsedRatings,
        ratings1: parsedRatings1,
        comments: parsedComments,
        competencyIds: parsedCompetencyIds,
        updatedAt: new Date()
      };
      
      // Only update uploadedDocument if a new file was uploaded
      if (uploadedFileUrl) {
        updateData.uploadedDocument = uploadedFileUrl;
      }
      
      savedFeedback = await FeedbackModel.findOneAndUpdate(
        { _id: feedbackId, candidateId, round },
        updateData,
        { new: true, runValidators: true }
      );

      if (!savedFeedback) {
        return errorResponse(res, "Existing feedback not found for this round", 404);
      }
    } else {
      // Check if feedback already exists for this candidate and round
      const existingFeedback = await FeedbackModel.findOne({ candidateId, round });
      
      if (existingFeedback) {
        // Update existing feedback for this round
        const updateData = {
          ratings: parsedRatings,
          ratings1: parsedRatings1,
          comments: parsedComments,
          competencyIds: parsedCompetencyIds,
          updatedAt: new Date()
        };
        
        // Use new file URL if uploaded, otherwise keep existing
        if (uploadedFileUrl) {
          updateData.uploadedDocument = uploadedFileUrl;
        }
        
        savedFeedback = await FeedbackModel.findOneAndUpdate(
          { candidateId, round },
          updateData,
          { new: true, runValidators: true }
        );
      } else {
        // Create new feedback for this round
        const feedbackData = {
          candidateId,
          round,
          ratings: parsedRatings,
          ratings1: parsedRatings1,
          comments: parsedComments,
          competencyIds: parsedCompetencyIds,
          uploadedDocument: uploadedFileUrl || "",
          createdAt: new Date(),
        };

        savedFeedback = await FeedbackModel.create(feedbackData);
      }
    }

    // Only update the round-specific feedbackId, NOT the top-level feedbackId
    const updatedCandidate = await CandidateModel.findOneAndUpdate(
      { candidateId },
      { 
        $set: { 
          [`${updateField}.feedbackId`]: savedFeedback._id.toString(), // Round-specific feedbackId
          [`${updateField}.updatedAt`]: new Date()
        } 
      },
      { new: true }
    );

    if (!updatedCandidate) {
      if (!isValidFeedbackId) {
        await FeedbackModel.findByIdAndDelete(savedFeedback._id);
      }
      return errorResponse(res, "Failed to update candidate record", 500);
    }

    return successResponse(
      res,
      { feedback: savedFeedback, candidate: updatedCandidate },
      isValidFeedbackId ? "Feedback updated successfully" : "Feedback submitted successfully"
    );
  } catch (err) {
    console.error("Error in submitFeedback:", err);
    return errorResponse(res, err.message || "Internal server error", 500);
  }
};

const getFeedback = async (req, res) => {
  try {
    const { candidateId, feedbackId, round } = req.query; 

    if (!candidateId && !feedbackId) {
      return errorResponse(res, "Candidate Id or Feedback Id is required", 400);
    }

    let feedback;
    if (feedbackId) {
      // Fetch by feedbackId (most specific)
      feedback = await FeedbackModel.findOne({ _id: feedbackId });
    } else if (candidateId && round) {
      // Fetch by candidateId and round (round-specific)
      feedback = await FeedbackModel.findOne({ candidateId, round });
    } else if (candidateId) {
      // Fetch by candidateId only (fallback - will get one feedback)
      feedback = await FeedbackModel.findOne({ candidateId });
    }
    
    console.log("feedback ", feedback);

    if (!feedback) {
      return errorResponse(res, "Feedback not found for this candidate and round", 404);
    }

    const transformedFeedback = {
      _id: feedback._id,
      uploadedDocument: await signS3UrlIfNeeded(feedback.uploadedDocument),
      candidateId: feedback.candidateId,
      round: feedback.round,
      ratings: feedback.ratings,
      ratings1: feedback.ratings1,
      comments: feedback.comments,
      competencyIds: feedback.competencyIds || [],
      createdAt: feedback.createdAt,
      __v: feedback.__v,
    };

    return successResponse(
      res,
      transformedFeedback,
      "Feedback fetched successfully"
    );
  } catch (err) {
    console.error("Error in getFeedback:", err);
    return errorResponse(res, err.message || "Something went wrong", 500);
  }
};
const documentUpload = async (req, res) => {
  try {
    const { candidateId, references: referencesString, hr } = req.body;
    
    console.log("at documetn uppload controller",req.body)
    
    const existingCandidate = await CandidateModel.findOne({ candidateId });
    if (!existingCandidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Initialize updateData with existing candidate data
    const updateData = existingCandidate.toObject();
    
    // Parse references if they exist
    if (referencesString) {
      try {
        updateData.references = JSON.parse(referencesString);
      } catch (parseError) {
        console.error('Error parsing references:', parseError);
        return res.status(400).json({ message: 'Invalid references format' });
      }
    }

    const requestData = { ...req.body };

    // Process files (unchanged)
    if (req.files && req.files.length > 0) {
      const documentTypes = Array.isArray(requestData.documentTypes) 
        ? requestData.documentTypes 
        : (requestData.documentTypes ? [requestData.documentTypes] : []);

      if (!updateData.documents) {
        updateData.documents = [];
      }

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
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
          const docType = documentTypes[i] || 'OTHER';
          updateData.documents.push({
            type: docType,
            url: uploaded.url,
            fileName: file.originalname,
            fileSize: file.size.toString()
          });
        }
      }
      delete requestData.documentTypes;
    }

    // Merge other fields
    for (const key in requestData) {
      if (key !== 'references' && // Skip references as we already processed it
          requestData[key] !== undefined && 
          requestData[key] !== null && 
          requestData[key] !== '') {
        updateData[key] = requestData[key];
      }
    }

    // Update with proper casting
    const updatedCandidate = await CandidateModel.findOneAndUpdate(
      { candidateId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    const candidate = await CandidateModel.findOne({ candidateId });
    console.log(candidate,'fdsfjdsnfmjs')
    console.log("candaite at documetn fetchied using id",candidate)
if (!candidate) {
  return errorResponse(res, "Candidate not found", 404);
}
    
    // Send email to HR when documents are uploaded
    // Get HR email from request body or query params (fallback)
    const hrEmail = hr || req.query.hr;
    const hasDocumentsUploaded = req.files && req.files.length > 0 && 
                                 req.files.some(file => file.fieldname !== "photo" && file.fieldname !== "resume");
    
    // Only send email if documents were actually uploaded and HR email is available
    if (hasDocumentsUploaded && hrEmail) {
      // Validate candidate data before sending email
      if (!candidate.candidateName || !candidate.email) {
        console.error("Candidate data incomplete for email notification:", {
          candidateName: candidate.candidateName,
          email: candidate.email,
          candidateId: candidate.candidateId
        });
        // Don't fail the request, just log the error
      } else {
        try {
          await sendEmail(
            hrEmail,
            "Candidate Documents Uploaded",
            {
              name: candidate.candidateName,
              email: candidate.email,
              id: candidate.candidateId || candidateId,
              message: "Candidate has uploaded the documents successfully.",
              documentUploadTemplateHR: true,
            },
            true
          );
        } catch (emailError) {
          console.error("Error sending document upload email to HR:", emailError);
          // Don't fail the entire request if email fails
        }
      }
    } else if (hasDocumentsUploaded && !hrEmail) {
      console.warn(`Documents uploaded for candidate ${candidateId} but HR email not provided. Email notification skipped.`);
    }

    return res.status(200).json({
      message: 'Data updated successfully',
      data: await signS3UrlsInValue(updatedCandidate)
    });
  } catch (error) {
    console.error('Error in documentUpload:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      receivedReferences: req.body.references // For debugging
    });
  }
};
const deleteDocument = async (req, res) => {
  try {
    const { candidateId, fileName } = req.body;
    
    // Validate input
    if (!candidateId || !fileName) {
      return res.status(400).json({ 
        message: 'Candidate ID and file name are required' 
      });
    }

    // Find the candidate
    const existingCandidate = await CandidateModel.findOne({ candidateId });
    if (!existingCandidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    // Check if the document exists
    const documentExists = existingCandidate.documents.some(
      doc => doc.fileName === fileName
    );
    
    if (!documentExists) {
      return res.status(404).json({ 
        message: 'Document with this file name not found for the candidate' 
      });
    }

    // Remove the document from the array
    const updatedCandidate = await CandidateModel.findOneAndUpdate(
      { candidateId },
      { $pull: { documents: { fileName: fileName } } },
      { new: true }
    );

    return res.status(200).json({
      message: 'Document deleted successfully',
      data: updatedCandidate
    });
  } catch (error) {
    console.error('Error in deleteDocument:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message
    });
  }
};
module.exports = {
  submitFeedback,
  getFeedback,
  documentUpload,
  deleteDocument
};

const OKRUploadModel = require("../models/okrUpload.model");
const ObjectivesModel = require("../models/objectives.model");
const KeyResultsModel = require("../models/keyResults.model");
const TasksModel = require("../models/tasks2.model");
const { uploadFileToDrive } = require("../middlewares/recruitment/drive");

const successResponse = ({ message, data }) => ({
  success: true,
  data: data ? data : null,
  message,
});

const failResponse = ({ message, data }) => ({
  success: false,
  data: data ? data : null,
  message,
});

/**
 * Upload file to S3
 * POST /api/okrManagement/uploads/file
 */
const uploadFileToS3 = async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).send(
        failResponse({
          message: "No file uploaded"
        })
      );
    }

    const companyId = req.body.companyId || req.query.companyId;
    
    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "Company ID is required"
        })
      );
    }

    // Upload to S3 using existing drive middleware
    const uploaded = await uploadFileToDrive(
      file.buffer, 
      file.originalname, 
      file.mimetype, 
      "okr-uploads"
    );

    res.status(200).send(
      successResponse({
        message: "File uploaded successfully",
        data: {
          s3Url: uploaded.url,
          s3Key: uploaded.key || uploaded.Key,
          filename: file.originalname,
          fileSize: file.size,
          uploadedAt: new Date()
        }
      })
    );
  } catch (err) {
    console.error("Error uploading file to S3:", err);
    res.status(500).send(
      failResponse({
        message: err.message || "Failed to upload file"
      })
    );
  }
};

/**
 * Get list of recent uploads
 * GET /api/okrManagement/uploads
 */
const getUploads = async (req, res) => {
  try {
    const { companyId, limit = 25 } = req.query;

    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "Company ID is required"
        })
      );
    }

    const uploads = await OKRUploadModel.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).send(
      successResponse({
        message: "Uploads retrieved successfully",
        data: uploads
      })
    );
  } catch (err) {
    console.error("Error fetching uploads:", err);
    res.status(500).send(
      failResponse({
        message: err.message || "Failed to fetch uploads"
      })
    );
  }
};

/**
 * Get records from a specific upload
 * GET /api/okrManagement/uploads/:batchId/records
 */
const getUploadRecords = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId, page = 1, limit = 10 } = req.query;

    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "Company ID is required"
        })
      );
    }

    // Find the upload record
    const upload = await OKRUploadModel.findOne({ 
      uploadBatchId: batchId,
      companyId 
    });

    if (!upload) {
      return res.status(404).send(
        failResponse({
          message: "Upload not found"
        })
      );
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Get objectives, key results, and tasks from this upload
    const [objectives, keyResults, tasks] = await Promise.all([
      ObjectivesModel.find({ uploadBatchId: batchId, companyId })
        .select('objectiveID objective name type employeeNumber status createdAt')
        .skip(skip)
        .limit(limitNum),
      KeyResultsModel.find({ uploadBatchId: batchId, companyId })
        .select('krID keyResultName name type employeeNumber status createdAt')
        .skip(skip)
        .limit(limitNum),
      TasksModel.find({ uploadBatchId: batchId, companyId })
        .select('title name type employeeNumber status createdAt')
        .skip(skip)
        .limit(limitNum)
    ]);

    // Combine and format records
    const records = [
      ...objectives.map(obj => ({
        _id: obj._id,
        type: 'obj',
        title: obj.objective || obj.name,
        employeeNumber: obj.employeeNumber,
        status: obj.status,
        createdAt: obj.createdAt
      })),
      ...keyResults.map(kr => ({
        _id: kr._id,
        type: 'kr',
        title: kr.keyResultName || kr.name,
        employeeNumber: kr.employeeNumber,
        status: kr.status,
        createdAt: kr.createdAt
      })),
      ...tasks.map(task => ({
        _id: task._id,
        type: 'task',
        title: task.title || task.name,
        employeeNumber: task.employeeNumber,
        status: task.status,
        createdAt: task.createdAt
      }))
    ];

    // Sort by createdAt
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Get total count
    const [objCount, krCount, taskCount] = await Promise.all([
      ObjectivesModel.countDocuments({ uploadBatchId: batchId, companyId }),
      KeyResultsModel.countDocuments({ uploadBatchId: batchId, companyId }),
      TasksModel.countDocuments({ uploadBatchId: batchId, companyId })
    ]);

    const total = objCount + krCount + taskCount;

    res.status(200).send(
      successResponse({
        message: "Upload records retrieved successfully",
        data: records,
        total: total,
        page: parseInt(page),
        limit: limitNum
      })
    );
  } catch (err) {
    console.error("Error fetching upload records:", err);
    res.status(500).send(
      failResponse({
        message: err.message || "Failed to fetch upload records"
      })
    );
  }
};

/**
 * Rollback an upload (delete all data from that upload)
 * DELETE /api/okrManagement/uploads/:batchId/rollback
 */
const rollbackUpload = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "Company ID is required"
        })
      );
    }

    // Find the upload record
    const upload = await OKRUploadModel.findOne({ 
      uploadBatchId: batchId,
      companyId 
    });

    if (!upload) {
      return res.status(404).send(
        failResponse({
          message: "Upload not found"
        })
      );
    }

    if (upload.status === 'rolled_back') {
      return res.status(400).send(
        failResponse({
          message: "Upload has already been rolled back"
        })
      );
    }

    // Delete all tasks first (due to dependencies)
    const deletedTasks = await TasksModel.deleteMany({ 
      uploadBatchId: batchId, 
      companyId 
    });

    // Delete all key results
    const deletedKeyResults = await KeyResultsModel.deleteMany({ 
      uploadBatchId: batchId, 
      companyId 
    });

    // Delete all objectives
    const deletedObjectives = await ObjectivesModel.deleteMany({ 
      uploadBatchId: batchId, 
      companyId 
    });

    // Update upload record
    upload.status = 'rolled_back';
    upload.rolledBackAt = new Date();
    upload.rolledBackBy = req.user?.id || req.user?._id || 'system';
    await upload.save();

    res.status(200).send(
      successResponse({
        message: "Rollback completed successfully",
        data: {
          deletedObjectives: deletedObjectives.deletedCount,
          deletedKeyResults: deletedKeyResults.deletedCount,
          deletedTasks: deletedTasks.deletedCount
        }
      })
    );
  } catch (err) {
    console.error("Error during rollback:", err);
    res.status(500).send(
      failResponse({
        message: err.message || "Failed to rollback upload"
      })
    );
  }
};

/**
 * Delete an upload record
 * DELETE /api/okrManagement/uploads/:batchId
 */
const deleteUpload = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).send(
        failResponse({
          message: "Company ID is required"
        })
      );
    }

    // Find the upload record
    const upload = await OKRUploadModel.findOne({ 
      uploadBatchId: batchId,
      companyId 
    });

    if (!upload) {
      return res.status(404).send(
        failResponse({
          message: "Upload not found"
        })
      );
    }

    // Only allow deletion of rolled back or failed uploads
    if (upload.status !== 'rolled_back' && upload.status !== 'failed') {
      return res.status(400).send(
        failResponse({
          message: "Can only delete rolled back or failed uploads"
        })
      );
    }

    // Delete the upload record
    await OKRUploadModel.deleteOne({ uploadBatchId: batchId, companyId });

    res.status(200).send(
      successResponse({
        message: "Upload deleted successfully"
      })
    );
  } catch (err) {
    console.error("Error deleting upload:", err);
    res.status(500).send(
      failResponse({
        message: err.message || "Failed to delete upload"
      })
    );
  }
};

module.exports = {
  uploadFileToS3,
  getUploads,
  getUploadRecords,
  rollbackUpload,
  deleteUpload
};

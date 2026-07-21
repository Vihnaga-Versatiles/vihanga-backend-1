const issueRiseModel = require('../models/issueRise.model');
const CompanyModel = require('../models/company.model');
const { uploadFileToDrive } = require('../middlewares/recruitment/drive');

const successResponse = ({ message, data }) => ({ success: true, data: data ? data : null, message });
const failResponse = ({ message, data }) => ({ success: false, data: data ? data : null, message });

const createIssue = async (req, res) => {
    try {
        // Resolve company name defensively
        let companyName = req.body.companyName || null;
        const companyId = req.body.companyId;
        if (companyId) {
            try {
                const company = await CompanyModel.findById(companyId);
                if (company && company.companyEntityName) {
                    companyName = company.companyEntityName;
                }
            } catch (e) {
                // ignore lookup errors; fall back to provided companyName or null
            }
        }
        // Normalize feed from string/array/array of strings
        let normalizedFeed = [];
        if (req.body.feed) {
            try {
                if (typeof req.body.feed === 'string') {
                    const parsed = JSON.parse(req.body.feed);
                    normalizedFeed = Array.isArray(parsed) ? parsed : [];
                } else if (Array.isArray(req.body.feed)) {
                    normalizedFeed = req.body.feed.map((f) => {
                        try { return typeof f === 'string' ? JSON.parse(f) : f; } catch { return f; }
                    });
                }
            } catch {
                normalizedFeed = [];
            }
        }
        let requestBody = {
            SRnumber: req.body.SRnumber,
            problemArea: req.body.problemArea,
            raisedBy: req.body.raisedBy,
            priority: req.body.priority,
            status: req.body.status,
            description: req.body.description,
            userId: req.body.userId,
            attachments: req.body.attachments,
            companyId: companyId || null,
            companyName: companyName,
            feed: normalizedFeed
        }
        const newIssue = new issueRiseModel(requestBody);
        await newIssue.save();
        res.status(200).send(
            successResponse({
                message: 'Issue Raised Successfully!',
            })
        );
    } catch (err) {
        res.status(500).send(
            failResponse({
                message: err ? err.message : "Issue Not Raised"
            })
        );
    }
};

const updateIssue = async (req, res) => {
    // #swagger.tags = ['Grade']
    try {
        const grade = await issueRiseModel.findById(req.params.id);
        if (grade) {
            // Normalize feed from string/array/array of strings
            let normalizedFeed = [];
            if (req.body.feed) {
                try {
                    if (typeof req.body.feed === 'string') {
                        const parsed = JSON.parse(req.body.feed);
                        normalizedFeed = Array.isArray(parsed) ? parsed : [];
                    } else if (Array.isArray(req.body.feed)) {
                        normalizedFeed = req.body.feed.map((f) => {
                            try { return typeof f === 'string' ? JSON.parse(f) : f; } catch { return f; }
                        });
                    }
                } catch {
                    normalizedFeed = [];
                }
            }
            let data = {
                SRnumber: req.body.SRnumber,
                problemArea: req.body.problemArea,
                raisedBy: req.body.raisedBy,
                priority: req.body.priority,
                status: req.body.status,
                description: req.body.description,
                userId: req.body.userId,
                attachments: req.body.attachments,
                companyId: req.body.companyId,
                companyName:req.body.companyName,
                feed: normalizedFeed
            }
            issueRiseModel.findByIdAndUpdate(req.params.id, data, (err) => {
                if (!err) {
                    res.status(200).send(
                        successResponse({
                            message: 'Issue Updated Successfully!',
                        })
                    );
                } else {
                    res.status(500).send(
                        failResponse({
                            message: err ? err.message : "Issue Not Updated!"
                        })
                    );
                }
            });
        }
    } catch (err) {
        res.status(500).send(
            failResponse({
                message: err ? err.message : "Issue Not Updated!"
            })
        );
    }
};

const getIssues = async (req, res) => {
    // #swagger.tags = ['Grade']
    try {
        const grades = await issueRiseModel.find({ }).sort({ _id: -1 });
        res.status(200).send(
            successResponse({
                message: 'Issues Retrieved Successfully!',
                data: grades
            })
        )
    } catch (err) {
        res.status(500).send(
            failResponse({
                message: err ? err.message : "Issues Not Fetched!"
            })
        );
    }
};

const getIssueByEmpId = async (req, res) => {
    // #swagger.tags = ['Grade']
    try {
        const grade = await issueRiseModel.find({userId:req.params.EmpId});
        res.status(200).send(
            successResponse({
                message: 'Issue Retrieved Successfully!',
                data: grade
            })
        )
    } catch (err) {
        res.status(500).send(
            failResponse({
                message: err ? err.message : "Issue Not Fetched!"
            })
        );
    }
};


const getIssueById = async (req, res) => {
    // #swagger.tags = ['Grade']
    try {
        const grade = await issueRiseModel.findById(req.params.id);
        res.status(200).send(
            successResponse({
                message: 'Issue Retrieved Successfully!',
                data: grade
            })
        )
    } catch (err) {
        res.status(500).send(
            failResponse({
                message: err ? err.message : "Issue Not Fetched!"
            })
        );
    }
};

// Get all issues for a given company
const getIssuesByCompanyId = async (req, res) => {
    try {
        const { companyId } = req.params;
        const issues = await issueRiseModel.find({ companyId }).sort({ _id: -1 });
        res.status(200).send(
            successResponse({
                message: 'Company Issues Retrieved Successfully!',
                data: issues
            })
        );
    } catch (err) {
        res.status(500).send(
            failResponse({
                message: err ? err.message : "Company Issues Not Fetched!"
            })
        );
    }
};

// Upload single attachment to S3 and return URL
const uploadIssueAttachment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send(
                failResponse({
                    message: "No file provided"
                })
            );
        }
        const uploaded = await uploadFileToDrive(req.file.buffer, req.file.originalname, req.file.mimetype);
        return res.status(200).send(
            successResponse({
                message: "File uploaded successfully",
                data: { url: uploaded.url }
            })
        );
    } catch (err) {
        return res.status(500).send(
            failResponse({
                message: err ? err.message : "Error uploading file"
            })
        );
    }
};

module.exports = {
    createIssue,
    updateIssue,
    getIssues,
    getIssueByEmpId,
    getIssueById,
    getIssuesByCompanyId,
    uploadIssueAttachment
};

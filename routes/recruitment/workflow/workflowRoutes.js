const express = require("express");
const { createWorkflow, getAllWorkflows, updateWorkflow, getWorkflowById, deleteWorkflow } = require("../../../controllers/workflow/WorkflowController");


const router = express.Router();


router.post("/workflow", createWorkflow);
router.get("/workflow", getAllWorkflows);
router.put("/workflow", updateWorkflow);
router.get("/workflow/id", getWorkflowById);
router.delete("/workflow", deleteWorkflow); 


router.get("/workflow/test", (req, res) => {
  res.send("Hello, API is working!");
});

module.exports = router;

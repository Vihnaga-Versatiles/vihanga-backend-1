const express = require('express')
const router = express.Router()
const { createExitInterview,
    getAllExitInterViews,
    getExitInterViewById,
    updateExitInterView,
    deleteExitInterView } = require('../../../controllers/ExitInterviewController/exitInterviewController')


// get ,post , put , delete


router.post('/ExitInterView', createExitInterview)
router.get('/allExitInterView', getAllExitInterViews)
router.get('/getExitInterViewById/', getExitInterViewById)
router.put('/updateExitInterView', updateExitInterView)
router.delete('/deleteExitInterView', deleteExitInterView)
module.exports = router
const express = require("express");
const { createComment, getAllComments, getAllCommentsByReferenceId, deleteComment, updateComment } = require("../controllers/taskschat.controller");
const router = express.Router();

//const { isAuth } = require("../config/auth");
const prefix = "/tasksComment"
router.post(`${prefix}/createComment`, createComment);
router.get(`${prefix}/getAllCommentsByReferenceId/:id`, getAllCommentsByReferenceId);
router.get(`${prefix}/getAllComments`, getAllComments);
router.delete(`${prefix}/deleteComment/:id`, deleteComment);

router.put(`${prefix}/updateComment/:id`, updateComment);

// router.post(`${prefix}/createOrUpdateMultipleObjectivess`, createOrUpdateMultipleemploys);

// router.post(`${prefix}/deleteObjectivess`, deleteObjectivess);
// router.get(`${prefix}/getObjectivesById/:id`, getEmployeById);

module.exports = router;
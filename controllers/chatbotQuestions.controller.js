const ChatbotQuestionsModel = require('../models/chatbotQuestions.model')
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

const getChatbotQuestions = async (req, res) => {
  // #swagger.tags = ['Open Ended Questions']
  try {
    const data = await ChatbotQuestionsModel.find({});
    res.status(200).send(
      successResponse({
        message: "Data Fetched!",
        data: data
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Fetched!"
      })
    );
  }
};

const deleteQuestion = (req, res) => {
  // #swagger.tags = ['Open Ended Questions']
  ChatbotQuestionsModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Question Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Question Not Deleted!",
        })
      );
    }
  });
};

const createOrUpdateOrDeleteMultipleQuestions = async (req, res) => {
  // #swagger.tags = ['Open Ended Questions']
  try {
    const items = req.body.data;
    var ops = [];
    items.forEach(item => {
      if (item.Operation.toString().toUpperCase() === "UPD" && item._id) {
        ops.push(
          {
            updateOne: {
              filter: { _id: item._id },
              update: {
                $set: item,
              },
              upsert: true
            }
          }
        );
      }
      else if (item.Operation.toString().toUpperCase() === "DEL" && item._id) {
        ops.push(
          {
            deleteOne: {
              filter: { _id: item._id }
            }
          }
        )
      } else if (item.Operation.toString().toUpperCase() === "ADD" && !item._id) {
        ops.push(
          {
            insertOne: {
              document: item
            }
          }
        )
      }
    })
    await ChatbotQuestionsModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: 'Questions Updated Successfully!',
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Questions Not Updated!"
      })
    );
  }
};

const getCompetencies = async (req, res) => {
  // #swagger.tags = ['Open Ended Questions']
  try {
    const data = await ChatbotQuestionsModel.find({});
    let competencies = [];
    competencies = data.map(item => {
      return item.CompetencyName;
    })
    competencies = [...new Set(competencies)];
    res.status(200).send(
      successResponse({
        message: "Data Fetched!",
        data: competencies
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Fetched!"
      })
    );
  }
};
module.exports = {
  getChatbotQuestions,
  createOrUpdateOrDeleteMultipleQuestions,
  deleteQuestion,
  getCompetencies
};

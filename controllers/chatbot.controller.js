//open ended questions
const ChatbotModel = require('../models/chatbot.model')
//const { data } = require('../chatbot_data2')
const OpenEndedQuestionsModel = require("../models/chatbotQuestions.model");
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

const createChatbot = async (req, res) => {
  // #swagger.tags = ['Open Ended Questions']
  const data = await OpenEndedQuestionsModel.find({});
  let general = {};
  let final = false
  let numberOfQuestions = 0;
  if (req.params.numberOfQuestions === 'undefined') {
    let filterData = data.filter((item) => item['CompetencyName'] === req.params.answer)
    numberOfQuestions = filterData.length
    final = filterData.length == 1 ? true : false
    general = filterData[0]
  } else {
    let filterData = data.filter((item) => item['CompetencyName'] === req.body.category)
    if (req.body.linkIndex !== 0) {
      general = filterData.filter((item) => req.body.linkIndex === item['EIndex'])[0]
    }
    if (req.body.numberOfQuestions == 0) {
      final = filterData.length == 1 ? true : false
    }
  }
  try {
    if (req.params.answer !== "undefined") {
      try {
        let data = {
          category: req.body.category,
          question: req.body.question,
          answer: req.params.answer,
          responsetime: req.body.responsetime,
          userId: req.params.userId,
          polarity: req.body.polarity
        };
        const newChat = new ChatbotModel(data);
        await newChat.save();
      } catch (err) {
        console.log(err)
      }
    }
    res.status(200).send(
      successResponse({
        final: final,
        data: {
          question: general['Question'],
          numberOfQuestions: req.params.numberOfQuestions === 'undefined' ? numberOfQuestions : req.params.numberOfQuestions - 1,
          category: general['CompetencyName'],
          linkIndex: general["LinkIndex"],
          index: general['EIndex'],
          polarity: req.body.polarity,
          final: final
        }
      })
    )
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Data Not Fetched!"
      })
    );
  }
};

const getChatbotData = async (req, res) => {
  // #swagger.tags = ['Open Ended Questions']
  try {
    const data = await ChatbotModel.find({});
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
module.exports = {
  createChatbot,
  getChatbotData
};

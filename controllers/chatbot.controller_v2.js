//close ended questions
const ChatbotModel = require('../models/chatbot.model_v2')
const EmployModel = require("../models/employee.model");
const CloseEndedQuestionsModel = require("../models/chatbotQuestions_v2.model");
const ChatbotReviewsModel = require("../models/chatbotReviews_v2.model");
const { removeDuplicates } = require('../helpers/percentageCalculation');
// const ChatBotRecords = require('../models/chatborRecords.model');
//const { data_v2 } = require('../data_v2')
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
  // #swagger.tags = ['Close Ended Questions']
  //self logic
  // - Self get a random question either it's from general or leadership, and then following question based on the ranking.

  //2.Manager or peers.
  // - should get whatever self got in the same order.
  // - if role is manager or peer, then self review should be done.
  // - get role, and self id.
  const role = req.params.reviewRole;
  const toEmployeeId = req.params.toEmployeeId;//toEmployee id.
  const templateId = req.params.templateId;//toEmployee id.
  if (role !== "Self") {
    //manager or peers
    const SelfReview = await ChatbotReviewsModel.findOne({ reviewedId: toEmployeeId, reviewedRole: "Self" });
    if (SelfReview) {
      EmployModel.findOne({ _id: req.params.userId }, async (err, result) => {
        const reviewedQuestions = await ChatbotModel.find({ userId: toEmployeeId, templateId })
        const QuestionsBanks = reviewedQuestions.map(item => item._doc);
        try {
          let final = false;
          let general = QuestionsBanks[0];
          if (req.params.answer === "undefined") {
            res.status(200).send(
              successResponse({
                message: final ? "Thank you" : 'sent',
                data: final ? null : {
                  question: general['question'],
                  options: ['Never', "Few of the times", 'Most of the times', 'Always'],
                  ranking: general['Ranking'],
                  subcategory: general["subcategory"],
                  category: general['category'],
                  defination: general["defination"],
                  tag: general["tag"]
                  // polarity: req.body.polarity
                }
              })
            )
          }
          else {
            try {
              let data = {
                category: req.body.category,
                subcategory: req.body.subcategory,
                question: req.body.question,
                answer: req.body.answer,
                responsetime: req.body.responsetime,
                Ranking: req.body.ranking,
                userId: req.params.userId,
                defination: req.body.defination,
                tag: req.body.tag,
                score: req.body.score,
                templateId: req.body.templateId,
                // polarity: req.body.polarity
              };
              const newChat = new ChatbotModel(data);
              await newChat.save();
              const userData = await ChatbotModel.find({ userId: req.params.userId, templateId: req.body.templateId });
              let finalQuestions = QuestionsBanks;
              const nextQuestion = finalQuestions.filter((item) => !userData.map(itemm => itemm.question).includes(item.question));
              let finalQuestion = nextQuestion.length == 0 ? [] : nextQuestion[0]
              res.status(200).send(
                successResponse({
                  message: finalQuestion.length === 0 ? "Thank you" : 'sent',
                  data: nextQuestion.length === 0 ? null : {
                    question: finalQuestion['question'],
                    options: ['Never', "Few of the times", 'Most of the times', 'Always'],
                    ranking: finalQuestion['Ranking'],
                    // numberOfQuestions: req.params.numberOfQuestions - 1,
                    subcategory: finalQuestion["subcategory"],
                    category: finalQuestion['category'],
                    defination: finalQuestion['defination'],
                    tag: finalQuestion["tag"]
                    // polarity: req.body.polarity
                  }
                })
              )
            } catch (err) {
              console.log(err)
            }
          }
        } catch (err) {
          res.status(500).send(
            failResponse({
              message: err ? err.message : "Data Not Fetched!"
            })
          );
        }
      })
    } else {
      res.status(500).send(
        failResponse({
          message: "No Self Review Done Yet!"
        })
      );
    }

  } else {
    //self
    EmployModel.findOne({ _id: req.params.toEmployeeId }, async (err, result) => {
      const userName = result.personalInformation.firstName + " " + result.personalInformation.lastName;
      const data_v2 = await CloseEndedQuestionsModel.find({});
      const QuestionsBanks = data_v2.map(item => item._doc);
      try {
        let final = false;
        let general = QuestionsBanks[Math.floor(Math.random() * QuestionsBanks.length)];
        if (req.params.answer === "undefined") {
          res.status(200).send(
            successResponse({
              message: final ? "Thank you" : 'sent',
              data: final ? null : {
                question: general['Question'],
                options: ['Never', "Few of the times", 'Most of the times', 'Always'],
                ranking: general['Ranking'],
                subcategory: general["SubCategory"],
                category: general['CompetencyName'],
                defination: general["Defination"],
                tag: general["Options"]
                // polarity: req.body.polarity
              }
            })
          )
        }
        else {
          try {
            let data = {
              category: req.body.category,
              subcategory: req.body.subcategory,
              question: req.body.question,
              answer: req.body.answer,
              responsetime: req.body.responsetime,
              Ranking: req.body.ranking,
              userId: req.params.userId,
              defination: req.body.defination,
              tag: req.body.tag,
              score: req.body.score,
              templateId: req.body.templateId,
              // polarity: req.body.polarity
            };
            const newChat = new ChatbotModel(data);
            await newChat.save();
            const userData = await ChatbotModel.find({ userId: req.params.userId, templateId: req.body.templateId });
            let existingCategories = userData.map(item => item.category);
            existingCategories = removeDuplicates(existingCategories);
            const questions = QuestionsBanks.filter((item) => !existingCategories.includes(item.CompetencyName));
            let finalQuestions = questions.length > 0 ? questions.map(item => ({ ...item, Question: item.Question.toString().replace(/&username/gi, userName) })) : [];
            const nextQuestion = finalQuestions.length > 0 ? [finalQuestions[Math.floor(Math.random() * finalQuestions.length)]] : [];
            let finalQuestion = nextQuestion.length == 0 ? [] : nextQuestion[0]
            res.status(200).send(
              successResponse({
                message: finalQuestion.length === 0 ? "Thank you" : 'sent',
                data: nextQuestion.length === 0 ? null : {
                  question: finalQuestion['Question'],
                  options: ['Never', "Few of the times", 'Most of the times', 'Always'],
                  ranking: finalQuestion['Ranking'],
                  // numberOfQuestions: req.params.numberOfQuestions - 1,
                  subcategory: finalQuestion["SubCategory"],
                  category: finalQuestion['CompetencyName'],
                  defination: finalQuestion['Defination'],
                  tag: finalQuestion["Options"]
                  // polarity: req.body.polarity
                }
              })
            )
          } catch (err) {
            console.log(err)
          }
        }
      } catch (err) {
        res.status(500).send(
          failResponse({
            message: err ? err.message : "Data Not Fetched!"
          })
        );
      }
    })
  }
};

const getChatbotData = async (req, res) => {
  // #swagger.tags = ['Close Ended Questions']
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

//close ended questions
const ChatbotModel = require('../models/chatbot.model_v2')
const EmployModel = require("../models/employee.model");
const CloseEndedQuestionsModel = require("../models/chatbotQuestions_v2.model");
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
  //console.log(req.params.userId, req.body)
  const data_v2 = await CloseEndedQuestionsModel.find({});
  EmployModel.findOne({ _id: req.params.userId }, async (err, result) => {
    //console.log(result)
    let userName = result.personalInformation.firstName + " " + result.personalInformation.lastName;
    // let sampleData = data.filter((item) => item['Competency Name'] === 'Accountability' || item['Competency Name'] === 'Accountability' || item['Competency Name'] === 'Ambition' || item['Competency Name'] === 'Assertiveness')
    let sampleData = data_v2.map(item => item._doc);
    let General = sampleData.filter((item) => item['SubCategory'] === 'General')
    let Leadership = sampleData.filter((item) => item['SubCategory'] === 'Leadership');
    try {
      let final = false;
      let general;
      if (req.params.answer === "undefined") {
        //const userData = await ChatbotModel.find({ userId: req.params.userId })
        //if (userData.length === 0) {
        //var general = General[Math.floor(Math.random() * General.length)];
        if (req.params.role === "Employee" || req.params.role === "Proxelera Employee") {
          general = General[Math.floor(Math.random() * General.length)];
        }
        else {
          general = Leadership[Math.floor(Math.random() * Leadership.length)];
        }
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
        //} else {
        //  res.status(200).send(
        //    successResponse({
        //      message: "Already Finished",
        //      data: null
        //    })
        //  )
        //}
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
          const userData = await ChatbotModel.find({ Ranking: req.body.ranking, userId: req.params.userId, templateId: req.body.templateId })
          const questions = req.params.role !== "Employee" ? Leadership.filter((item) => item.Ranking === req.body.ranking) : General.filter((item) => item.Ranking === req.body.ranking);
          let finalQuestions = questions.map(item => ({ ...item, Question: item.Question.replace(/&username/gi, userName) }));
          const nextQuestion = finalQuestions.filter((item) => !userData.map(itemm => itemm.question).includes(item.Question));
          if (req.params.role !== "Employee") {
            if (nextQuestion.length === 0) {
              const questions = General.filter((item) => item.Ranking === req.body.ranking);
              if (questions.length === 0) {
                let finalQuestion = General[Math.floor(Math.random() * General.length)];
                res.status(200).send(
                  successResponse({
                    message: finalQuestion.length === 0 ? "Thank you" : 'sent',
                    data: finalQuestion.length === 0 ? null : {
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
              } else {
                const questions = General.filter((item) => item.Ranking === req.body.ranking);
                let finalQuestions = questions.map(item => ({ ...item, Question: item.Question.replace(/&username/gi, userName) }));
                const nextQuestion = finalQuestions.filter((item) => !userData.map(itemm => itemm.question).includes(item.Question));
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
              }
            } else {
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
            }
          } else {
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
          }
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

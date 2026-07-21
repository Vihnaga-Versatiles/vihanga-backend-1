const ChatbotReviewsModel = require("../models/chatbotReviews_v2.model");
const ChatbotModelV2 = require("../models/chatbot.model_v2");
const EmployeesModel = require("../models/employee.model");
const AdvancedLaunchFormModel = require("../models/advancedLaunchForms.model");

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

const createReview = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews']
  try {
    let requestBody = {
      userId: req.body.userId,
      userRole: req.body.userRole,
      reviewedId: req.body.reviewedId,
      reviewedRole: req.body.reviewedRole,
      templateId: req.body.templateId,
    };
    const newChatbotReview = new ChatbotReviewsModel(requestBody);
    await newChatbotReview.save();
    res.status(200).send(
      successResponse({
        message: "Review Added Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Not Added!",
      })
    );
  }
};

const getAllReviews = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews']
  try {
    const Reviews = await ChatbotReviewsModel.find({}).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "reviews Not Fetched!",
      })
    );
  }
};
function getName(myUserData) {
  return myUserData.personalInformation.firstName + " " + (myUserData.personalInformation.lastName ? myUserData.personalInformation.lastName : "")
}
const getAllReviewsByUserId = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews']
  try {
    const Reviews = await ChatbotReviewsModel.find({ userId: req.params.userId }).sort({ _id: -1 });
    const ChatbotData = await ChatbotModelV2.find({}).sort({ _id: -1 });
    const users = await EmployeesModel.find({ "employmentInformation.status": "Active" });
    let myUserData = users.filter(user => user._id == req.params.userId)[0];
    let myManagerId = myUserData._doc.employmentInformation.lineManager;
    let myCompanyId = myUserData._doc.companyId;
    let myPeersData = users.filter(user => user.companyId == myCompanyId && user._doc.employmentInformation.lineManager == myManagerId && user._id != myManagerId && user._id != req.params.userId);
    let categories = ChatbotData.map(item => item.category);
    categories = [...new Set(categories)];
    let reviewsData = [{
      username: getName(myUserData) + " (Self)",
      fullname: getName(myUserData),
      userId: req.params.userId,
      role: "Self",
      status: Reviews.filter(item => item.reviewedId == req.params.userId).length > 0 ? "Reviewed" : "Take Review",
      length: Reviews.filter(item => item.reviewedId == req.params.userId).length,

    },
    ];
    if (myManagerId) {
      let myManagerData = users.filter(user => user._id.toString() == myManagerId)[0];
      reviewsData.push({
        username: getName(myManagerData) + " (Manager)",
        fullname: getName(myManagerData),
        userId: myManagerId,
        role: "Manager",
        status: Reviews.filter(item => item.reviewedId == myManagerId).length > 0 ? "Reviewed" : "Take Review",
        report: ChatbotData.filter(item => item.userId == myManagerId)
      })
      reviewsData[0].report = {
        ...reviewsData[0].report,
        managerCompleted: Reviews.filter(item => item.reviewedId == myManagerId).length > 0 ? 1 : 0,
        scoreManager: categories.map(category => {

          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            let score = ChatbotData.filter(item => item.category === category && item.defination === defination && item.userId == myManagerId).reduce((prev, current) => prev + Number(current.score), 0);
            let numberOfScores = ChatbotData.filter(item => item.category === category && item.defination === defination && item.userId == myManagerId).length;
            obj.score = score;
            obj.numberOfScores = numberOfScores;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        })
      }
    }
    if (myPeersData.length > 0) {
      let myPeersDataFinal = myPeersData.map((peer) => {
        return {
          username: getName(peer) + " (Peer)",
          fullname: getName(peer),
          userId: peer._id.toString(),
          role: "Peer",
          status: Reviews.filter(item => item.reviewedId == peer._id.toString()).length > 0 ? "Reviewed" : "Take Review",
          report: ChatbotData.filter(item => item.userId == peer._id.toString())
        }
      });
      reviewsData = [...reviewsData, ...myPeersDataFinal];
      let peerIds = myPeersDataFinal.map(item => item.userId.toString());
      reviewsData[0].report = {
        ...reviewsData[0].report,
        peersCompleted: myPeersDataFinal.filter(item => item.status === "Reviewed").length,
        scorePeers: categories.map(category => {

          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            let score = ChatbotData.filter(item => item.category === category && item.defination === defination && peerIds.includes(item.userId)).reduce((prev, current) => prev + Number(current.score), 0);
            let numberOfScores = ChatbotData.filter(item => item.category === category && item.defination === defination && peerIds.includes(item.userId)).length;
            obj.score = score;
            obj.numberOfScores = numberOfScores;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        })
      }
    }
    // reviewsData[0].report = {
    //   ...reviewsData[0].report,
    //   totalCompleted: reviewsData[0].report.selfCompleted + reviewsData[0].report.managerCompleted + reviewsData[0].report.peersCompleted,
    //   groupScore: categories.map(category => {
    //     let obj = { category, definitions: [], averageScore: 0 };
    //     let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
    //     definitions = [...new Set(definitions)];
    //     let result = definitions.map(defination => {
    //       let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
    //       let score1 = reviewsData[0].report.scoreSelf.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.score), 0);
    //       let scoreNumber1 = reviewsData[0].report.scoreSelf.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.numberOfScores), 0);
    //       let score2 = reviewsData[0].report.scoreManager.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.score), 0);
    //       let scoreNumber2 = reviewsData[0].report.scoreManager.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.numberOfScores), 0);
    //       let score3 = reviewsData[0].report.scorePeers.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.score), 0);
    //       let scoreNumber3 = reviewsData[0].report.scorePeers.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.numberOfScores), 0);
    //       obj.score = score1 + score2 + score3;
    //       obj.numberOfScores = scoreNumber1 + scoreNumber2 + scoreNumber3;
    //       obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
    //       return obj;
    //     });
    //     obj.definitions = result;
    //     obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
    //     return obj;
    //   })
    // }
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: reviewsData,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "reviews Not Fetched!",
      })
    );
  }
};
const getReportByUserId = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews']
  try {
    //get userId, templateId;
    const userId = req.params.userId;
    const templateId = req.params.templateId;
    const Reviews = await ChatbotReviewsModel.find({ userId, templateId }).sort({ _id: -1 });
    //get self, manager, peers data
    const AdvancedLaunchForms = await AdvancedLaunchFormModel.findOne({ toEmployee: userId, _id: templateId }, {
      selfAndManager: 1,
      peers: 1,
    });

    //both self and manager, peers
    const peersIds = AdvancedLaunchForms.peers;
    const selfAndManagerAndPeersIds = [...AdvancedLaunchForms.selfAndManager, ...peersIds];
    const ManagerReviews = await ChatbotReviewsModel.find({ reviewedId: selfAndManagerAndPeersIds[1], templateId }).sort({ _id: -1 });
    const PeersReviews = await ChatbotReviewsModel.find({ reviewedId: { $in: peersIds }, templateId }).sort({ _id: -1 });

    const users = await EmployeesModel.find({ "employmentInformation.status": "Active", _id: { $in: selfAndManagerAndPeersIds } }, {
      "personalInformation.password": 0,
    });
    let myUserData = users.filter(user => user._id == userId)[0];
    let myManagerId = selfAndManagerAndPeersIds[1];
    let myPeersData = users.filter(user => peersIds.includes(user._id));
    const ChatbotData = await ChatbotModelV2.find({ templateId, userId: { $in: selfAndManagerAndPeersIds } }).sort({ _id: -1 });
    let categories = ChatbotData.map(item => item.category);
    categories = [...new Set(categories)];
    let reviewsData = [{
      username: getName(myUserData) + " (Self)",
      fullname: getName(myUserData),
      userId: userId,
      role: "Self",
      status: Reviews.filter(item => item.reviewedId == userId).length > 0 ? "Reviewed" : "Take Review",
      length: Reviews.filter(item => item.reviewedId == userId).length,
      report: {
        data: ChatbotData.filter(item => item.userId == userId),
        selfCompleted: Reviews.filter(item => item.reviewedId == userId).length > 0 ? 1 : 0,
        scoreSelf: categories.map(category => {
          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            let score = ChatbotData.filter(item => item.category === category && item.defination === defination && item.userId == userId).reduce((prev, current) => prev + Number(current.score), 0);
            let numberOfScores = ChatbotData.filter(item => item.category === category && item.defination === defination && item.userId == userId).length;
            obj.score = score;
            obj.numberOfScores = numberOfScores;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        })
      },
    },
    ];
    if (!!ManagerReviews.length) {
      let myManagerData = users.filter(user => user._id.toString() == myManagerId)[0];
      reviewsData.push({
        username: getName(myManagerData) + " (Manager)",
        fullname: getName(myManagerData),
        userId: myManagerId,
        role: "Manager",
        status: ManagerReviews.filter(item => item.reviewedId == myManagerId).length > 0 ? "Reviewed" : "Take Review",
        report: ChatbotData.filter(item => item.userId == myManagerId)
      })
      reviewsData[0].report = {
        ...reviewsData[0].report,
        managerCompleted: ManagerReviews.filter(item => item.reviewedId == myManagerId).length > 0 ? 1 : 0,
        scoreManager: categories.map(category => {

          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            let score = ChatbotData.filter(item => item.category === category && item.defination === defination && item.userId == myManagerId).reduce((prev, current) => prev + Number(current.score), 0);
            let numberOfScores = ChatbotData.filter(item => item.category === category && item.defination === defination && item.userId == myManagerId).length;
            obj.score = score;
            obj.numberOfScores = numberOfScores;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        })
      }
    } else {
      reviewsData[0].report = {
        ...reviewsData[0].report,
        scoreManager: categories.map(category => {
          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            obj.score = 0;
            obj.numberOfScores = 0;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        }),
        managerCompleted: 0,
      }
    }
    if (myPeersData.length > 0) {
      let myPeersDataFinal = myPeersData.map((peer) => {
        return {
          username: getName(peer) + " (Peer)",
          fullname: getName(peer),
          userId: peer._id.toString(),
          role: "Peer",
          status: PeersReviews.filter(item => item.reviewedId == peer._id.toString()).length > 0 ? "Reviewed" : "Take Review",
          report: ChatbotData.filter(item => item.userId == peer._id.toString())
        }
      });
      reviewsData = [...reviewsData, ...myPeersDataFinal];
      let peerIds = myPeersDataFinal.map(item => item.userId.toString());
      reviewsData[0].report = {
        ...reviewsData[0].report,
        peersCompleted: myPeersDataFinal.filter(item => item.status === "Reviewed").length,
        scorePeers: categories.map(category => {
          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            let score = ChatbotData.filter(item => item.category === category && item.defination === defination && peerIds.includes(item.userId)).reduce((prev, current) => prev + Number(current.score), 0);
            let numberOfScores = ChatbotData.filter(item => item.category === category && item.defination === defination && peerIds.includes(item.userId)).length;
            obj.score = score;
            obj.numberOfScores = numberOfScores;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        })
      }
    } else {
      reviewsData[0].report = {
        ...reviewsData[0].report,
        scorePeers: categories.map(category => {
          let obj = { category, definitions: [], averageScore: 0 };
          let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
          definitions = [...new Set(definitions)];
          let result = definitions.map(defination => {
            let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
            obj.score = 0;
            obj.numberOfScores = 0;
            obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
            return obj;
          });
          obj.definitions = result;
          obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
          return obj;
        }),
        peersCompleted: 0,
      }
    }

    reviewsData[0].report = {
      ...reviewsData[0].report,
      totalCompleted: reviewsData[0].report.selfCompleted + reviewsData[0].report.managerCompleted + reviewsData[0].report.peersCompleted,
      groupScore: categories.map(category => {
        let obj = { category, definitions: [], averageScore: 0 };
        let definitions = ChatbotData.filter(item => item.category == category).map(item => item.defination);
        definitions = [...new Set(definitions)];
        let result = definitions.length > 0 ? definitions.map(defination => {
          let obj = { category, defination, score: 0, numberOfScores: 0, averageScore: 0 };
          let score1 = reviewsData[0].report.scoreSelf.length > 0 ? reviewsData[0].report.scoreSelf.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.score), 0) : 0;
          let scoreNumber1 = reviewsData[0].report.scoreSelf.length > 0 ? reviewsData[0].report.scoreSelf.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.numberOfScores), 0) : 0;
          let score2 = reviewsData[0].report.scoreManager.length > 0 ? reviewsData[0].report.scoreManager.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.score), 0) : 0
          let scoreNumber2 = reviewsData[0].report.scoreManager.length > 0 ? reviewsData[0].report.scoreManager.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.numberOfScores), 0) : 0;
          let score3 = reviewsData[0].report.scorePeers.length > 0 ? reviewsData[0].report.scorePeers.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.score), 0) : 0;
          let scoreNumber3 = reviewsData[0].report.scorePeers.length > 0 ? reviewsData[0].report.scorePeers.filter(item => item.category === category)[0].definitions.filter(item => item.defination === defination).reduce((prev, current) => prev + Number(current.numberOfScores), 0) : 0;
          obj.score = score1 + score2 + score3;
          obj.numberOfScores = scoreNumber1 + scoreNumber2 + scoreNumber3;
          obj.averageScore = obj.numberOfScores > 0 ? Number(obj.score / obj.numberOfScores).toFixed(2) : 0;
          return obj;
        }) : []
        obj.definitions = result;
        obj.averageScore = result.length > 0 ? Number(result.reduce((prev, current) => prev + Number(current.averageScore), 0) / result.length).toFixed(2) : 0;
        return obj;
      }),
    }

    reviewsData[0].report = {
      ...reviewsData[0].report,
      overallRating: reviewsData[0].report.groupScore.length > 0 ? Number(reviewsData[0].report.groupScore.reduce((prev, current) => prev + Number(current.averageScore), 0) / reviewsData[0].report.groupScore.length).toFixed(2) : 0,
    }
    res.status(200).send(
      successResponse({
        message: "Reviews Retrieved Successfully!",
        data: reviewsData,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "reviews Not Fetched!",
      })
    );
  }
};
const deleteReview = (req, res) => {
  // #swagger.tags = ['Chatbot Reviews']
  ChatbotReviewsModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Review Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Review Not Deleted!",
        })
      );
    }
  });
};

const updateReview = async (req, res) => {
  // #swagger.tags = ['Chatbot Reviews']
  try {
    const reviews = await ChatbotReviewsModel.findById(req.params.id);
    if (reviews) {
      ChatbotReviewsModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Review Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Review Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteReview,
  createReview,
  updateReview,
  getAllReviews,
  getReportByUserId,
  getAllReviewsByUserId,
};
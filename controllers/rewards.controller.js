require("dotenv").config();
const OkrLibraryModel = require("../models/rewards.model");
const RedemptionsModel = require("../models/redemptions.model");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENGRID_API_KEY,
    },
  })
);

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

const createOkrLibrary = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    let requestBody = {
      rewardIcon: req.body.rewardIcon,
      rewardName: req.body.rewardName,
      rewardCode: req.body.rewardCode,
      rewardDescription: req.body.rewardDescription,
      rewardType: req.body.rewardType,
      rewardCategory: req.body.rewardCategory,
      rewardApprover: req.body.rewardApprover,
      rewardPoints: req.body.rewardPoints,
      rewardAmount: req.body.rewardAmount,
      rewardStatus: req.body.rewardStatus ? req.body.rewardStatus : "active",
      companyId: req.body.companyId
    };
    const newOkrLibraryModel = new OkrLibraryModel(requestBody);
    await newOkrLibraryModel.save().then((result, err) => {
      if (!err) {
        res.status(200).send(
          successResponse({
            message: "Reward Created Successfully!",
            data: result,
          })
        );
      } else {
        res.status(500).send(
          failResponse({
            message: "Reward Not Created!",
          })
        );
      }
    });
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Not Created!",
      })
    );
  }
};


const getAllOkrLibrary = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    const companyId = req.params.companyId;
    const searchText = req.query.search || req.body.search || "";
        let searchQuery = { companyId };

      if (searchText && searchText.trim() !== "") {
      searchQuery.$or = [
        { rewardName: { $regex: searchText, $options: "i" } },
        { rewardCode: { $regex: searchText, $options: "i" } },
        { rewardDescription: { $regex: searchText, $options: "i" } },
        { rewardType: { $regex: searchText, $options: "i" } }
      ];
    }
    const Rewards = await OkrLibraryModel.find( searchQuery ).sort({ _id: -1 });
    const redeems = await RedemptionsModel.find({ companyId });
    //let redeemIds = redeems.map(item => item.rewardId);
    //let finalRewards = Rewards.filter(reward => !redeemIds.includes(reward._doc._id.toString()));
    let finalRewardsStatus = [];
    //if (finalRewards.length > 0) {
    finalRewardsStatus = Rewards.map(item => {
      return { ...item._doc, status: redeems.filter(itemm => itemm.rewardId == item._id.toString()).length > 0 ? redeems.filter(itemm => itemm.rewardId == item._id.toString())[0].status : "pending" }
    })
    //} else {
    //finalRewardsStatus = Rewards.map(item => ({ ...item._doc }));
    //}

    res.status(200).send(
      successResponse({
        message: "Rewards Retrieved Successfully!",
        data: finalRewardsStatus,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rewards Not Fetched!",
      })
    );
  }
};

const deleteOkrLibrary = (req, res) => {
  // #swagger.tags = ['Rewards']
  OkrLibraryModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Reward Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Reward Not Deleted!",
        })
      );
    }
  });
};

const deleteOkrLibraries = (req, res) => {
  // #swagger.tags = ['Rewards']
  OkrLibraryModel.deleteMany({ _id: { $in: req.body.data } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Rewards Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Rewards Not Deleted!",
        })
      );
    }
  });
};

const okrLibaryUpdate = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    const tasks = await OkrLibraryModel.findById(req.params.id);
    if (tasks) {
      OkrLibraryModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Reward Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Not Updated!",
      })
    );
  }
};

const redeemUpdate = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    const tasks = await RedemptionsModel.find({ rewardId: req.params.id });
    if (tasks) {
      RedemptionsModel.findOneAndUpdate({ rewardId: req.params.id }, req.body, (err, doc) => {
        if (!err) {
          //transporter
          //  .sendMail({
          //    //to: employee.contactInformation.email,
          //    to: ["info@talentspotify.com", "mogiliv3@gmail.com"],
          //    //cc: ["info@talentspotify.com", "mogiliv3@gmail.com"],
          //    from: "info@talentspotify.com",
          //    fromname: "Talent Spotify",
          //    subject: `Redeem Points ${req.body.status === "approved" ? "Approved" : "Rejected"}`,
          //    html: `
          //        <p>Hi,<br/><br/>
          //        <p style="color:${req.body.status === "approved" ? 'green' : 'red'}">Your redeem points ${doc.rewardPoints} worth of USD. ${doc.rewardAmount} are ${req.body.status === "approved" ? "Approved" : "Rejected"}</p>.
          //        <br/><br/>
          //        <p>Talent Spotify</p>
          //        `,
          //  })
          //  .then((response) => {
          //    if (response.message === "success") {
          res.status(200).send(
            successResponse({
              message: "Redemption Updated Successfully!",
            })
          );
          //} else {
          //  res.send({
          //    message: "Mail Not Sent!",
          //  });
          //}
          //});
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Reward Not Updated!",
      })
    );
  }
};
const createRedeemPoints = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    let requestBody = {
      rewardPoints: req.body.points,
      rewardAmount: req.body.amount,
      userId: req.body.userId,
      rewardId: req.body.rewardId,
      status: "in progress",
      companyId: req.body.companyId
    };
    RedemptionsModel.findOneAndDelete({ rewardId: req.body.rewardId }, async (errr, docs) => {
      const newOkrLibraryModel = new RedemptionsModel(requestBody);
      await newOkrLibraryModel.save().then((result, err) => {
        if (!err) {
          //transporter
          //  .sendMail({
          //    //to: employee.contactInformation.email,
          //    to: ["info@talentspotify.com", "mogiliv3@gmail.com"],
          //    //cc: ["info@talentspotify.com", "mogiliv3@gmail.com"],
          //    from: "info@talentspotify.com",
          //    fromname: "Talent Spotify",
          //    subject: "Redeem Points Requested",
          //    html: `
          //    <p>Hi,<br/><br/>
          //    You have received a redeem points request for ${req.body.points} points worth of USD. ${req.body.amount} from ${employees[0].personalInformation.firstName + " " + employees[0].personalInformation.lastName}.
          //    <br/>
          //    Go to <a href="https://talent-spotify-frontend-git-ollaa-company-talentspotify.vercel.app/admin/rewards/rewardsRedemption">Rewards and Redemptions</a> and Approve/Reject the request.
          //    <br/><br/>
          //    <p>Talent Spotify</p>
          //    `,
          //  })
          //  .then((response) => {
          //    if (response.message === "success") {
          res.status(200).send(
            successResponse({
              message: "Redemption Request Sent Successfully!",
              data: result,
            })
          );
          //} else {
          //  res.send({
          //    message: "Mail Not Sent!",
          //  });
          //}
          //});
        } else {
          res.status(500).send(
            failResponse({
              message: "Redemption Not Created!",
            })
          );
        }
      });
    })
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Redemption Not Created!",
      })
    );
  }
};

function getRandomColor() {
  let colors = ["green", "blue", "red", "brown", "orange", "black", "navy", "yellow"];
  return colors[Math.floor(Math.random() * (8 - 1 + 1) + 1)];
}
const getAllRedeemPoints = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    const redemptionPoints = await RedemptionsModel.find({ userId: req.params.id, status: "approved" }).sort({ _id: -1 });
    let totalPoints = redemptionPoints.reduce((prev, current) => {
      return prev + Number(current.rewardPoints)
    }, 0)
    let rewardIds = redemptionPoints.map(item => item.rewardId);
    const rewards = await OkrLibraryModel.find({ _id: { $in: rewardIds } }).sort({ _id: -1 });
    let rewardTypes = rewards.map(item => item.rewardType).filter((v, i, a) => a.findIndex(t => (t === v)) === i);
    let rewardTypeAndPoints = rewardTypes.map((item) => {
      let obj = { rewardType: item, color: getRandomColor() };
      let total = rewards.filter(reward => reward.rewardType === item).reduce((prev, current) => {
        return prev + current.rewardPoints;
      }, 0);
      obj.total = total;
      return obj;
    });
    res.status(200).send(
      successResponse({
        message: "Rewards Retrieved Successfully!",
        data: { totalPoints, rewardTypeAndPoints },
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rewards Not Fetched!",
      })
    );
  }
};

const deleteRedeempOptions = async (req, res) => {
  // #swagger.tags = ['Rewards']
  try {
    await RedemptionsModel.deleteMany({});
    res.status(200).send(
      successResponse({
        message: "Rewards Retrieved Successfully!",
        data: null,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Rewards Not Fetched!",
      })
    );
  }
};
module.exports = {
  deleteOkrLibraries,
  deleteOkrLibrary,
  createOkrLibrary,
  okrLibaryUpdate,
  getAllOkrLibrary,
  createRedeemPoints,
  getAllRedeemPoints,
  deleteRedeempOptions,
  redeemUpdate
};

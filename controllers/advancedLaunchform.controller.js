const AdvancedLaunchFormModel = require("../models/advancedLaunchForms.model");
const EmployeesModel = require("../models/employee.model");
const ChatbotReviewsAdvanced = require("../models/chatbotReviews_v2.model");

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

const createLaunchForm = async (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  try {
    let requestBody = req.body;
    const newdLaunchForm = new AdvancedLaunchFormModel(requestBody);
    await newdLaunchForm.save();
    res.status(200).send(
      successResponse({
        message: "Advanced LaunchForm Saved Successfully!",
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Advanced LaunchForm Not Saved!",
      })
    );
  }
};
const getAllLaunchForms = async (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  try {
    const Reviews = await AdvancedLaunchFormModel.find({}).sort({ _id: -1 });
    const toEmployeeIds = Reviews.map((item) => item.toEmployee);
    const employees = await EmployeesModel.find({ _id: { $in: toEmployeeIds } }, {
      "personalInformation.firstName": 1,
      "personalInformation.lastName": 1,
    });
    const updatedEmployees = employees.map((item) => ({ fullName: `${item.personalInformation.firstName} ${item.personalInformation.lastName}`, _id: item._id }))
    const updatedReviews = Reviews.map((item) => {
      let obj = { ...item._doc }
      obj.toEmployeeName = updatedEmployees.filter((emp) => emp._id.toString() === item.toEmployee.toString())[0].fullName;
      return obj;
    });
    res.status(200).send(
      successResponse({
        message: "Advanced LaunchForm Retrieved Successfully!",
        data: updatedReviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Advanced LaunchForm Not Fetched!",
      })
    );
  }
};
const getAllLaunchFormsById = async (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  try {
    const Reviews = await AdvancedLaunchFormModel.findOne({ _id: req.params.formId }).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Advanced LaunchForm Retrieved Successfully!",
        data: Reviews,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Advanced LaunchForm Not Fetched!",
      })
    );
  }
};
const getAllLaunchFormsByEmployeeId = async (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  try {
    const Reviews = await AdvancedLaunchFormModel.find({}).sort({ _id: -1 });
    let result = Reviews.filter((item) => item.employees.includes(req.params.employeeId))
    res.status(200).send(
      successResponse({
        message: "Advanced LaunchForm Retrieved Successfully!",
        data: result,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Advanced LaunchForm Not Fetched!",
      })
    );
  }
};


const getAdvancedLaunchFormsByEmployeeId = async (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  try {
    //1.Get All Reviews with Self.
    const employeeId = req.params.employeeId;
    const role = req.params.role;
    const tab = req.params.tab;
    let condition = {};
    //if (["Manager", "HR Admin"].includes(role)) {
    condition = { $or: [{ toEmployee: employeeId }, { peers: { $in: [employeeId] } }, { selfAndManager: { $in: [employeeId] } }] }
    //} else {
    //  condition = {
    //    $or: [{ toEmployee: employeeId }, { selfAndManager: { $in: [employeeId] } }]
    //  }
    //}
    const AdvancedLaunchForms = await AdvancedLaunchFormModel.find(condition, {
      createdAt: 1,
      updatedAt: 1,
      selfAndManager: 1,
      peers: 1,
      reviewPeriodStartDate: 1,
      reviewPeriodEndDate: 1,
      templateName: 1,
      formName: 1
    }).sort({ _id: -1 });
    const allTemplateIds = AdvancedLaunchForms.map(form => form._id.toString());
    //2.Iterate each template
    const result = allTemplateIds.map(async templateId => {
      //get self and manager ids
      const selfAndManagerIds = AdvancedLaunchForms.filter(form => form._id == templateId).map(form => form.selfAndManager);
      //get peers ids
      const peersIds = AdvancedLaunchForms.filter(form => form._id == templateId).map(form => form.peers);

      //both self and manager, peers
      let selfAndManagerAndPeersIds = [];
      selfAndManagerAndPeersIds = [...selfAndManagerIds[0], ...peersIds[0]];

      //Get to employee name
      const allEmployeeDetails = await EmployeesModel.find({ _id: { $in: selfAndManagerAndPeersIds } }, {
        "personalInformation.firstName": 1,
        "personalInformation.lastName": 1,
        "employmentInformation.role": 1
      });

      //Get self, manager and peers id, name, and type, status.
      const AllChatboReviews = await ChatbotReviewsAdvanced.find({ reviewedId: { $in: selfAndManagerAndPeersIds }, templateId }, { reviewedId: 1 });

      let updatedReviews = AdvancedLaunchForms.filter(form => form._id == templateId).map((item) => {
        let obj = { ...item._doc };
        const selfName = allEmployeeDetails.find(employee => employee._id == selfAndManagerAndPeersIds[0]);
        const selfFullName = selfName.personalInformation.firstName + " " + selfName.personalInformation.lastName;
        //if (selfAndManagerAndPeersIds > 1) {
        const managerName = allEmployeeDetails.find(employee => employee._id == selfAndManagerAndPeersIds[1]);
        const managerFullName = managerName.personalInformation.firstName + " " + managerName.personalInformation.lastName;
        const peersName = obj.peers.map((peerId) => {
          return { _id: selfAndManagerAndPeersIds[0], userId: peerId, name: allEmployeeDetails.filter((emp) => emp._id.toString() === peerId.toString())[0].personalInformation.firstName + " " + allEmployeeDetails.filter((emp) => emp._id.toString() === peerId.toString())[0].personalInformation.lastName, type: "peer", status: AllChatboReviews.find(review => review.reviewedId == peerId) ? "Reviewed" : "Take Review", templateId: obj._id, reviewPeriodStartDate: obj.reviewPeriodStartDate, reviewPeriodEndDate: obj.reviewPeriodEndDate, formName: obj.formName + "-" + selfFullName, templateName: obj.templateName, role: "Peer", canViewReport: false, toEmployeeName: selfFullName }
        });
        //}
        const canViewReport = AllChatboReviews.find(review => review.reviewedId == selfAndManagerAndPeersIds[0]) && AllChatboReviews.find(review => review.reviewedId == selfAndManagerAndPeersIds[1]) ? true : false;
        obj.employees = [
          { _id: selfAndManagerAndPeersIds[0], userId: selfAndManagerAndPeersIds[0], name: selfFullName, type: "self", status: AllChatboReviews.find(review => review.reviewedId == selfAndManagerAndPeersIds[0]) ? "Reviewed" : "Take Review", templateId: obj._id, reviewPeriodStartDate: obj.reviewPeriodStartDate, reviewPeriodEndDate: obj.reviewPeriodEndDate, formName: obj.formName + "-" + selfFullName, templateName: obj.templateName, role: "Self", canViewReport, toEmployeeName: selfFullName },
          { _id: selfAndManagerAndPeersIds[0], userId: selfAndManagerAndPeersIds[1], name: managerFullName, type: "manager", status: AllChatboReviews.find(review => review.reviewedId == selfAndManagerAndPeersIds[1]) ? "Reviewed" : "Take Review", templateId: obj._id, reviewPeriodStartDate: obj.reviewPeriodStartDate, reviewPeriodEndDate: obj.reviewPeriodEndDate, formName: obj.formName + "-" + selfFullName, templateName: obj.templateName, role: "Manager", canViewReport, toEmployeeName: selfFullName },
          ...peersName
        ];
        delete obj.selfAndManager;
        delete obj.peers;
        delete obj.reviewPeriodStartDate;
        delete obj.reviewPeriodEndDate;
        delete obj.formName;
        delete obj.templateName;
        return obj;
      });
      updatedReviews = updatedReviews.reduce((accumulator, form) => {
        return accumulator.concat(form.employees);
      }, []);
      //if employee
      if (!["Manager", "HR Admin", "Super Admin"].includes(role) || tab === "me") {
        updatedReviews = updatedReviews.filter(review => review.userId == employeeId)
      }
      return updatedReviews;
    });
    Promise.all(result).then((values) => {
      const updatedValues = values.reduce((accumulator, form) => {
        return accumulator.concat(form);
      }, []);
      res.status(200).send(
        successResponse({
          message: "Advanced LaunchForm Retrieved Successfully!",
          data: updatedValues,
        })
      );
    });


    //res.status(200).send(
    //  successResponse({
    //    message: "Advanced LaunchForm Retrieved Successfully!",
    //    data: result,
    //  })
    //);
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Advanced LaunchForm Not Fetched!",
      })
    );
  }
};
const deleteLaunchForm = (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  AdvancedLaunchFormModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Advanced LaunchForm Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Advanced LaunchForm Not Deleted!",
        })
      );
    }
  });
};

const updateLaunchForm = async (req, res) => {
  // #swagger.tags = ['Advanced Launch Form']
  try {
    const reviews = await AdvancedLaunchFormModel.findById(req.params.id);
    if (reviews) {
      AdvancedLaunchFormModel.findByIdAndUpdate(req.params.id, req.body, (err) => {
        if (!err) {
          res.status(200).send(
            successResponse({
              message: "Advanced LaunchForm Updated Successfully!",
            })
          );
        }
      });
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Advanced LaunchForm Not Updated!",
      })
    );
  }
};

module.exports = {
  deleteLaunchForm,
  updateLaunchForm,
  getAllLaunchFormsById,
  createLaunchForm,
  getAllLaunchForms,
  getAllLaunchFormsByEmployeeId,
  getAdvancedLaunchFormsByEmployeeId
};

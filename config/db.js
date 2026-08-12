      const mongoose = require("mongoose");
const { DATABASE_URL } = require("./environment");
//const AuditTrailModel = require("../models/AuditTrail");

//const saveChangedData = async (change) => {
//  console.log("change document", change)
//  let newChangeData = await AuditTrailModel({
//    dataDocument: change.fullDocument ? change.fullDocument : change.updateDescription,
//    operation: change.operationType,
//    collectionName: change.ns.coll,
//    userId: change.fullDocument ? change.fullDocument.userId : change.updateDescription.userId,
//    featureName: change.fullDocument ? change.fullDocument.featureName : change.updateDescription.featureName
//  })
//  newChangeData.save().then((res, err) => {
//    if (!err) {
//      console.log("Saved Data");
//    } else {
//      console.log("audit trail error", err);
//    }
//  })
//}

const connectDB = () => {
  try {
    mongoose.connect(DATABASE_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      tls: true,
    }).then(async (res) => {
      //const TaskModelChange = res.models.tasks2.watch();
      //TaskModelChange.on("change", (change) => {
      //  saveChangedData(change);
      //});
      console.log('MongoDB Database Connection Success!');

      // Ensure Employee indexes are correct (scope email uniqueness by company)
      try {
        const Employee = require("../models/employee.model");
        const legacyIndexName = 'contactInformation.email_1';
        const hasLegacyIndex = await Employee.collection.indexExists(legacyIndexName);
        if (hasLegacyIndex) {
          await Employee.collection.dropIndex(legacyIndexName);
          console.log(`Dropped legacy index: ${legacyIndexName}`);
        }
        await Employee.syncIndexes();
        console.log('Employee indexes synced');
      } catch (idxErr) {
        console.warn('Employee index sync warning:', idxErr.message || idxErr);
      }
    })
  } catch (err) {
    console.log('MongoDB Database Connection Failed!', err.message);
  }
};

module.exports = connectDB;
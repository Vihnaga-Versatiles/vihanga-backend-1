const mongoose = require("mongoose");

const Schema = new mongoose.Schema({
    SRnumber: {
        type: String,
        required: true
    },
    problemArea: {
        type: String,
        required: true
    },
    raisedBy: {
        type: String,
        //required: true
    },
    priority: {
        type: String,
    },
    status: {
        type: String,
        required: true
    },

    description: {
        type: String,
        required: false
    },
    userId: {
        type: String,
    },
    attachments: {
        type: String,
    },
    companyId: {
        type: String
    },
    companyName: {
        type: String
    },
    feed: {
        type: Array
    }
},
    { timestamps: true });


module.exports = mongoose.model("issueRise", Schema);

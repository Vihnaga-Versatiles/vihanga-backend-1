const mongoose=require("mongoose");

const holidaysCalendarSchema=new mongoose.Schema({
    holidayName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  fromDate: {
    type: Date,
  },
  toDate: {
    type: Date,
  },
  holidayDuration: {
    type: String, 
   },
  description: {
    type: String,
  },
   companyId: {
    type: String,
  }
})
module.exports = mongoose.model("HolidaysCalendar", holidaysCalendarSchema);


const express = require('express');
const router = express.Router();

const {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday
} = require('../../controllers/holidaysCalendar/holidaysCalendarController');

// Routes for HolidaysCalendar
router.post('/createHoliday', createHoliday);
router.get('/getAllHolidays', getAllHolidays);
router.get('/getHolidayById', getHolidayById);
router.put('/updateHoliday', updateHoliday);
router.delete('/deleteHoliday', deleteHoliday);

module.exports = router;

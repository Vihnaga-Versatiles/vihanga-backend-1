const HolidaysCalendar = require('../../models/holidaysCalendar/holidaysCalendar');
const {
  successResponse,
  errorResponse,
        } = require("../../utils/recruitment/responseHandler");

const createHoliday = async (req, res) => {
  try {
    const { companyId, holidayName, type, fromDate,toDate,holidayDuration, description } = req.body;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    if (!holidayName || !type || !fromDate ||!toDate) {
      return errorResponse(res, "Holiday name, type, and FromDate ,ToDate are required", 400);
    }

    const holidaysCalendarData = {
      companyId,
      holidayName,
      type,
      fromDate,
      toDate,
      holidayDuration,
      description,
    };

    const newHoliday = await HolidaysCalendar.create(holidaysCalendarData);

    return successResponse(res, newHoliday, "Holiday created successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

const getAllHolidays = async (req, res) => {
  try {
    const { companyId } = req.query;

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const holidays = await HolidaysCalendar.find({ companyId });

    return successResponse(res, holidays, "Holidays retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Get Single Holiday by ID
const getHolidayById = async (req, res) => {
  try {
    const { id, companyId } = req.query;

    if (!id) {
      return errorResponse(res, "Holiday ID is required", 400);
    }

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const holiday = await HolidaysCalendar.find({ _id: id, companyId });

    if (!holiday) {
      return errorResponse(res, "Holiday not found", 404);
    }

    return successResponse(res, holiday, "Holiday retrieved successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Update Holiday
const updateHoliday = async (req, res) => {
  try {
    const { id, } = req.query;
    const { holidayName, type, fromDate,toDate,holidayDuration, description } = req.body;

    if (!id) {
      return errorResponse(res, "Holiday ID is required", 400);
    }

   

    const updateData = {};
    if (holidayName !== undefined) updateData.holidayName = holidayName;
    if (type !== undefined) updateData.type = type;
    if (fromDate !== undefined) updateData.fromDate = fromDate;
     if (toDate !== undefined) updateData.toDate = toDate;
    if (holidayDuration !== undefined) updateData.holidayDuration = holidayDuration;
    if (description !== undefined) updateData.description = description;

    const updatedHoliday = await HolidaysCalendar.findByIdAndUpdate(
      { _id: id,  },
      { $set: updateData },
      { new: true }
    );

    if (!updatedHoliday) {
      return errorResponse(res, "Holiday not found", 404);
    }

    return successResponse(res, updatedHoliday, "Holiday updated successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

// Delete Holiday
const deleteHoliday = async (req, res) => {
  try {
    const { id, companyId } = req.query;

    if (!id) {
      return errorResponse(res, "Holiday ID is required", 400);
    }

    if (!companyId) {
      return errorResponse(res, "Company ID is required", 400);
    }

    const deletedHoliday = await HolidaysCalendar.findOneAndDelete({
      _id: id,
      companyId
    });

    if (!deletedHoliday) {
      return errorResponse(res, "Holiday not found", 404);
    }

    return successResponse(res, {}, "Holiday deleted successfully");
  } catch (error) {
    return errorResponse(res, error);
  }
};

module.exports = {
  createHoliday,
  getAllHolidays,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
};

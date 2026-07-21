require('dotenv').config();
const jwt = require('jsonwebtoken');
const Admin = require('../models/user.model');

const signToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
      email: user.contactInformation.email,
      mobileNumber: user.contactInformation.mobileNumber,
      image: user.personalInformation.image,
      role: user.employmentInformation.role,
      department: user.employmentInformation.department,
      company: user.employmentInformation.legalEntity,
      profilePicture: user.personalInformation.profilePicture,
      lineManager: user.employmentInformation.lineManager,
      companyId: user.companyId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '2d',
    }
  );
};

const isAuth = async (req, res, next) => {
  const { authorization } = req.headers;
  try {
    const token = authorization.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send({
      message: err.message,
      success: false,
      data: null
    });
  }
};

const isAdmin = async (req, res, next) => {
  const admin = await Admin.findOne({ email: req.body.email });
  if (admin.role === 'Admin') {
    next();
  } else {
    res.status(401).send({
      message: 'User is not Admin',
    });
  }
};
module.exports = {
  signToken,
  isAuth,
  isAdmin,
};

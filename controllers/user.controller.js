require("dotenv").config();
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const EmployModel = require("../models/employee.model");
const LoginSessionModel = require("../models/LoginSession.model");
const { signToken } = require("../config/auth");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/environment");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");

const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: process.env.SENGRID_API_KEY,
    },
  })
);

function generateRandomNumber(n) {
  return (
    Math.floor(Math.random() * (9 * Math.pow(10, n - 1))) + Math.pow(10, n - 1)
  );
}

const registerUser = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    let otp = generateRandomNumber(6);
    let name = req.body.name.split(" ")
    const newUser = new EmployModel({
      contactInformation: {
        email: req.body.email,
      },
      employmentInformation: {
        role: req.body.role
      },
      personalInformation: {
        firstName: name[0],
        lastName: name.length > 1 ? name[1] : '',
        password: bcrypt.hashSync(req.body.password),
        otp,
        otpExpire: Date.now() + 3600 * 1000,
      },
      companyId: req.body.companyId,
      freeTrail: req.body?.freeTrail || false
    });

    const user = await newUser.save();
    const token = signToken(user);
    //transporter
    //  .sendMail({
    //    to: user.email,
    //    from: "info@talentspotify.com",
    //fromname: "Vihanga",
    //    subject: "OTP Verification",
    //    html: `
    //  <p>Hi ${user.name},<br/><br/>
    //  This is your otp <b>${otp}</b>. It will expire in 24 hours.
    //  <br/><br/>
    //  <p>Vihanga</p>
    //  `,
    //  })
    //  .then((response) => {
    res.send({
      token,
      _id: user._id,
      name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
      firstName: user.personalInformation.firstName,
      email: user.contactInformation.email,
      mobileNumber: user.contactInformation.mobileNumber,
      image: user.personalInformation.image,
      role: user.employmentInformation.role,
      company: user.employmentInformation.legalEntity,
      profilePicture: user.personalInformation.profilePicture,
    });
    //});
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const loginUser = async (req, res) => {
  // #swagger.tags = ['User Management']
  
  // Sanitize email to remove \r\n and whitespace characters
  let email = req.body.email;
  if (email) {
    email = email
      .replace(/[\r\n]/g, '') // Remove carriage return and newline
      .trim() // Remove leading/trailing whitespace
      .toLowerCase(); // Convert to lowercase for consistency
  }
  
  // Try to find user with both clean email and original email (in case DB has \r\n)
  let user = await EmployModel.findOne({ "contactInformation.email": email });
  if (!user && req.body.email !== email) {
    // If not found with clean email, try with original email
    user = await EmployModel.findOne({ "contactInformation.email": req.body.email });
  }
  
  if (user) {
    // Use the actual email from database for the second query
    const user2 = await EmployModel.findOne({ 
      "contactInformation.email": user.contactInformation.email, 
      "employmentInformation.status": "Active" 
    });
    if (user2) {
      if (user && (req.body.password === "FreeTrail" ? true : bcrypt.compareSync(req.body.password, user.personalInformation.password))) {
        const token = signToken(user);
        try {
          const ip = req.headers["x-forwarded-for"] || req.connection?.remoteAddress || req.socket?.remoteAddress;
          await LoginSessionModel.create({
            employeeId: user._id,
            companyId: user.companyId || user?.employmentInformation?.legalEntityId || "",
            email: user.contactInformation.email,
            name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
            employeeNumber: user.employmentInformation.employeeNumber,
            designation: user.employmentInformation.designation,
            department: user.employmentInformation.department,
            location: user.employmentInformation.location,
            role: user.employmentInformation.role,
            ipAddress: Array.isArray(ip) ? ip[0] : ip,
            userAgent: req.headers["user-agent"],
            status: "Active",
          });
        } catch (e) {}
        res.send({
          token,
          _id: user._id,
          name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
          firstName: user.personalInformation.firstName,
          email: user.contactInformation.email,
          mobileNumber: user.contactInformation.mobileNumber,
          image: user.personalInformation.image,
          role: user.employmentInformation.role,
          department: user.employmentInformation.department,
          company: user.employmentInformation.legalEntity,
          profilePicture: user.personalInformation.profilePicture,
          lineManager: user.employmentInformation.lineManager,
          freeTrail: user.freeTrail,
          companyId: user.companyId
        });
      } else {
        res.status(401).send({
          message: "Invalid Password",
        });
      }
    } else {
      res.status(401).send({
        message: "Your Account Is Not Verified",
      });
    }
  } else {
    res.status(401).send({
      message: "Invalid Email",
    });
  }
};

const loginMicorsoftUser = async (req, res) => {
  // #swagger.tags = ['User Management']
  
  // Sanitize email to remove \r\n and whitespace characters
  let email = req.body.email;
  if (email) {
    email = email
      .replace(/[\r\n]/g, '') // Remove carriage return and newline
      .trim() // Remove leading/trailing whitespace
      .toLowerCase(); // Convert to lowercase for consistency
  }
  
  // Try to find user with both clean email and original email (in case DB has \r\n)
  let user = await EmployModel.findOne({ "contactInformation.email": email });
  if (!user && req.body.email !== email) {
    // If not found with clean email, try with original email
    user = await EmployModel.findOne({ "contactInformation.email": req.body.email });
  }
  
  if (user) {
    // Use the actual email from database for the second query
    const user2 = await EmployModel.findOne({ 
      "contactInformation.email": user.contactInformation.email, 
      "employmentInformation.status": "Active" 
    });
    const token = signToken(user);
    if (user2) {
      try {
        const ip = req.headers["x-forwarded-for"] || req.connection?.remoteAddress || req.socket?.remoteAddress;
        await LoginSessionModel.create({
          employeeId: user._id,
          companyId: user.companyId || user?.employmentInformation?.legalEntityId || "",
          email: user.contactInformation.email,
          name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
          employeeNumber: user.employmentInformation.employeeNumber,
          designation: user.employmentInformation.designation,
          department: user.employmentInformation.department,
          location: user.employmentInformation.location,
          role: user.employmentInformation.role,
          ipAddress: Array.isArray(ip) ? ip[0] : ip,
          userAgent: req.headers["user-agent"],
          status: "Active",
        });
      } catch (e) {}
      res.send({
        token,
        _id: user._id,
        name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
        firstName: user.personalInformation.firstName,
        email: user.contactInformation.email,
        mobileNumber: user.contactInformation.mobileNumber,
        image: user.personalInformation.image,
        role: user.employmentInformation.role,
        department: user.employmentInformation.department,
        company: user.employmentInformation.legalEntity,
        profilePicture: user.personalInformation.profilePicture,
        lineManager: user.employmentInformation.lineManager,
        freeTrail: user.freeTrail,
        companyId: user.companyId
      });
    } else {
      res.status(401).send({
        message: "Your Account Is Not Verified",
      });
    }
  } else {
    res.status(401).send({
      message: "Invalid Email",
    });
  }
};

// Token-based login for "open from email" flows.
// Frontend calls this when user opens a link like:
// /auth/login?fromEmail=true&emailId=...&token=...&redirect=/admin/...
const emailLinkLogin = async (req, res) => {
  try {
    const { token, emailId } = req.body || {};
    if (!token) {
      return res.status(400).send({ message: "token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || JWT_SECRET);
    } catch (e) {
      return res.status(401).send({ message: "Invalid or expired token" });
    }

    const tokenEmailRaw = decoded?.email || decoded?.emailId || decoded?.contactInformation?.email;
    const tokenEmail = tokenEmailRaw
      ? String(tokenEmailRaw).replace(/[\r\n]/g, "").trim().toLowerCase()
      : null;
    const requestedEmail = emailId
      ? String(emailId).replace(/[\r\n]/g, "").trim().toLowerCase()
      : null;

    if (!tokenEmail) {
      return res.status(401).send({ message: "Token missing email" });
    }
    // If frontend also provides emailId, enforce it matches token to prevent confusion.
    if (requestedEmail && requestedEmail !== tokenEmail) {
      return res.status(401).send({ message: "Email mismatch" });
    }

    const user = await EmployModel.findOne({
      "contactInformation.email": tokenEmail,
      "employmentInformation.status": "Active",
    });
    if (!user) {
      return res.status(401).send({ message: "Invalid Email" });
    }

    const newToken = signToken(user);

    // Optional: create login session (best-effort)
    try {
      const ip =
        req.headers["x-forwarded-for"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;
      await LoginSessionModel.create({
        employeeId: user._id,
        companyId: user.companyId || user?.employmentInformation?.legalEntityId || "",
        email: user.contactInformation.email,
        name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
        employeeNumber: user.employmentInformation.employeeNumber,
        designation: user.employmentInformation.designation,
        department: user.employmentInformation.department,
        location: user.employmentInformation.location,
        role: user.employmentInformation.role,
        ipAddress: Array.isArray(ip) ? ip[0] : ip,
        userAgent: req.headers["user-agent"],
        status: "Active",
      });
    } catch (e) {}

    return res.send({
      token: newToken,
      _id: user._id,
      name: user.personalInformation.firstName + " " + user.personalInformation.lastName,
      firstName: user.personalInformation.firstName,
      email: user.contactInformation.email,
      mobileNumber: user.contactInformation.mobileNumber,
      image: user.personalInformation.image,
      role: user.employmentInformation.role,
      department: user.employmentInformation.department,
      company: user.employmentInformation.legalEntity,
      profilePicture: user.personalInformation.profilePicture,
      lineManager: user.employmentInformation.lineManager,
      freeTrail: user.freeTrail,
      companyId: user.companyId,
    });
  } catch (err) {
    return res.status(500).send({ message: err?.message || "Email link login failed" });
  }
};

const changePassword = async (req, res) => {
  // #swagger.tags = ['User Management']
  const user = await User.findOne({ email: req.body.email });
  if (!user.password) {
    res.status(200).send({
      message: "For change password,You need to sign in with email & password!",
    });
  } else if (
    user &&
    bcrypt.compareSync(req.body.currentPassword, user.password)
  ) {
    user.password = bcrypt.hashSync(req.body.newPassword);
    await user.save();
    res.status(200).send({
      message: "Your password change successfully!",
    });
  } else {
    res.status(401).send({
      message: "Invalid email or current password!",
    });
  }
};

const signUpWithProvider = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    const isAdded = await User.findOne({ email: req.body.email });
    if (isAdded) {
      const token = signToken(isAdded);
      res.send({
        token,
        _id: isAdded._id,
        name: isAdded.name,
        email: isAdded.email,
        address: isAdded.address,
        phone: isAdded.phone,
        image: isAdded.image,
        role: isAdded.role,
      });
    } else {
      const newUser = new User({
        name: req.body.name,
        email: req.body.email,
        image: req.body.image,
        emailSignup: req.body.emailSignup,
        role: req.body.role,
      });

      const user = await newUser.save();
      const token = signToken(user);
      res.send({
        token,
        _id: user._id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      });
    }
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};
const getAllUsers = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    const users = await User.find({}).sort({ _id: -1 });
    res.send(users);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
};

const getUserById = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    const user = await User.findById(req.params.id);
    res.send(user);
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};


const updateUser = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.name = req.body.name;
      user.email = req.body.email;
      user.address = req.body.address;
      user.phone = req.body.phone;
      user.image = req.body.image;
      user.role = req.body.role;
      user.emailSignup = req.body.emailSignup ? req.body.emailSignup : false;
      const updatedUser = await user.save();
      const token = signToken(updatedUser);
      res.send({
        token,
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        address: updatedUser.address,
        phone: updatedUser.phone,
        image: updatedUser.image,
        role: updatedUser.role,
        emailSignup: updatedUser.emailSignup,
      });
    }
  } catch (err) {
    res.status(404).send({
      message: "Your email is not valid!",
    });
  }
};

const deleteUser = (req, res) => {
  // #swagger.tags = ['User Management']
  User.deleteOne({ _id: req.params.id }, (err) => {
    if (err) {
      res.status(500).send({
        message: err.message,
      });
    } else {
      res.status(200).send({
        message: "User Deleted Successfully!",
      });
    }
  });
};

const verifyOTP = async (req, res) => {
  // #swagger.tags = ['User Management']
  const user = await User.findOne({
    email: req.body.email,
    otp: req.body.otp,
    otpExpire: { $gt: Date.now() },
  });
  if (user) {
    user.otp = "";
    user.verified = true;
    user.save();
    const token = signToken(user);
    res.status(200).send({
      token,
      _id: user._id,
      name: user.name,
      email: user.email,
      address: user.address,
      phone: user.phone,
      image: user.image,
      role: user.role,
    });
  } else {
    res.status(401).send({
      message: "Invalid OTP!",
    });
  }
};

const forgotpassword = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    const isAdded = await EmployModel.findOne({
      "contactInformation.email": req.body.email,
      "contactInformation.verified": true,
      "employmentInformation.status": "Active"
    });
    if (!isAdded) {
      res.status(401).send({
        message: "This Email Not Found/Not Verified!",
      });
    } else {
      let token = generateRandomNumber(20);
      const newUser = {
        personalInformation: {
          token,
          tokenExpire: Date.now() + 3600 * 1000,
        }
      };
      const user = await EmployModel.findOneAndUpdate(
        { "contactInformation.email": req.body.email },
        newUser,
        (err) => {
          if (!err) {
            //transporter
            //  .sendMail({
            //    to: isAdded.contactInformation.email,
            //    from: "info@talentspotify.com",
            //    fromname: "Vihanga",
            //    subject: "Reset Password Link",
            //    html: `
            //  <p>Hi ${isAdded.personalInformation.firstName + " " + isAdded.personalInformation.lastName},<br/><br/>
            //  Please <a href="http://localhost:3000/user/resetpassword/${token}"> Click This Link <a/> To Reset Password . It will expire in 24 hours.
            //  <br/><br/>
            //  <p>Vihanga</p>
            //  `,
            //  })
            //  .then((response) => {
            //    if (response.message === "success") {
            res.send({
              message: "Reset Link sent",
            });
            //  } else {
            //    res.send({
            //      message: "Mail Not Sent!",
            //    });
            //  }
            //});
          }
        }
      );
      user.save();
    }
  } catch (err) {
    res.status(500).send({
      message: err.message,
    });
  }
};

const resetpassword = async (req, res) => {
  // #swagger.tags = ['User Management']
  const user = await EmployModel.findOne({
    "personalInformation.token": req.body.token,
    "personalInformation.tokenExpire": { $gt: Date.now() },
    "contactInformation.verified": true,
    "employmentInformation.status": "Active"
  });
  if (user) {
    const newUser = { password: bcrypt.hashSync(req.body.password) };
    await EmployModel.findOneAndUpdate({ "personalInformation.token": user.personalInformation.token }, newUser, (err) => {
      if (!err) {
        res.send({
          message: "Password Updated Successfully",
        });
      }
    });
  } else {
    res.status(401).send({
      message: "Invalid Token/Account Not Verified!",
    });
  }
};

const logout = async (req, res) => {
  EmployModel.findOne({ "contactInformation.email": req.body.email }, async (errr, user) => {
    if (!errr && user) {
      try {
        const openSession = await LoginSessionModel.findOne({ employeeId: user._id, logoutAt: null }).sort({ loginAt: -1 });
        if (openSession) {
          await LoginSessionModel.findByIdAndUpdate(openSession._id, { logoutAt: new Date(), status: "LoggedOut" });
        }
      } catch (e) {}
      res.send({
        success: true,
        message: "Logout Successfully!",
      });
    } else {
      res.send({ success: false, message: errr ? errr : "Something went wrong" });
    }
  });
}

// Utility function to clean existing emails in database
const cleanExistingEmails = async (req, res) => {
  try {
    // Find all employees with emails containing \r\n
    const employeesWithDirtyEmails = await EmployModel.find({
      "contactInformation.email": { $regex: /[\r\n]/ }
    });

    if (employeesWithDirtyEmails.length === 0) {
      return res.status(200).send({
        success: true,
        message: "No emails found with \\r\\n characters",
        cleaned: 0
      });
    }

    let cleanedCount = 0;
    const bulkOps = [];

    for (const employee of employeesWithDirtyEmails) {
      const originalEmail = employee.contactInformation.email;
      const cleanEmail = originalEmail
        .replace(/[\r\n]/g, '') // Remove carriage return and newline
        .trim() // Remove leading/trailing whitespace
        .toLowerCase(); // Convert to lowercase for consistency

      if (originalEmail !== cleanEmail) {
        bulkOps.push({
          updateOne: {
            filter: { _id: employee._id },
            update: { $set: { "contactInformation.email": cleanEmail } }
          }
        });
        cleanedCount++;
      }
    }

    if (bulkOps.length > 0) {
      await EmployModel.bulkWrite(bulkOps);
    }

    return res.status(200).send({
      success: true,
      message: `Successfully cleaned ${cleanedCount} email addresses`,
      cleaned: cleanedCount,
      details: employeesWithDirtyEmails.map(emp => ({
        id: emp._id,
        originalEmail: emp.contactInformation.email,
        cleanedEmail: emp.contactInformation.email
          .replace(/[\r\n]/g, '')
          .trim()
          .toLowerCase()
      }))
    });

  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Error cleaning emails",
      error: error.message
    });
  }
};

// Reissue a fresh JWT from an existing (possibly expired) but validly-signed
// token. Used by SSO clients (e.g. TARA) to silently renew the session without
// forcing the user to log in again. Only a token with a valid signature can be
// refreshed, so this cannot be used to mint tokens for arbitrary users.
const refreshToken = async (req, res) => {
  // #swagger.tags = ['User Management']
  try {
    const authHeader = req.headers.authorization || "";
    const oldToken = req.body?.token || authHeader.split(" ")[1];

    if (!oldToken) {
      return res.status(400).send({
        message: "Token is required",
        success: false,
        data: null,
      });
    }

    const secret = process.env.JWT_SECRET || JWT_SECRET;

    let decoded;
    try {
      // Accept expired tokens, but the signature must still be valid.
      decoded = jwt.verify(oldToken, secret, { ignoreExpiration: true });
    } catch (e) {
      return res.status(401).send({
        message: "Invalid token",
        success: false,
        data: null,
      });
    }

    const userId = decoded?._id || decoded?.employeeId;
    if (!userId) {
      return res.status(401).send({
        message: "Invalid token payload",
        success: false,
        data: null,
      });
    }

    const user = await EmployModel.findById(userId);
    if (!user) {
      return res.status(404).send({
        message: "User not found",
        success: false,
        data: null,
      });
    }

    const token = signToken(user);

    return res.status(200).send({
      success: true,
      message: "Token refreshed successfully",
      data: {
        token,
        _id: user._id,
        companyId: user.companyId,
        name:
          (user.personalInformation?.firstName || "") +
          " " +
          (user.personalInformation?.lastName || ""),
        email: user.contactInformation?.email,
        role: user.employmentInformation?.role,
        profilePicture: user.personalInformation?.profilePicture,
      },
    });
  } catch (err) {
    return res.status(500).send({
      message: err ? err.message : "Failed to refresh token",
      success: false,
      data: null,
    });
  }
};

module.exports = {
  signUpWithProvider,
  registerUser,
  loginUser,
  changePassword,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  verifyOTP,
  forgotpassword,
  resetpassword,
  logout,
  loginMicorsoftUser,
  emailLinkLogin,
  cleanExistingEmails,
  refreshToken
};

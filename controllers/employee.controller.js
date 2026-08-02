require("dotenv").config();
const { CLIENTURL } = require("../config/environment");
const orgchartObject = require("../helpers/orgchartObject");
const EmployModel = require("../models/employee.model");
const bcrypt = require("bcryptjs");
const { sendEmail } = require("../middlewares/recruitment/sendMail");
const EntityModel = require("../models/entity.model");
const CompanyModel = require("../models/company.model");

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

const createEmployee = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    // Handle ChildInformation array processing
    let childInformation = [];
    if (req.body.ChildInformation) {
      // If ChildInformation is an array, use it directly
      if (Array.isArray(req.body.ChildInformation)) {
        childInformation = req.body.ChildInformation;
      } else {
        // If it's an object with numeric keys, extract the values
        childInformation = Object.values(req.body.ChildInformation).filter(child =>
          child && (child.firstName || child.lastName || child.gender)
        );
      }
    } else if (req.body.children) {
      childInformation = Array.isArray(req.body.children) ? req.body.children : [];
    }

    // ===== HANDLE LEGAL ENTITY & FUNCTION MAPPINGS =====
    // Support both old format (single legalEntity/department) and new format (legalEntityMappings array)
    let employmentInfo = { ...req.body.employmentInformation };
    let legalEntityMappings = [];

    // Case 1: New format - legalEntityMappings array exists
    if (req.body.employmentInformation?.legalEntityMappings &&
      Array.isArray(req.body.employmentInformation.legalEntityMappings) &&
      req.body.employmentInformation.legalEntityMappings.length > 0) {
      legalEntityMappings = req.body.employmentInformation.legalEntityMappings;

      // Also populate legacy fields from PRIMARY mapping for backward compatibility
      const primaryMapping = legalEntityMappings.find(m => m.type === "PRIMARY");
      if (primaryMapping) {
        employmentInfo.legalEntity = primaryMapping.legalEntity;
        employmentInfo.department = primaryMapping.function;
        if (primaryMapping.designation) {
          employmentInfo.designation = primaryMapping.designation;
        }
        // Keep legacy departmentHead in sync with PRIMARY mapping's functionalHead when provided
        if (typeof primaryMapping.functionalHead === "boolean") {
          employmentInfo.departmentHead = primaryMapping.functionalHead ? "Yes" : "No";
        }
      }
    }
    // Case 2: Old format - single legalEntity/department exists
    else if (req.body.employmentInformation?.legalEntity && req.body.employmentInformation?.department) {
      // Convert old format to new format with PRIMARY type
      legalEntityMappings = [{
        legalEntity: req.body.employmentInformation.legalEntity,
        function: req.body.employmentInformation.department,
        type: "PRIMARY"
      }];
      // Keep legacy fields as is
      employmentInfo.legalEntity = req.body.employmentInformation.legalEntity;
      employmentInfo.department = req.body.employmentInformation.department;
    }

    employmentInfo.legalEntityMappings = legalEntityMappings;
    // ===== END LEGAL ENTITY & FUNCTION MAPPINGS HANDLING =====

    let requestBody = {
      personalInformation: req.body.personalInformation,
      contactInformation: req.body.contactInformation,
      ChildInformation: childInformation,
      SpouseInformation: req.body.SpouseInformation,
      PermanentAddress: req.body.PermanentAddress,
      employmentInformation: employmentInfo,
      PresentAddress: req.body.PresentAddress,
      companyId: req.body.companyId,
      candidateInformation: req.body.candidateInformation || {},
      resignation: req.body.resignation || {
        currentApprovalLevel: 0,
        overallStatus: "Pending",
        approvalSteps: [],
      },
      status: req.body.status || "Active"
    };

    // Ensure originalCandidateId is undefined (not empty string) to avoid unique constraint violation

    if (
      requestBody.employmentInformation.lineManager === "no_manager") {
      requestBody.employmentInformation.lineManager = "no_manager";
    }
    // Resolve lineManager from employeeNumber to _id if needed
    try {
      const maybeLineManager = requestBody.employmentInformation ? requestBody.employmentInformation.lineManager : "";
      if (maybeLineManager && requestBody.companyId) {
        const lmString = String(maybeLineManager);
        const isObjectIdLike = /^[a-fA-F0-9]{24}$/.test(lmString);
        if (!isObjectIdLike) {
          const managerDoc = await EmployModel.findOne({
            companyId: requestBody.companyId,
            "employmentInformation.employeeNumber": { $in: [maybeLineManager, String(maybeLineManager)] }
          }, { _id: 1 });
          if (managerDoc && requestBody.employmentInformation) {
            requestBody.employmentInformation.lineManager = String(managerDoc._id);
          }
        }
      }
    } catch (_) { /* ignore resolution errors; proceed with given value */ }

    // Handle field name mapping for personalInformation
    if (requestBody.personalInformation) {
      // Map panNumber to PanNumber
      if (requestBody.personalInformation.panNumber) {
        requestBody.personalInformation.PanNumber = requestBody.personalInformation.panNumber;
        delete requestBody.personalInformation.panNumber;
      }
    }

    // Handle field name mapping for contactInformation
    if (requestBody.contactInformation) {
      // Map stateOfBirth to StateOfBirth
      if (requestBody.contactInformation.stateOfBirth) {
        requestBody.contactInformation.StateOfBirth = requestBody.contactInformation.stateOfBirth;
        delete requestBody.contactInformation.stateOfBirth;
      }
      // Map fatherName to FatherName
      if (requestBody.contactInformation.fatherName) {
        requestBody.contactInformation.FatherName = requestBody.contactInformation.fatherName;
        delete requestBody.contactInformation.fatherName;
      }
      // Map bloodGroup to BloodGroup
      if (requestBody.contactInformation.bloodGroup) {
        requestBody.contactInformation.BloodGroup = requestBody.contactInformation.bloodGroup;
        delete requestBody.contactInformation.bloodGroup;
      }
      // Map pf to Pf
      if (requestBody.contactInformation.pf) {
        requestBody.contactInformation.Pf = requestBody.contactInformation.pf;
        delete requestBody.contactInformation.pf;
      }
    }

    // Sanitize email to remove \r\n and whitespace characters
    if (requestBody.contactInformation && requestBody.contactInformation.email) {
      // Clean the email by removing \r\n, whitespace, and converting to lowercase
      requestBody.contactInformation.email = requestBody.contactInformation.email
        .replace(/[\r\n]/g, '') // Remove carriage return and newline
        .trim() // Remove leading/trailing whitespace
        .toLowerCase(); // Convert to lowercase for consistency
    }

    if (requestBody.contactInformation && requestBody.contactInformation.email && requestBody.companyId) {
      const existingEmployee = await EmployModel.findOne({
        "contactInformation.email": requestBody.contactInformation.email,
        "companyId": requestBody.companyId,
      });

      if (existingEmployee) {
        return res.status(400).send(
          failResponse({
            message: "An employee with this email already exists in this company.",
          })
        );
      }
    }

    // Check for duplicate employee number
    if (requestBody.employmentInformation && requestBody.employmentInformation.employeeNumber && requestBody.companyId) {
      const existingEmployeeWithNumber = await EmployModel.findOne({
        "employmentInformation.employeeNumber": requestBody.employmentInformation.employeeNumber,
        "companyId": requestBody.companyId,
      });

      if (existingEmployeeWithNumber) {
        return res.status(400).send(
          failResponse({
            message: "An employee with this employee number already exists in this company.",
          })
        );
      }
    }

    // Check for Functional Head conflicts
    if (requestBody.employmentInformation && requestBody.employmentInformation.legalEntityMappings) {
      const conflictCheck = await checkFunctionalHeadConflict(
        requestBody.employmentInformation.legalEntityMappings,
        requestBody.companyId
      );
      if (conflictCheck.conflict) {
        return res.status(400).send(failResponse({ message: conflictCheck.message }));
      }
    }

    console.log("Complete requestBody being saved:", JSON.stringify(requestBody, null, 2));

    const newEmploy = new EmployModel(requestBody);
    console.log(newEmploy)
    await newEmploy.save();
    res.status(200).send(
      successResponse({
        message: "Employe Created Successfully!",
        data: newEmploy
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employe Not Created!",
      })
    );
  }
};

const getEmployees = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const employes = await EmployModel.find({ $or: [{ companyId: req.params.companyId, "employmentInformation.status": "Active" }, { "contactInformation.email": "superadmin@gmail.com" }] }).sort({ _id: -1 });

    // Fetch the company once and attach to each employee result
    const company = req.params.companyId ? await CompanyModel.findById(req.params.companyId) : null;
    const enrichedEmployees = employes.map((e) => {
      const obj = e.toObject();
      obj.companyObject = company || null;
      obj.companyDetailes = company || null;
      return obj;
    });

    res.status(200).send(
      successResponse({
        message: "Employees Retrieved Successfully!",
        data: enrichedEmployees,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employees Not Fetched!",
      })
    );
  }
};

const getEmployeesAll = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const { search } = req.query;
    let query = { companyId: req.params.companyId };

    // Add search functionality for firstName and lastName
    if (search) {
      query.$or = [
        { 'personalInformation.firstName': { $regex: search, $options: 'i' } },
        { 'personalInformation.lastName': { $regex: search, $options: 'i' } },

      ];
    }

    const employes = await EmployModel.find(query).sort({ _id: -1 });
    res.status(200).send(
      successResponse({
        message: "Employees Retrieved Successfully!",
        data: employes,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employes Not Fetched!",
      })
    );
  }
};
const createOrUpdateMultipleemploys = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const items = req.body.data;

    // Helper function to check if field is empty or whitespace
    const isEmpty = (value) => {
      return !value || (typeof value === 'string' && value.trim() === '');
    };

    // Required fields configuration
    const requiredFields = [
      { path: 'personalInformation.firstName', name: 'firstName' },
      { path: 'personalInformation.lastName', name: 'lastName' },
      { path: 'personalInformation.dateOfBirth', name: 'dateOfBirth' },
      { path: 'contactInformation.email', name: 'email' },
      { path: 'contactInformation.mobileNumber', name: 'mobileNumber' },
      { path: 'contactInformation.loginMethod', name: 'loginMethod' },
      { path: 'employmentInformation.hireDate', name: 'hireDate' },
      { path: 'employmentInformation.employeeNumber', name: 'employeeNumber' },
      { path: 'employmentInformation.status', name: 'status' },
      { path: 'employmentInformation.legalEntity', name: 'legalEntity' },
      { path: 'employmentInformation.department', name: 'department' },
      { path: 'employmentInformation.lineManager', name: 'lineManager' },
      { path: 'employmentInformation.designation', name: 'designation' }
    ];

    // Validation
    const validationErrors = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      for (const field of requiredFields) {
        const value = field.path.split('.').reduce((obj, key) => obj?.[key], item);
        if (isEmpty(value)) {
          validationErrors.push(`Employee ${i + 1}: ${field.name} is required`);
        }
      }
    }

    // If there are validation errors, return them immediately
    if (validationErrors.length > 0) {
      return res.status(400).send(failResponse({
        message: "Required fields are missing",
        data: validationErrors
      }));
    }

    // Map lineManager from employeeNumber (frontend) -> manager _id (db) in bulk, per company
    try {
      const companyToManagerNumbers = new Map();
      items.forEach((item) => {
        const companyId = item && item.companyId;
        const maybeLineManager = item && item.employmentInformation && item.employmentInformation.lineManager;
        if (!companyId || !maybeLineManager) return;
        const lmString = String(maybeLineManager);
        const isObjectIdLike = /^[a-fA-F0-9]{24}$/.test(lmString);
        if (isObjectIdLike) return; // already an _id
        const set = companyToManagerNumbers.get(companyId) || new Set();
        set.add(lmString);
        companyToManagerNumbers.set(companyId, set);
      });

      // Fetch once per company
      const keyToId = new Map();
      const companyQueries = [];
      for (const [companyId, numSet] of companyToManagerNumbers.entries()) {
        companyQueries.push(
          EmployModel.find({
            companyId,
            "employmentInformation.employeeNumber": { $in: Array.from(numSet).flatMap(v => [v, String(v)]) }
          }, { _id: 1, companyId: 1, "employmentInformation.employeeNumber": 1 })
            .then((docs) => {
              docs.forEach((doc) => {
                const employeeNumber = doc && doc.employmentInformation && doc.employmentInformation.employeeNumber;
                if (employeeNumber != null) {
                  keyToId.set(`${companyId}|${String(employeeNumber)}`, String(doc._id));
                }
              });
            })
        );
      }
      await Promise.all(companyQueries);

      // Replace on items
      items.forEach((item) => {
        if (!item || !item.companyId || !item.employmentInformation) return;
        const maybeLineManager = item.employmentInformation.lineManager;
        if (!maybeLineManager) return;
        const lmString = String(maybeLineManager);
        const isObjectIdLike = /^[a-fA-F0-9]{24}$/.test(lmString);
        if (isObjectIdLike) return;
        const mappedId = keyToId.get(`${item.companyId}|${lmString}`) || keyToId.get(`${item.companyId}|${String(maybeLineManager)}`);
        if (mappedId) {
          item.employmentInformation.lineManager = mappedId;
        }
      });
    } catch (_) { /* ignore mapping errors; continue */ }

    // Check for duplicates within the payload first
    const seen = new Set();
    for (const item of items) {
      if (item.contactInformation && item.contactInformation.email && item.companyId) {
        const key = `${item.contactInformation.email}|${item.companyId}`;
        if (seen.has(key)) {
          return res.status(400).send(failResponse({ message: `Duplicate email ${item.contactInformation.email} in the request for the same company.` }));
        }
        seen.add(key);
      }
    }

    // Check against DB
    const validationPromises = items.map(item => {
      if (item.contactInformation && item.contactInformation.email && item.companyId) {
        const query = {
          "contactInformation.email": item.contactInformation.email,
          "companyId": item.companyId
        };
        if (item._id) {
          query._id = { $ne: item._id };
        }
        return EmployModel.findOne(query).then(existing => {
          if (existing) {
            throw new Error(`An employee with email ${item.contactInformation.email} already exists in this company.`);
          }
        });
      }
      return Promise.resolve();
    });

    await Promise.all(validationPromises);

    var ops = [];
    items.forEach((item) => {
      if (item._id) {
        ops.push({
          updateOne: {
            filter: { _id: item._id },
            update: {
              $set: item,
            },
            upsert: true,
          },
        });
      } else {
        ops.push({
          insertOne: {
            document: item,
          },
        });
      }
    });
    await EmployModel.bulkWrite(ops, { ordered: false });
    res.status(200).send(
      successResponse({
        message: "Employs Created Successfully!",
        data: items,
      })
    );
  } catch (err) {
    console.log("err-----", err)
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employs Not Created!",
      })
    );
  }
};

/**
 * Checks if a Functional Head already exists for any of the provided mappings.
 * @param {Array} mappings - List of legal entity mappings to check.
 * @param {String} companyId - The company ID.
 * @param {String} [excludeEmployeeId] - Optional employee ID to exclude from the check (for updates).
 * @returns {Promise<Object>} - Returns { conflict: boolean, message: string }
 */
const checkFunctionalHeadConflict = async (mappings, companyId, excludeEmployeeId = null) => {
  if (!mappings || !Array.isArray(mappings) || mappings.length === 0) return { conflict: false };

  // Filter only mappings that claim to be a functional head
  const fhMappings = mappings.filter(m => m.functionalHead === true || m.functionalHead === "true"); // Handle boolean or string true

  if (fhMappings.length === 0) return { conflict: false };

  for (const mapping of fhMappings) {
    const query = {
      companyId: companyId,
      "employmentInformation.status": "Active", // Only check active employees
      "employmentInformation.legalEntityMappings": {
        $elemMatch: {
          legalEntity: mapping.legalEntity,
          function: mapping.function,
          functionalHead: true
        }
      }
    };

    if (excludeEmployeeId) {
      query._id = { $ne: excludeEmployeeId };
    }

    const existingHead = await EmployModel.findOne(query).select("personalInformation firstName lastName");

    if (existingHead) {
      const name = existingHead.personalInformation
        ? `${existingHead.personalInformation.firstName} ${existingHead.personalInformation.lastName}`
        : "Another employee";

      return {
        conflict: true,
        message: `Functional Head already exists: ${name} is already the Functional Head for ${mapping.function} in ${mapping.legalEntity}.`
      };
    }
  }

  return { conflict: false };
};

//const deleteEmploy = async (req, res) => {
//  try {
//    const employe = await EmployModel.findById(req.params.id);
//    if (employe) {
//      let data = {
//        status: "Inactive",
//        personalInformation: employe.personalInformation,
//        contactInformation: employe.contactInformation,
//        employmentInformation: employe.employmentInformation,
//      };
//      EmployModel.findByIdAndUpdate(req.params.id, data, (err) => {
//        if (!err) {
//          res.status(200).send(
//            successResponse({
//              message: 'Employ Deleted Successfully!',
//            })
//          );
//        }
//      });

//    }
//  } catch (err) {
//    res.status(500).send(
//      failResponse({
//        message: err ? err.message : "Employ Not Deleted!",
//      })
//    );
//  }
//};

const deleteEmploy = (req, res) => {
  // #swagger.tags = ['Employee']
  EmployModel.findByIdAndRemove({ _id: req.params.id }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Employee Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Employee Not Deleted!",
        })
      );
    }
  });
};

const deleteEmployees = (req, res) => {
  // #swagger.tags = ['Employee']
  let ids = req.body.data.map((data) => data._id);
  EmployModel.deleteMany({ _id: { $in: ids } }, (err) => {
    if (!err) {
      res.status(200).send(
        successResponse({
          message: "Employees Deleted Successfully!",
        })
      );
    } else {
      res.status(500).send(
        failResponse({
          message: err ? err.message : "Employees Not Deleted!",
        })
      );
    }
  });
};

//const deleteEmployees = (req, res) => {
//  let ids = req.body.data.map((data) => data._id);
//  EmployModel.updateMany({ _id: { $in: ids } }, { status: "Inactive" }, (err) => {
//    if (!err) {
//      res.status(200).send(
//        successResponse({
//          message: "Employees Deleted Successfully!",
//        })
//      );
//    } else {
//      res.status(500).send(
//        failResponse({
//          message: err ? err.message : "Employees Not Deleted!",
//        })
//      );
//    }
//  });
//};

const getEmployeById = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const employe = await EmployModel.findById(req.params.id);
    res.status(200).send(
      successResponse({
        message: "Employ Retrieved Successfully!",
        data: employe,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employe Not Fetched!",
      })
    );
  }
};

function filterUsersByLineManager(allEmployees, lineManager) {
  let filteredData = allEmployees.filter(employee =>
    employee.employmentInformation.lineManager == lineManager &&
    employee.employmentInformation.status === "Active" &&
    // Allow CEO employees even without line manager, or employees with valid line managers
    (employee.employmentInformation.role.toLowerCase() === "ceo" ||
      (employee.employmentInformation.lineManager &&
        employee.employmentInformation.lineManager !== "" &&
        employee.employmentInformation.lineManager !== "no_manager"))
  );
  return filteredData.length > 0 ? filteredData.map(employee => orgchartObject(employee, "Panel")) : [];
}

const orgChartData = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    let finalData = [];
    let allEmployees = await EmployModel.find({ companyId: req.params.companyId, "employmentInformation.status": "Active" });

    // Filter only active employees with valid line managers (not empty and not no_manager)
    // Exception: Allow CEO employees even without line manager
    let filteredEmployees = allEmployees.filter(employee =>
      employee.employmentInformation.status === "Active" &&
      (employee.employmentInformation.role.toLowerCase() === "ceo" ||
        (employee.employmentInformation.lineManager &&
          employee.employmentInformation.lineManager !== "" &&
          employee.employmentInformation.lineManager !== "no_manager"))
    );

    let superAdmins = filteredEmployees.filter((employee) => employee.employmentInformation.role === "Super Admin");
    let HRs = filteredEmployees.filter((employee) => employee.employmentInformation.role === "HR Admin");
    let Managers = filteredEmployees.filter((employee) => employee.employmentInformation.role === "Manager");
    let Employees = filteredEmployees.filter((employee) => employee.employmentInformation.role === "Employee");

    filteredEmployees.forEach((employee) => {
      let obj = orgchartObject(employee, "Panel");
      obj.children = filterUsersByLineManager(filteredEmployees, employee._id);
      if (obj.children.length > 0) {
        obj.children.forEach((child) => {
          child.children = filterUsersByLineManager(filteredEmployees, child._id);
        });
      }
      obj.direct = obj.children.length;

      // Calculate total subordinates recursively
      function countAllSubordinates(children) {
        if (!children || children.length === 0) return 0;
        let total = children.length; // Count direct children
        children.forEach(child => {
          total += countAllSubordinates(child.children); // Recursively count their children
        });
        return total;
      }

      obj.subOrdinates = countAllSubordinates(obj.children);
      finalData.push(obj);
    });
    //superAdmins.forEach((superAdmin) => {
    //  let obj = orgchartObject(superAdmin, "Panel");
    //  let hrAdmins = HRs.map(hrAdmin => {
    //    let hrAdminObj = orgchartObject(hrAdmin, "Breaker");
    //    hrAdminObj.children = Employees.filter(employee => employee.employmentInformation.lineManager == hrAdmin._id).map(emp => {
    //      return orgchartObject(emp, "Switch")
    //    });
    //    hrAdminObj.direct = 0;
    //    hrAdminObj.subOrdinates = hrAdminObj.children.length;
    //    return hrAdminObj;
    //  });
    //  let managerAdmins = Managers.map(managerAdmin => {
    //    let managerAdminObj = orgchartObject(managerAdmin, "Breaker");
    //    managerAdminObj.children = Employees.filter(employee => employee.employmentInformation.lineManager == managerAdmin._id).map(emp => {
    //      return orgchartObject(emp, "Switch");
    //    });
    //    managerAdminObj.direct = 0;
    //    managerAdminObj.subOrdinates = managerAdminObj.children.length;
    //    return managerAdminObj;
    //  });
    //  obj.children = [...hrAdmins, ...managerAdmins];
    //  obj.direct = hrAdmins.length + managerAdmins.length;
    //  let totalEmployees = managerAdmins.reduce((prev, current) => {
    //    return prev + current.children.length;
    //  }, 0)
    //  obj.subOrdinates = totalEmployees;
    //  finalData.push(obj);
    //})
    res.status(200).send(
      successResponse({
        message: "Employ Retrieved Successfully!",
        data: {
          finalData, employees: Employees
        },
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employe Not Fetched!",
      })
    );
  }
};

const updateEmployee = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const employeeToUpdate = await EmployModel.findById(req.params.id);
    if (!employeeToUpdate) {
      return res.status(404).send(failResponse({ message: "Employee not found!" }));
    }
    if (employeeToUpdate) {
      let employe = req.body;
      const previousEmail = (employeeToUpdate?.contactInformation?.email || "").toString().trim().toLowerCase();
      let emailWillChange = false;
      let plainPasswordForEmail = null;

      // Resolve lineManager from employeeNumber to _id if needed
      try {
        const maybeLineManager = employe && employe.employmentInformation && employe.employmentInformation.lineManager == "no_manager" ? "" : employe.employmentInformation.lineManager;
        if (maybeLineManager) {
          const lmString = String(maybeLineManager);
          const isObjectIdLike = /^[a-fA-F0-9]{24}$/.test(lmString);
          if (!isObjectIdLike) {
            const managerDoc = await EmployModel.findOne({
              companyId: employeeToUpdate.companyId,
              "employmentInformation.employeeNumber": { $in: [maybeLineManager, String(maybeLineManager)] }
            }, { _id: 1 });
            if (managerDoc && employe.employmentInformation) {
              employe.employmentInformation.lineManager = String(managerDoc._id);
            }
          }
        }
      } catch (_) { /* ignore resolution errors; proceed */ }

      // Sanitize email to remove \r\n and whitespace characters
      if (employe.contactInformation && employe.contactInformation?.email) {
        // Clean the email by removing \r\n, whitespace, and converting to lowercase
        employe.contactInformation.email = employe.contactInformation.email
          .replace(/[\r\n]/g, '') // Remove carriage return and newline
          .trim() // Remove leading/trailing whitespace
          .toLowerCase(); // Convert to lowercase for consistency
        // Compare with previous email after normalization
        emailWillChange = !!employe.contactInformation.email && employe.contactInformation.email !== previousEmail;

        const existingEmployee = await EmployModel.findOne({
          "contactInformation.email": employe.contactInformation.email,
          "companyId": employeeToUpdate.companyId, // Use the existing companyId
          "_id": { $ne: req.params.id } // Exclude the current employee from the check
        });

        if (existingEmployee) {
          return res.status(400).send(failResponse({ message: "An employee with this email already exists in this company." }));
        }
        // If email is changing, proactively reset password in the same update
        if (emailWillChange) {
          plainPasswordForEmail = "Test@123";
          const hashedPassword = bcrypt.hashSync("Test@123");
          employe.personalInformation = {
            ...(employe.personalInformation || {}),
            password: hashedPassword,
          };
        }
      }

      // Check for duplicate employee number
      if (employe.employmentInformation && employe.employmentInformation.employeeNumber) {
        const existingEmployeeWithNumber = await EmployModel.findOne({
          "employmentInformation.employeeNumber": employe.employmentInformation.employeeNumber,
          "companyId": employeeToUpdate.companyId,
          "_id": { $ne: req.params.id } // Exclude the current employee from the check
        });

        if (existingEmployeeWithNumber) {
          return res.status(400).send(failResponse({ message: "An employee with this employee number already exists in this company." }));
        }
      }

      // Handle field name mapping for personalInformation
      if (employe.personalInformation) {
        // Map panNumber to PanNumber
        if (employe.personalInformation.panNumber) {
          employe.personalInformation.PanNumber = employe.personalInformation.panNumber;
          delete employe.personalInformation.panNumber;
        }
      }

      // Handle field name mapping for contactInformation
      if (employe.contactInformation) {
        // Map stateOfBirth to StateOfBirth
        if (employe.contactInformation.stateOfBirth) {
          employe.contactInformation.StateOfBirth = employe.contactInformation.stateOfBirth;
          delete employe.contactInformation.stateOfBirth;
        }
        // Map fatherName to FatherName
        if (employe.contactInformation.fatherName) {
          employe.contactInformation.FatherName = employe.contactInformation.fatherName;
          delete employe.contactInformation.fatherName;
        }
        // Map bloodGroup to BloodGroup
        if (employe.contactInformation.bloodGroup) {
          employe.contactInformation.BloodGroup = employe.contactInformation.bloodGroup;
          delete employe.contactInformation.bloodGroup;
        }
        // Map pf to Pf
        if (employe.contactInformation.pf) {
          employe.contactInformation.Pf = employe.contactInformation.pf;
          delete employe.contactInformation.pf;
        }
      }

      // Handle ChildInformation array processing
      let childInformation = [];
      if (employe.ChildInformation) {
        // If ChildInformation is an array, use it directly
        if (Array.isArray(employe.ChildInformation)) {
          childInformation = employe.ChildInformation;
        } else {
          // If it's an object with numeric keys, extract the values
          childInformation = Object.values(employe.ChildInformation).filter(child =>
            child && (child.firstName || child.lastName || child.gender)
          );
        }
      } else if (employe.children) {
        childInformation = Array.isArray(employe.children) ? employe.children : [];
      } else {
        childInformation = employeeToUpdate.ChildInformation || [];
      }

      // Clean up candidateInformation to avoid duplicate key errors
      let candidateInfo = employe.candidateInformation || employeeToUpdate.candidateInformation || {};
      if (candidateInfo.originalCandidateId === "" || candidateInfo.originalCandidateId === null) {
        delete candidateInfo.originalCandidateId;
      }

      // ===== HANDLE LEGAL ENTITY & FUNCTION MAPPINGS =====
      // Support both old format (single legalEntity/department) and new format (legalEntityMappings array)
      let employmentInfoUpdate = { ...employe.employmentInformation };
      let legalEntityMappingsUpdate = [];

      // Case 1: New format - legalEntityMappings array exists
      if (employe.employmentInformation?.legalEntityMappings &&
        Array.isArray(employe.employmentInformation.legalEntityMappings) &&
        employe.employmentInformation.legalEntityMappings.length > 0) {
        legalEntityMappingsUpdate = employe.employmentInformation.legalEntityMappings;

        // Also populate legacy fields from PRIMARY mapping for backward compatibility
        const primaryMapping = legalEntityMappingsUpdate.find(m => m.type === "PRIMARY");
        if (primaryMapping) {
          employmentInfoUpdate.legalEntity = primaryMapping.legalEntity;
          employmentInfoUpdate.department = primaryMapping.function;
          if (primaryMapping.designation) {
            employmentInfoUpdate.designation = primaryMapping.designation;
          }
          // Keep legacy departmentHead in sync with PRIMARY mapping's functionalHead when provided
          if (typeof primaryMapping.functionalHead === "boolean") {
            employmentInfoUpdate.departmentHead = primaryMapping.functionalHead ? "Yes" : "No";
          }
        }
      }
      // Case 2: Old format - single legalEntity/department exists
      else if (employe.employmentInformation?.legalEntity && employe.employmentInformation?.department) {
        // Convert old format to new format with PRIMARY type
        legalEntityMappingsUpdate = [{
          legalEntity: employe.employmentInformation.legalEntity,
          function: employe.employmentInformation.department,
          type: "PRIMARY"
        }];
        // Keep legacy fields as is
        employmentInfoUpdate.legalEntity = employe.employmentInformation.legalEntity;
        employmentInfoUpdate.department = employe.employmentInformation.department;
      }
      // Case 3: Check if existing employee has old format and no new data provided
      else if (employeeToUpdate.employmentInformation?.legalEntity && employeeToUpdate.employmentInformation?.department) {
        // Preserve existing legacy format
        legalEntityMappingsUpdate = [{
          legalEntity: employeeToUpdate.employmentInformation.legalEntity,
          function: employeeToUpdate.employmentInformation.department,
          type: "PRIMARY"
        }];
        employmentInfoUpdate.legalEntity = employeeToUpdate.employmentInformation.legalEntity;
        employmentInfoUpdate.department = employeeToUpdate.employmentInformation.department;
      }

      employmentInfoUpdate.legalEntityMappings = legalEntityMappingsUpdate;
      // ===== END LEGAL ENTITY & FUNCTION MAPPINGS HANDLING =====

      // Check for Functional Head conflicts
      if (legalEntityMappingsUpdate && legalEntityMappingsUpdate.length > 0) {
        const conflictCheck = await checkFunctionalHeadConflict(
          legalEntityMappingsUpdate,
          employeeToUpdate.companyId,
          req.params.id // Exclude current employee
        );
        if (conflictCheck.conflict) {
          return res.status(400).send(failResponse({ message: conflictCheck.message }));
        }
      }

      let data = {
        personalInformation: employe.personalInformation,
        contactInformation: employe.contactInformation,
        SpouseInformation: employe.SpouseInformation,
        PresentAddress: employe.PresentAddress,
        PermanentAddress: employe.PermanentAddress,
        ChildInformation: childInformation,
        employmentInformation: employmentInfoUpdate,
        candidateInformation: candidateInfo,
        resignation: employe.resignation || employeeToUpdate.resignation || {
          currentApprovalLevel: 0,
          overallStatus: "Pending",
          approvalSteps: [],
        },
        status: employe.status || employeeToUpdate.status || "Active"
      }
      //   EmployModel.findByIdAndUpdate(req.params.id, data, (err) => {
      //     if (!err) {
      //       res.status(200).send(
      //         successResponse({
      //           message: 'Employee Updated Successfully!',
      //         })
      //       );
      //     }
      //   });

      const updatedEmployee = await EmployModel.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true, runValidators: true }
      );
      console.log("updatedEmployee password", updatedEmployee.personalInformation.password, bcrypt.compareSync("Test@123", updatedEmployee.personalInformation.password));

      if (updatedEmployee) {
        if (emailWillChange) {
          try {
            const to = updatedEmployee?.contactInformation?.email;
            const name = `${updatedEmployee?.personalInformation?.firstName || ""} ${updatedEmployee?.personalInformation?.lastName || ""}`.trim() || to;
            const emailBody = {
              name: name || to,
              email: to,
              credentialsEmail: true,
              credentialsDetails: {
                loginEmail: to,
                password: plainPasswordForEmail || "Test@123",
                loginUrl: "https://vihanga.talentspotifyapp.com/auth/login",
              },
            };
             sendEmail(
              to,
              "Your login email has been updated",
              emailBody,
              true
            );
          } catch (mailErr) {
            console.error("Failed to send email-change notification:", mailErr);
          }
        }
        res.status(200).send(
          successResponse({
            message: 'Employee Updated Successfully!',
            data: updatedEmployee
          })
        );
      }
      else {
        res.status(404).send(
          failResponse({
            message: 'Employee not found after update!',
          })
        );
      }
    }
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employee Not Updated!"
      })
    );
  }
};

const changePassword = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const user = await EmployModel.findOne({ "contactInformation.email": req.body.email });

    if (!user) {
      return res.status(404).send({
        message: "User not found!",
        success: false
      });
    }

    if (!user.personalInformation.password) {
      return res.status(200).send({
        message: "For change password,You need to sign in with email & password!",
        success: false
      });
    }

    if (!bcrypt.compareSync(req.body.currentPassword, user.personalInformation.password)) {
      return res.status(401).send({
        message: "Invalid email or current password!",
        success: false
      });
    }

    // Update only the password field using findByIdAndUpdate
    const hashedNewPassword = bcrypt.hashSync(req.body.newPassword);
    await EmployModel.findByIdAndUpdate(
      user._id,
      { "personalInformation.password": hashedNewPassword },
      { new: true, runValidators: true }
    );

    res.status(200).send({
      message: "Your password change successfully!",
      success: true
    });
  } catch (err) {
    res.status(500).send({
      message: err ? err.message : "Password change failed!",
      success: false
    });
  }
};

function generateRandomNumber(n) {
  return (
    Math.floor(Math.random() * (9 * Math.pow(10, n - 1))) + Math.pow(10, n - 1)
  );
}

const forgotpassword = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const { email } = req.body;

    // Validate input
    if (!email) {
      return res.status(400).send({
        message: "Email is required",
        success: false,
      });
    }

    // Find verified user
    const user = await EmployModel.findOne({
      "contactInformation.email": email,
      "contactInformation.verified": true,
    });

    if (!user) {
      return res.status(401).send({
        message: "This email is not found or not verified!",
        success: false,
      });
    }

    // Generate reset token
    const token = generateRandomNumber(20);
    const tokenExpiry = Date.now() + 3600 * 1000; // 1 hour from now

    // Update user with reset token
    const updatedUser = await EmployModel.findOneAndUpdate(
      { "contactInformation.email": email },
      {
        $set: {
          "personalInformation.token": token,
          "personalInformation.tokenExpire": tokenExpiry,
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).send({
        message: "Failed to generate reset token",
        success: false,
      });
    }

    // Send reset email
    try {
      const resetEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Dear User,</p>
            <p>You have requested to reset your password. Please click the link below to proceed:</p>
            <p>
              <a href="${CLIENTURL}/auth/resetpassword/${token}" 
                 style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p><strong>Note:</strong> This link will expire in 1 hour for security reasons.</p>
            <p>If you did not request this password reset, please ignore this email.</p>
            <br>
            <p>Best regards,<br>Vihanga Team</p>
          </div>
        `;

      const emailResponse = await sendEmail(
        user.contactInformation.email,
        "Reset Password Link",
        resetEmailHtml,
        true,
        (html) => html
      );

      if (!emailResponse || emailResponse.success === false) {
        throw new Error(emailResponse && emailResponse.error ? emailResponse.error : "Unknown email send failure");
      }

      console.log("Password reset email sent successfully:", emailResponse);

      return res.status(200).send({
        message: "Reset link sent successfully",
        success: true,
      });

    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);

      // Optionally, you might want to remove the token if email fails
      await EmployModel.findOneAndUpdate(
        { "contactInformation.email": email },
        {
          $unset: {
            "personalInformation.token": "",
            "personalInformation.tokenExpire": "",
          }
        }
      );

      return res.status(500).send({
        message: "Failed to send reset email. Please try again later.",
        success: false,
      });
    }

  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).send({
      message: "Internal server error. Please try again later.",
      success: false,
    });
  }
};


const resetpassword = async (req, res) => {
  // #swagger.tags = ['Employee']
  const user = await EmployModel.findOne({
    "personalInformation.token": req.body.token,
    "personalInformation.tokenExpire": { $gt: Date.now() },
    "contactInformation.verified": true,
  });
  if (user) {
    const updateData = {
      "personalInformation.password": bcrypt.hashSync(req.body.password),
      "personalInformation.token": "",
      "personalInformation.tokenExpire": Date.now()
    };
    await EmployModel.findOneAndUpdate({ "personalInformation.token": user.personalInformation.token }, updateData, (err) => {
      if (!err) {
        res.send({
          message: "Password Updated Successfully",
          success: true
        });
      }
    });
  } else {
    res.status(401).send({
      message: "Invalid Token/Account Not Verified!",
      success: false
    });
  }
};

const getEmployeByHireDate = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const employe = await EmployModel.find({
      "$expr": {
        "$and": [
          { "$eq": [{ "$dayOfMonth": "$employmentInformation.hireDate" }, { "$dayOfMonth": new Date() }] },
          { "$eq": [{ "$month": "$employmentInformation.hireDate" }, { "$month": new Date() }] }
        ]
      }
    });
    res.status(200).send(
      successResponse({
        message: "Employee Retrieved Successfully!",
        data: employe,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employee Not Fetched!",
      })
    );
  }
};

const getEmployeByDateOfBirth = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const employe = await EmployModel.find({
      "$expr": {
        "$and": [
          { "$eq": [{ "$dayOfMonth": "$personalInformation.dateOfBirth" }, { "$dayOfMonth": new Date() }] },
          { "$eq": [{ "$month": "$personalInformation.dateOfBirth" }, { "$month": new Date() }] }
        ]
      }
    });
    res.status(200).send(
      successResponse({
        message: "Employee Retrieved Successfully!",
        data: employe,
      })
    );
  } catch (err) {
    res.status(500).send(
      failResponse({
        message: err ? err.message : "Employee Not Fetched!",
      })
    );
  }
};

const sendEmailToEmployee = async (req, res) => {
  // #swagger.tags = ['Employee']
  try {
    const { companyId } = req.params;
    // Use static template defaults; do not depend on request body
    const subject = "Your Vihanga Credentials";
    const message = "Welcome to Vihanga HR application. Please find your login credentials below.";
    const resetPasswords = true;

    if (!companyId) {
      return res.status(400).send(failResponse({ message: "companyId is required" }));
    }

    // Fetch active employees in the company
    const employees = await EmployModel.find({ companyId, "employmentInformation.status": "Active" }, {
      _id: 1,
      companyId: 1,
      "personalInformation.firstName": 1,
      "personalInformation.lastName": 1,
      "personalInformation.password": 1,
      "contactInformation.email": 1,
      "contactInformation.loginMethod": 1
    });

    if (!employees || employees.length === 0) {
      return res.status(404).send(failResponse({ message: "No active employees found for this company" }));
    }

    // Prepare updates and emails
    const results = [];
    const passwordUpdates = [];
    const sendTasks = [];

    // Utility to generate random strong-ish password
    const generatePassword = () => {
      const base = Math.random().toString(36).slice(-8);
      return `${base[0].toUpperCase()}${base.slice(1)}@${Math.floor(1000 + Math.random() * 9000)}`;
    };

    for (const emp of employees) {
      const email = emp && emp.contactInformation && emp.contactInformation.email;
      if (!email) continue;

      let plainPasswordToSend = undefined;

      if (resetPasswords) {
        const fixedPlain = "Test@123";
        plainPasswordToSend = fixedPlain;
        const fixedHashed = bcrypt.hashSync(fixedPlain);
        passwordUpdates.push(
          EmployModel.updateOne(
            { _id: emp._id },
            { $set: { "personalInformation.password": fixedHashed } }
          )
        );
      }

      const name = `${emp?.personalInformation?.firstName || ""} ${emp?.personalInformation?.lastName || ""}`.trim();

      // Build email body for credentials template
      const emailBody = {
        name: name || email,
        testLink: "",
        email,
        id: String(emp._id),
        credentialsEmail: true,
        credentialsDetails: {
          loginEmail: email,
          password: plainPasswordToSend,
          loginUrl: "https://vihanga.talentspotifyapp.com/auth/login",
          customMessage: message
        }
      };

      // Send email using existing utility; provide custom template to embed our html
      sendTasks.push(() =>
        sendEmail(
          email,
          subject || "Your Vihanga Credentials",
          emailBody,
          true
        )
          .then((resp) => {
            results.push({ email, success: resp && resp.success !== false, error: resp && resp.error });
          })
          .catch((e) => {
            results.push({ email, success: false, error: e && e.message });
          })
      );
    }

    // Execute password updates first (not constrained by SMTP limits)
    if (passwordUpdates.length > 0) {
      await Promise.allSettled(passwordUpdates);
    }

    // Throttle SMTP sends to avoid concurrent connection limits
    const BATCH_SIZE = 3; // conservative concurrency to respect provider limits
    const SLEEP_MS = 250; // small delay between batches
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    for (let i = 0; i < sendTasks.length; i += BATCH_SIZE) {
      const batch = sendTasks.slice(i, i + BATCH_SIZE).map((fn) => fn());
      await Promise.allSettled(batch);
      if (i + BATCH_SIZE < sendTasks.length) {
        await sleep(SLEEP_MS);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failure = results.filter(r => !r.success);

    return res.status(200).send(successResponse({
      message: `Emails processed: ${successCount}/${results.length}`,
      data: {
        total: results.length,
        success: successCount,
        failed: failure.length,
        failures: failure
      }
    }));
  } catch (err) {
    return res.status(500).send(failResponse({ message: err ? err.message : "Failed to send emails" }));
  }
};

module.exports = {
  createOrUpdateMultipleemploys,
  createEmployee,
  updateEmployee,
  deleteEmployees,
  deleteEmploy,
  getEmployeesAll,
  getEmployees,
  getEmployeById,
  orgChartData,
  changePassword,
  forgotpassword,
  resetpassword,
  getEmployeByHireDate,
  getEmployeByDateOfBirth,
  sendEmailToEmployee
};
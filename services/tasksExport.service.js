const TasksModel = require("../models/tasks2.model");
const EmployModel = require("../models/employee.model");

const fetchAllTasksForExport = async ({ userId, companyId, type = "me", search = "" }) => {
  const normalizedType = (type || "me").toString().trim().toLowerCase();
  let targetUserIds = [];

  let searchQuery = {};
  if (search && search.trim()) {
    searchQuery = {
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ],
    };
  }

  const companyObj = { companyId };

  if (normalizedType === "me") {
    targetUserIds = [userId];
  } else if (normalizedType === "team" || normalizedType === "myteam") {
    const teamMembers = await EmployModel.find({
      ...companyObj,
      "employmentInformation.status": "Active",
      "employmentInformation.lineManager": userId,
    }).select("_id");
    targetUserIds = teamMembers.map((m) => m._id.toString());
  } else if (normalizedType === "function" || normalizedType === "myfunction") {
    const currentUser = await EmployModel.findOne({
      _id: userId,
      ...companyObj,
      "employmentInformation.status": "Active",
    });
    let userFunctions = [];
    if (currentUser?.employmentInformation) {
      if (currentUser.employmentInformation.department) {
        userFunctions.push(currentUser.employmentInformation.department);
      }
      if (Array.isArray(currentUser.employmentInformation.legalEntityMappings)) {
        currentUser.employmentInformation.legalEntityMappings.forEach((mapping) => {
          if (mapping.function) userFunctions.push(mapping.function);
        });
      }
    }
    userFunctions = [...new Set(userFunctions)];
    if (userFunctions.length > 0) {
      const functionMembers = await EmployModel.find({
        ...companyObj,
        "employmentInformation.status": "Active",
        $or: [
          { "employmentInformation.department": { $in: userFunctions } },
          { "employmentInformation.legalEntityMappings.function": { $in: userFunctions } },
        ],
      }).select("_id");
      targetUserIds = functionMembers.map((m) => m._id.toString());
    } else {
      targetUserIds = [userId];
    }
  } else if (normalizedType === "company" || normalizedType === "mycompany") {
    const companyEmployees = await EmployModel.find({
      companyId,
      "employmentInformation.status": "Active",
    }).select("_id");
    targetUserIds = companyEmployees.map((e) => e._id.toString());
  } else {
    targetUserIds = [userId];
  }

  if (targetUserIds.length === 0) {
    return [];
  }

  const mainTaskQuery = {
    companyId,
    assignTo: { $in: targetUserIds },
    mainTask: { $in: ["", null] },
    userId: { $exists: true },
    ...searchQuery,
  };

  const mainTasks = await TasksModel.find(mainTaskQuery).sort({ _id: -1 }).lean();
  const mainTaskIds = mainTasks.map((t) => t._id.toString());

  const subTasks =
    mainTaskIds.length > 0
      ? await TasksModel.find({
          companyId,
          assignTo: { $in: targetUserIds },
          mainTask: { $in: mainTaskIds },
          userId: { $exists: true },
        })
          .sort({ _id: -1 })
          .lean()
      : [];

  const users = await EmployModel.find({ "employmentInformation.status": "Active" }).lean();
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const getName = (id) => {
    const u = userById.get((id || "").toString());
    if (!u) return "";
    return `${u.personalInformation?.firstName || ""} ${u.personalInformation?.lastName || ""}`.trim();
  };

  const rows = [];

  mainTasks.forEach((task) => {
    rows.push({
      type: "Task",
      title: task.title || "",
      description: task.description || "",
      progress: task.progressStatus ?? "",
      status: task.status || "",
      owner: getName(task.userId),
      assignee: getName(task.assignTo?.[0]),
      dueDate: task.dueDate || "",
      startDate: task.startDate || "",
      priority: task.priority || "",
      createdAt: task.createdAt || "",
    });

    subTasks
      .filter((st) => st.mainTask === task._id.toString())
      .forEach((sub) => {
        rows.push({
          type: "Sub Task",
          title: sub.title || "",
          description: sub.description || "",
          progress: sub.progressStatus ?? "",
          status: sub.status || "",
          owner: getName(sub.userId),
          assignee: getName(sub.assignTo?.[0]),
          dueDate: sub.dueDate || "",
          startDate: sub.startDate || "",
          priority: sub.priority || "",
          createdAt: sub.createdAt || "",
        });
      });
  });

  return rows;
};

module.exports = { fetchAllTasksForExport };

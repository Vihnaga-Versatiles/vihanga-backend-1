const Theme = require("../../models/themeSetting/ThemeSettingModel");
const mongoose = require("mongoose");
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const { uploadFileToDrive } = require("../../middlewares/recruitment/drive");

const sendError = (res, status, message, extra = {}) => {
  return res.status(status).json({ success: false, message, ...extra });
};

const sendSuccess = (res, status, message, data = {}) => {
  return res.status(status).json({ success: true, message, ...data });
};

const checkAccess = (theme, userCompanyId) => {
  if (!userCompanyId) return false; // Security: Require companyId for access
  return theme.companyId.toString() === userCompanyId.toString();
};


exports.getCompanyTheme = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    const theme = await Theme.getCompanyTheme(companyId);
    if (!theme) return sendError(res, 404, "No theme found for this company");

    return sendSuccess(res, 200, "Theme fetched successfully", { data: theme });
  } catch (error) {
    console.error("getCompanyTheme error:", error);
    return sendError(res, 500, "Failed to fetch theme", { error: error.message });
  }
};

exports.getThemeById = async (req, res) => {
  try {
    const { themeId } = req.params;
    const { companyId } = req.query; 
    
    if (!isValidId(themeId)) return sendError(res, 400, "Invalid theme ID");
    
    if (!companyId) {
      return sendError(res, 400, "companyId is required in query parameters");
    }
    
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    const theme = await Theme.findOne({ 
      _id: themeId,
      companyId: companyId 
    });
    
    if (!theme) return sendError(res, 404, "Theme not found");

    if (req.user?.companyId && !checkAccess(theme, req.user.companyId)) {
      return sendError(res, 403, "Access denied");
    }

    return sendSuccess(res, 200, "Theme fetched successfully", { data: theme });
  } catch (error) {
    console.error("getThemeById error:", error);
    return sendError(res, 500, "Failed to fetch theme", { error: error.message });
  }
};

exports.getAllCompanyThemes = async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    let { page = 1, limit = 10 } = req.query;
    page = Math.max(1, Number(page));
    limit = Math.max(1, Number(limit));

    const themes = await Theme.find({ companyId })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Theme.countDocuments({ companyId });

    return sendSuccess(res, 200, "Themes fetched successfully", {
      count: themes.length,
      total,
      page,
      limit,
      data: themes,
    });
  } catch (error) {
    console.error("getAllCompanyThemes error:", error);
    return sendError(res, 500, "Failed to fetch themes", { error: error.message });
  }
};

exports.createTheme = async (req, res) => {
  try {
    const { companyId, themeName, logoUrl, primary, secondary, isDefault } = req.body;

    if (!companyId || !themeName || !primary || !secondary) {
      return sendError(res, 400, "companyId, themeName, primary, secondary are required");
    }

    if (!isValidId(companyId)) {
      return sendError(res, 400, "Invalid company ID");
    }

    if (req.user?.companyId) {
      const userCompanyId = req.user.companyId.toString();
      const requestCompanyId = companyId.toString();
      if (userCompanyId !== requestCompanyId) {
        return sendError(res, 403, "Access denied: Cannot create theme for different company");
      }
    }

    if (!primary.sectionTitle || !primary.colors?.length) {
      return sendError(res, 400, "Primary section needs a title and at least one color");
    }

    if (!secondary.sectionTitle || !secondary.colors?.length) {
      return sendError(res, 400, "Secondary section needs a title and at least one color");
    }

    const newTheme = await Theme.create({
      companyId,
      themeName,
      logoUrl: logoUrl ?? null,
      primary,
      secondary,
      isDefault: Boolean(isDefault),
      updatedBy: req.user?._id || null,
    });

    return sendSuccess(res, 201, "Theme created successfully", { data: newTheme });
  } catch (error) {
    console.error("createTheme error:", error);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return sendError(res, 400, "Validation error", { errors: messages });
    }

    return sendError(res, 500, "Failed to create theme", { error: error.message });
  }
};

exports.updateTheme = async (req, res) => {
  try {
    const { themeId } = req.params;
    const { companyId } = req.query; 
    
    if (!isValidId(themeId)) return sendError(res, 400, "Invalid theme ID");
    
    if (!companyId) {
      return sendError(res, 400, "companyId is required in query parameters");
    }
    
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    const theme = await Theme.findOne({ 
      _id: themeId,
      companyId: companyId 
    });
    
    if (!theme) return sendError(res, 404, "Theme not found");

    // Additional access check if user is authenticated
    if (req.user?.companyId && !checkAccess(theme, req.user.companyId)) {
      return sendError(res, 403, "Access denied");
    }

    const allowedFields = ["themeName", "logoUrl", "primary", "secondary", "isDefault"];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) theme[field] = req.body[field];
    });

    if (req.user?._id) theme.updatedBy = req.user._id;

    await theme.save();

    return sendSuccess(res, 200, "Theme updated successfully", { data: theme });
  } catch (error) {
    console.error("updateTheme error:", error);

    if (error.name === "ValidationError") {
      return sendError(res, 400, "Validation error", {
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    return sendError(res, 500, "Failed to update theme", { error: error.message });
  }
};

exports.deleteTheme = async (req, res) => {
  try {
    const { themeId } = req.params;
    const { companyId } = req.query; 
    if (!isValidId(themeId)) return sendError(res, 400, "Invalid theme ID");
    
    if (!companyId) {
      return sendError(res, 400, "companyId is required in query parameters");
    }
    
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    const theme = await Theme.findOne({ 
      _id: themeId,
      companyId: companyId 
    });
    
    if (!theme) return sendError(res, 404, "Theme not found");

    // Additional access check if user is authenticated
    if (req.user?.companyId && !checkAccess(theme, req.user.companyId)) {
      return sendError(res, 403, "Access denied");
    }

    if (theme.isDefault) {
      return sendError(res, 400, "Cannot delete the default theme");
    }

    await theme.deleteOne();

    return sendSuccess(res, 200, "Theme deleted successfully");
  } catch (error) {
    console.error("deleteTheme error:", error);
    return sendError(res, 500, "Failed to delete theme", { error: error.message });
  }
};

exports.setDefaultTheme = async (req, res) => {
  try {
    const { themeId } = req.params;
    const { companyId } = req.query; 
    if (!isValidId(themeId)) return sendError(res, 400, "Invalid theme ID");
    
    if (!companyId) {
      return sendError(res, 400, "companyId is required in query parameters");
    }
    
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    const theme = await Theme.findOne({ 
      _id: themeId,
      companyId: companyId 
    });
    
    if (!theme) return sendError(res, 404, "Theme not found");

    // Additional access check if user is authenticated
    if (req.user?.companyId && !checkAccess(theme, req.user.companyId)) {
      return sendError(res, 403, "Access denied");
    }

    theme.isDefault = true;
    if (req.user?._id) theme.updatedBy = req.user._id;

    await theme.save();

    return sendSuccess(res, 200, "Default theme set successfully", { data: theme });
  } catch (error) {
    console.error("setDefaultTheme error:", error);
    return sendError(res, 500, "Failed to set default theme", { error: error.message });
  }
};

exports.updateThemeColor = async (req, res) => {
  try {
    const { themeId } = req.params;
    const { section, colorName, newCode, companyId } = req.body; 

    if (!section || !colorName || !newCode) {
      return sendError(res, 400, "section, colorName, newCode are required");
    }

    if (!["primary", "secondary"].includes(section)) {
      return sendError(res, 400, "section must be 'primary' or 'secondary'");
    }

    if (!isValidId(themeId)) return sendError(res, 400, "Invalid theme ID");
    
    if (!companyId) {
      return sendError(res, 400, "companyId is required");
    }
    
    if (!isValidId(companyId)) return sendError(res, 400, "Invalid company ID");

    const theme = await Theme.findOne({ 
      _id: themeId,
      companyId: companyId 
    });
    
    if (!theme) return sendError(res, 404, "Theme not found");

    // Additional access check if user is authenticated
    if (req.user?.companyId && !checkAccess(theme, req.user.companyId)) {
      return sendError(res, 403, "Access denied");
    }

    const idx = theme[section].colors.findIndex(
      (c) => c.name.toLowerCase() === colorName.toLowerCase()
    );

    if (idx === -1) {
      return sendError(res, 404, `Color '${colorName}' not found in ${section}`);
    }

    theme[section].colors[idx].code = newCode.toUpperCase();
    if (req.user?._id) theme.updatedBy = req.user._id;

    await theme.save();

    return sendSuccess(res, 200, "Color updated successfully", { data: theme });
  } catch (error) {
    console.error("updateThemeColor error:", error);

    if (error.name === "ValidationError") {
      return sendError(res, 400, "Invalid color format");
    }

    return sendError(res, 500, "Failed to update color", { error: error.message });
  }
};

// Upload theme logo to S3 and return URL
exports.uploadThemeLogo = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return sendError(res, 400, "No logo file uploaded");
    }
    const companyId = req.body?.companyId || "unknown";
    const ts = Date.now();
    const safeExt = (file.originalname || "").split(".").pop() || "png";
    const nameBase = (file.originalname || "logo").split(".")[0].replace(/[^\w-]/g, "_");
    const fileName = `theme_${companyId}_${nameBase}_${ts}.${safeExt}`;

    const uploaded = await uploadFileToDrive(file.buffer, fileName, file.mimetype, "theme-logos");

    return sendSuccess(res, 201, "Logo uploaded successfully", {
      url: uploaded.url,
      key: uploaded.key,
    });
  } catch (error) {
    console.error("uploadThemeLogo error:", error);
    return sendError(res, 500, "Failed to upload logo", { error: error.message });
  }
};
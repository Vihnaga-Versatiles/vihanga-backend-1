const AssetsManagementModel = require("../../models/assetsManagementSystem/AssetsManagementSystem");


const createAsset = async (req, res) => {
  try {
    console.log("Received body:", req.body);

    const { companyId, fullName, department, workLocation, employeeId, position, assets } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "CompanyId is required" });
    }

    const asset = new AssetsManagementModel({
      companyId,
      fullName,
      department,
      workLocation,
      employeeId,
      position,
      assets
    });

    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    console.log("this is an error:", error);
    res.status(500).json({ message: "server error", error: error.message });
  }
};

const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

const getAsset = async (req, res) => {
  try {
    const { companyId, search } = req.query;

    if (!companyId) {
      return res.status(400).json({ message: "CompanyId is required" });
    }

    let query = { companyId };

    if (search) {
      const safeSearch = escapeRegex(search);
      const searchRegex = new RegExp(safeSearch, "i");
      query.$or = [
        { fullName: searchRegex },
        { employeeId: searchRegex },
        { department: searchRegex },
        { position: searchRegex },
        { "assets.assetType": searchRegex },
        { "assets.assetNumber": searchRegex },
      ];
    }

    const assets = await AssetsManagementModel.find(query);
    res.status(200).json(assets);
  } catch (error) {
    console.log("there is an error:", error);
    res.status(500).json({ message: "server error" });
  }
};


const singleAsset = async (req, res) => {
  try {
    const { companyId } = req.query;
    const assetId = req.params.id;

    if (!companyId) {
      return res.status(400).json({ message: "CompanyId is required" });
    }

    const asset = await AssetsManagementModel.findOne({ _id: assetId, companyId });
    if (!asset) {
      return res.status(404).json({ message: "asset not found" });
    }
    res.status(200).json(asset);
  } catch (error) {
    console.log("there is aan error:", error);
    res.status(500).json({ message: "server error" });
  }
}


const updateAsset = async (req, res) => {
  try {
    const documentId = req.params.id;
    const { companyId } = req.query;

    if (!documentId) {
      return res.status(400).json({ message: "Missing document ID" });
    }

    if (!companyId) {
      return res.status(400).json({ message: "CompanyId is required" });
    }

    const { _id, ...updateData } = req.body;

    const updatedAsset = await AssetsManagementModel.findOneAndUpdate(
      { _id: documentId, companyId: companyId },
      updateData,
      { new: true }
    );

    if (!updatedAsset) {
      return res.status(404).json({ message: "Asset record not found for the given ID and company" });
    }

    res.status(200).json({
      message: "Asset updated successfully",
      updatedAsset,
    });
  } catch (error) {
    console.error("Error updating asset:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


const deleteAsset = async (req, res) => {
  const assetId = req.params.id;
  const { companyId } = req.query;

  try {
    if (!companyId) {
      return res.status(400).json({ message: "CompanyId is required" });
    }

    // Find the employee that owns this asset within the specified company
    const employee = await AssetsManagementModel.findOne({
      "assets._id": assetId,
      companyId: companyId
    });

    if (!employee) {
      return res.status(404).json({ message: "Asset not found in the specified company" });
    }

    // Remove the asset from the assets array
    employee.assets = employee.assets.filter(asset => asset._id.toString() !== assetId);

    // Save the updated employee
    await employee.save();

    res.status(200).json({ message: "Asset deleted successfully" });
  } catch (error) {
    console.error("There is an error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Additional helper function to get assets by employee ID within a company
const getAssetsByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { companyId } = req.query;

    if (!companyId) {
      return res.status(400).json({ message: "CompanyId is required" });
    }

    const employee = await AssetsManagementModel.findOne({
      employeeId: employeeId,
      companyId: companyId
    });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found in the specified company" });
    }

    res.status(200).json({
      employee: {
        fullName: employee.fullName,
        department: employee.department,
        workLocation: employee.workLocation,
        employeeId: employee.employeeId,
        position: employee.position,
        companyId: employee.companyId
      },
      assets: employee.assets
    });
  } catch (error) {
    console.error("Error fetching employee assets:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { createAsset, getAsset, singleAsset, updateAsset, deleteAsset, getAssetsByEmployee };

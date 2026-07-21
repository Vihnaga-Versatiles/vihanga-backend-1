const express = require('express')

const router = express.Router()

const assetsManagementController = require("../../controllers/assetsManagement/assetsManagementController")

const assetsManagementSystem = require('../../models/assetsManagementSystem/AssetsManagementSystem')




// get ,post , put/patch,delete


router.post('/add-asset',assetsManagementController.createAsset)
router.get('/allAssets',assetsManagementController.getAsset)
router.get('/asset/:id',assetsManagementController.singleAsset)
router.put("/updateAsset/:id", assetsManagementController.updateAsset);

router.delete("/delete/:id", assetsManagementController.deleteAsset);

// New route to get assets by employee ID within a company
router.get('/employee/:employeeId/assets', assetsManagementController.getAssetsByEmployee);

router.get("/asset/test", (req, res) => {
    res.send("Hello, API is working!");
  });


module.exports = router
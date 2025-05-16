const express = require("express");
const router = express.Router();
const challanController = require("../controller/chalan.controller");
const { auth} = require("../middleware/auth");

// Apply authentication middleware to all routes
router.use(auth);


// Create a new challan
router.post("/create", challanController.createChallan);

// Get all challans
router.get("/", challanController.getAllChallans);

// Get challan by ID
router.get("/:id", challanController.getChallanById);

// Get challans by order ID
router.get("/order/:orderId", challanController.getChallansByOrderId);

// Download challan as PDF
router.get("/download/:id", challanController.downloadChallan);

router.get("/preview/:id", challanController.previewChallan);

// Download challan as PDF
router.put("/update/:id", challanController.updateChallan);

module.exports = router;


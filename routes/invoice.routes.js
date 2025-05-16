const express = require("express");
const router = express.Router();
const invoiceController = require("../controller/invoice.controller");
const { auth} = require("../middleware/auth");


router.use(auth);
router.post("/create", invoiceController.createInvoice);
router.get("/", invoiceController.getAllInvoices);
router.get("/:id", invoiceController.getInvoiceById);
router.get("/order/:orderId", invoiceController.getInvoicesByOrderId);
router.get("/download/:id", invoiceController.downloadInvoice);
router.get("/preview/:id", invoiceController.previewInvoice);
router.put("/edit/:id", invoiceController.editInvoice);
router.delete('/:id',  invoiceController.deleteInvoice);

module.exports = router;
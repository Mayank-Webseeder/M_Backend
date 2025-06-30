// const express= require("express");
// const router = express.Router();

// const {auth,isGraphics, isSuperAdmin} = require("../middleware/auth");

// const {galleryController}= require("../controller/gallery.controller");


// router.get("",auth,isGraphics,graphicsController);

// module.exports= router


const express = require("express");
const router = express.Router();

const { auth, isGraphics, isSuperAdmin } = require("../middleware/auth");
const {
  getAllGalleryItems,
  getGalleryByOrder,
  updateGalleryItem,
  archiveGalleryItem,
  getGalleryStats
} = require("../controller/gallery.controller");

router.get("/", auth,  getAllGalleryItems);
router.get("/stats", auth, getGalleryStats);
router.get("/order/:orderId", auth, getGalleryByOrder);
router.put("/:id", auth,  updateGalleryItem);
router.delete("/:id", auth,  archiveGalleryItem);

module.exports = router;
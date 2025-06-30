const Gallery = require("../models/Gallery");
const Order = require("../models/order.model");

// Get all gallery items
exports.getAllGalleryItems = async (req, res) => {
  try {
    const { page = 1, limit = 20, orderId, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { isActive: true };
    
    if (orderId) {
      query.orderId = orderId;
    }
    
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { cadFileName: { $regex: search, $options: 'i' } },
        { imageName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const galleryItems = await Gallery.find(query)
      .populate('order', 'orderId customerName requirements')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Gallery.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: galleryItems,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching gallery items:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching gallery items",
      error: error.message
    });
  }
};

// Get gallery items by order
exports.getGalleryByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const galleryItems = await Gallery.find({ 
      $or: [
        { orderId: orderId },
        { order: orderId }
      ],
      isActive: true 
    })
      .populate('order', 'orderId customerName requirements')
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: galleryItems,
      count: galleryItems.length
    });

  } catch (error) {
    console.error("Error fetching gallery items by order:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching gallery items",
      error: error.message
    });
  }
};

// Update gallery item (add description, tags, etc.)
exports.updateGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, tags } = req.body;

    const galleryItem = await Gallery.findByIdAndUpdate(
      id,
      { 
        description,
        tags: tags || [],
        updatedAt: new Date()
      },
      { new: true }
    ).populate('order', 'orderId customerName');

    if (!galleryItem) {
      return res.status(404).json({
        success: false,
        message: "Gallery item not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Gallery item updated successfully",
      data: galleryItem
    });

  } catch (error) {
    console.error("Error updating gallery item:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating gallery item",
      error: error.message
    });
  }
};

// Soft delete gallery item (set isActive to false)
exports.archiveGalleryItem = async (req, res) => {
  try {
    const { id } = req.params;

    const galleryItem = await Gallery.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!galleryItem) {
      return res.status(404).json({
        success: false,
        message: "Gallery item not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Gallery item archived successfully",
      data: galleryItem
    });

  } catch (error) {
    console.error("Error archiving gallery item:", error);
    return res.status(500).json({
      success: false,
      message: "Error archiving gallery item",
      error: error.message
    });
  }
};

// Get gallery statistics
exports.getGalleryStats = async (req, res) => {
  try {
    const totalItems = await Gallery.countDocuments({ isActive: true });
    const totalOrders = await Gallery.distinct('orderId', { isActive: true });
    
    const recentItems = await Gallery.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('order', 'orderId customerName');

    const stats = {
      totalItems,
      totalOrders: totalOrders.length,
      recentItems
    };

    return res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error("Error fetching gallery stats:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching gallery statistics",
      error: error.message
    });
  }
};
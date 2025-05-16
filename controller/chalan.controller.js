// const Challan = require("../models/Chalan.model");
// const Order = require("../models/order.model");
// const PDFDocument = require("pdfkit");

// // Company details
// const COMPANY_DETAILS = {
//   name: "BLUE STAR COMMUNICATION",
//   street: "21 Agarbatti Complex Sec A Sewer Road",
//   city: "Indore",
//   state: "MADHYA PRADESH",
//   contact: "7415 442 057"
// };

// // Create new challan
// exports.createChallan = async (req, res) => {
//   try {
//     const { 
//       orderId, 
//       transporterName, 
//       transporterContact, 
//       transporterAddress,
//       materialQuantity,
//       squareFeet,
//       weightInKg,
//       bundles
//     } = req.body;

//     // Find order and validate it exists
//     const order = await Order.findById(orderId).populate({
//       path: "customer",
//       populate: { path: "address" }
//     });

//     if (!order) {
//       return res.status(404).json({
//         success: false,
//         message: "Order not found"
//       });
//     }

//     // Create challan object
//     const newChallan = new Challan({
//       order: orderId,
//       transporterName,
//       transporterContact,
//       transporterAddress,
//       materialQuantity,
//       squareFeet,
//       weightInKg,
//       bundles,
//       createdBy: req.user ? req.user._id : null
//     });

//     // Save challan
//     const savedChallan = await newChallan.save();

//     res.status(201).json({
//       success: true,
//       data: savedChallan,
//       message: "Challan created successfully"
//     });

//   } catch (error) {
//     console.error("Error creating challan:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error creating challan",
//       error: error.message
//     });
//   }
// };

// // Get all challans
// exports.getAllChallans = async (req, res) => {
//   try {
//     const challans = await Challan.find()
//       .populate("order")
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       data: challans
//     });
//   } catch (error) {
//     console.error("Error fetching challans:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching challans",
//       error: error.message
//     });
//   }
// };

// // Get challan by ID
// exports.getChallanById = async (req, res) => {
//   try {
//     const challan = await Challan.findById(req.params.id)
//       .populate("order");

//     if (!challan) {
//       return res.status(404).json({
//         success: false,
//         message: "Challan not found"
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: challan
//     });
//   } catch (error) {
//     console.error("Error fetching challan:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching challan",
//       error: error.message
//     });
//   }
// };

// // Get challans by order ID
// exports.getChallansByOrderId = async (req, res) => {
//   try {
//     const challans = await Challan.find({ order: req.params.orderId })
//       .populate("order")
//       .sort({ createdAt: -1 });

//     res.status(200).json({
//       success: true,
//       data: challans
//     });
//   } catch (error) {
//     console.error("Error fetching challans:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error fetching challans",
//       error: error.message
//     });
//   }
// };

// // Download challan as PDF
// exports.downloadChallan = async (req, res) => {
//   try {
//     const challan = await Challan.findById(req.params.id)
//       .populate({
//         path: "order",
//         populate: {
//           path: "customer",
//           populate: { path: "address" }
//         }
//       });

//     if (!challan) {
//       return res.status(404).json({
//         success: false,
//         message: "Challan not found"
//       });
//     }

//     // Create a PDF document
//     const doc = new PDFDocument({ margin: 50 });

//     // Set response headers for PDF download
//     res.setHeader('Content-Type', 'application/pdf');
//     res.setHeader('Content-Disposition', `attachment; filename=challan-${challan.challanNumber}.pdf`);

//     // Pipe the PDF document to the response
//     doc.pipe(res);

//     // Generate PDF content
//     generateChallanPDF(doc, challan);

//     // Finalize the PDF and end the stream
//     doc.end();

//   } catch (error) {
//     console.error("Error downloading challan:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error downloading challan",
//       error: error.message
//     });
//   }
// };

// // Helper function to generate challan PDF
// function generateChallanPDF(doc, challan) {
//   // Set font
//   doc.font('Helvetica');

//   // Add header
//   doc.fontSize(18)
//     .text('DELIVERY CHALLAN', { align: 'center' })
//     .moveDown();

//   // Add company details
//   doc.fontSize(12)
//     .text(COMPANY_DETAILS.name, { align: 'center' })
//     .text(COMPANY_DETAILS.street, { align: 'center' })
//     .text(`${COMPANY_DETAILS.city}, ${COMPANY_DETAILS.state}`, { align: 'center' })
//     .text(`Contact: ${COMPANY_DETAILS.contact}`, { align: 'center' })
//     .moveDown();

//   // Add challan details
//   doc.fontSize(10)
//     .text(`Challan No: ${challan.challanNumber}`)
//     .text(`Date: ${new Date(challan.createdAt).toLocaleDateString()}`)
//     .moveDown();

//   // Add customer details
//   doc.text('To:')
//     .text(challan.order.customer.name)
//     .text(challan.order.customer.address.street)
//     .text(`${challan.order.customer.address.city}, ${challan.order.customer.address.state}`)
//     .text(`Pin: ${challan.order.customer.address.pincode}`)
//     .moveDown();

//   // Add transporter details
//   doc.text('Transporter Details:')
//     .text(`Name: ${challan.transporterName}`)
//     .text(`Contact: ${challan.transporterContact}`)
//     .text(`Address: ${challan.transporterAddress}`)
//     .moveDown();

//   // Add material details
//   doc.text('Material Details:')
//     .text(`Material Quantity: ${challan.materialQuantity}`)
//     .text(`Square Feet (SQFT): ${challan.squareFeet}`)
//     .text(`Weight (KG): ${challan.weightInKg}`)
//     .text(`Bundles: ${challan.bundles}`)
//     .moveDown();

//   // Add signature sections
//   doc.moveDown(4)
//     .text('Authorized Signatory', { align: 'left' })
//     .text('Receiver\'s Signature', { align: 'right' });
// }

// module.exports = exports;

const Challan = require("../models/Chalan.model");
const Order = require("../models/order.model");
const PDFDocument = require("pdfkit");
const path = require("path");

// Company details
const COMPANY_DETAILS = {
  name: "BLUE STAR COMMUNICATION",
  street: "21 Agarbatti Complex Sec A Sewer Road",
  city: "Indore",
  state: "MADHYA PRADESH",
  contact: "7415 442 057"
};

// Create new challan
exports.createChallan = async (req, res) => {
  try {
    const {
      orderId,
      transporterName,
      transporterContact,
      transporterAddress,
      materialQuantity,
      squareFeet,
      weightInKg,
      bundles
    } = req.body;

    // Find order and validate it exists
    const order = await Order.findById(orderId).populate({
      path: "customer",
      populate: { path: "address" }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Create challan object
    const newChallan = new Challan({
      order: orderId,
      transporterName,
      transporterContact,
      transporterAddress,
      materialQuantity,
      squareFeet,
      weightInKg,
      bundles,
      createdBy: req.user ? req.user._id : null
    });

    // Save challan
    const savedChallan = await newChallan.save();

    res.status(201).json({
      success: true,
      data: savedChallan,
      message: "Challan created successfully"
    });

  } catch (error) {
    console.error("Error creating challan:", error);
    res.status(500).json({
      success: false,
      message: "Error creating challan",
      error: error.message
    });
  }
};

// Update challan
exports.updateChallan = async (req, res) => {
  try {
    const {
      transporterName,
      transporterContact,
      transporterAddress,
      materialQuantity,
      squareFeet,
      weightInKg,
      bundles
    } = req.body;

    const challanId = req.params.id;

    // Find challan and validate it exists
    const challan = await Challan.findById(challanId);

    if (!challan) {
      return res.status(404).json({
        success: false,
        message: "Challan not found"
      });
    }

    // Update challan fields
    challan.transporterName = transporterName || challan.transporterName;
    challan.transporterContact = transporterContact || challan.transporterContact;
    challan.transporterAddress = transporterAddress || challan.transporterAddress;
    challan.materialQuantity = materialQuantity || challan.materialQuantity;
    challan.squareFeet = squareFeet || challan.squareFeet;
    challan.weightInKg = weightInKg || challan.weightInKg;
    challan.bundles = bundles || challan.bundles;
    challan.updatedBy = req.user ? req.user._id : null;
    challan.updatedAt = Date.now();

    // Save updated challan
    const updatedChallan = await challan.save();

    res.status(200).json({
      success: true,
      data: updatedChallan,
      message: "Challan updated successfully"
    });

  } catch (error) {
    console.error("Error updating challan:", error);
    res.status(500).json({
      success: false,
      message: "Error updating challan",
      error: error.message
    });
  }
};

// Get all challans
exports.getAllChallans = async (req, res) => {
  try {
    const challans = await Challan.find()
      .populate("order")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: challans
    });
  } catch (error) {
    console.error("Error fetching challans:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching challans",
      error: error.message
    });
  }
};

// Get challan by ID
exports.getChallanById = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id)
      .populate("order");

    if (!challan) {
      return res.status(404).json({
        success: false,
        message: "Challan not found"
      });
    }

    res.status(200).json({
      success: true,
      data: challan
    });
  } catch (error) {
    console.error("Error fetching challan:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching challan",
      error: error.message
    });
  }
};

// Get challans by order ID
exports.getChallansByOrderId = async (req, res) => {
  try {
    const challans = await Challan.find({ order: req.params.orderId })
      .populate("order")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: challans
    });
  } catch (error) {
    console.error("Error fetching challans:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching challans",
      error: error.message
    });
  }
};

// Preview challan as PDF
exports.previewChallan = async (req, res) => {
  try {
    console.log("Previewing challan with ID:", req.params.id);

    const challan = await Challan.findById(req.params.id)
      .populate({
        path: "order",
        populate: {
          path: "customer",
          populate: { path: "address" }
        }
      });

    if (!challan) {
      return res.status(404).json({
        success: false,
        message: "Challan not found"
      });
    }

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for inline viewing (not download)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=challan-preview-${challan.challanNumber}.pdf`);

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Generate PDF content using the same function as download
    generateChallanPDF(doc, challan);

    // Finalize the PDF and end the stream
    doc.end();

  } catch (error) {
    console.error("Error previewing challan:", error);
    res.status(500).json({
      success: false,
      message: "Error previewing challan",
      error: error.message
    });
  }
};

// Download challan as PDF
exports.downloadChallan = async (req, res) => {
  try {
    const challan = await Challan.findById(req.params.id)
      .populate({
        path: "order",
        populate: {
          path: "customer",
          populate: { path: "address" }
        }
      });

    if (!challan) {
      return res.status(404).json({
        success: false,
        message: "Challan not found"
      });
    }

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=challan-${challan.challanNumber}.pdf`);

    // Pipe the PDF document to the response
    doc.pipe(res);

    // Generate PDF content
    generateChallanPDF(doc, challan);

    // Finalize the PDF and end the stream
    doc.end();

  } catch (error) {
    console.error("Error downloading challan:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading challan",
      error: error.message
    });
  }
};


// function generateChallanPDF(doc, challan) {
//   const logoPath = path.resolve(__dirname, '../../M_Frontend/public/logo.png');
//   doc.font('Helvetica');

//   // Add logo centered
//   // try {
//   //   const pageWidth = doc.page.width;
//   //   const logoWidth = 150;
//   //   const x = (pageWidth - logoWidth) / 2;


//   //   doc.image(logoPath, x, doc.y, {
//   //     fit: [logoWidth, 80],
//   //   });

//   //   // doc.image(logoPath, x, doc.y, {
//   //   //   fit: [logoWidth, 80],
//   //   // });

//   //   // Set cursor position explicitly below the logo height + padding
//   //   doc.y += 90; // 80px for logo + 10px extra padding
//   // } catch (error) {
//   //   console.error("Error loading logo image:", error);
//   // }

//   doc.moveDown(1);

//   // Delivery Challan Title
//   doc.fontSize(20)
//     .font('Helvetica-Bold')
//     .text('DELIVERY CHALLAN', { align: 'center' })
//     .moveDown(0.5);

//   // Company Details
//   // doc.fontSize(12)
//   //   .font('Helvetica')
//   //   .text(COMPANY_DETAILS.name, { align: 'center' })
//   //   .text(COMPANY_DETAILS.street, { align: 'center' })
//   //   .text(`${COMPANY_DETAILS.city}, ${COMPANY_DETAILS.state}`, { align: 'center' })
//   //   .text(`Contact: ${COMPANY_DETAILS.contact}`, { align: 'center' })
//   //   .moveDown();

//   // Horizontal Line
//   doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
//   doc.moveDown(0.8);
//   doc.y += 30;
//   // Challan Info
//   doc.fontSize(11)
//     .font('Helvetica-Bold')
//     .text(`Challan No:`, 50, doc.y)
//     .font('Helvetica')
//     .text(`${challan.challanNumber}`, 150, doc.y - 15)
//     .moveDown();

//   doc.font('Helvetica-Bold')
//     .text(`Date:`, 50, doc.y)
//     .font('Helvetica')
//     .text(`${new Date(challan.createdAt).toLocaleDateString()}`, 150, doc.y - 15)
//     .moveDown(1);

//   // Transporter Details
//   doc.fontSize(11)
//     .font('Helvetica-Bold')
//     .text('Transporter Details:', { underline: true })
//     .moveDown(0.3);

//   doc.font('Helvetica')
//     .text(`Name: ${challan.transporterName}`)
//     .text(`Contact: ${challan.transporterContact}`)
//     .text(`Address: ${challan.transporterAddress}`)
//     .moveDown();

//   // Material Details
//   doc.fontSize(11)
//     .font('Helvetica-Bold')
//     .text('Material Details:', { underline: true })
//     .moveDown(0.3);

//   doc.font('Helvetica')
//     .text(`Material Quantity: ${challan.materialQuantity}`)
//     .text(`Square Feet (SQFT): ${challan.squareFeet}`)
//     .text(`Weight (KG): ${challan.weightInKg}`)
//     .text(`Bundles: ${challan.bundles}`)
//     .moveDown();

//   // Material Details
//   doc.fontSize(11)
//     .font('Helvetica-Bold')
//     .text('Mahesh Tank -7415 442 057', { underline: true })
//     .moveDown(0.3);


//   // Signature Section
//   doc.moveDown(3);
//   doc.y += 280;

//   const signY = doc.y;
//   doc.fontSize(11)
//     .font('Helvetica-Bold')
//     .text('Authorized Signatory', 50, signY);

//   doc.text("Receiver's Signature", doc.page.width - 180, signY);

//   // Bottom Border Line
//   doc.moveTo(50, doc.page.height - 50).lineTo(doc.page.width - 50, doc.page.height - 50).stroke();
// }

function generateChallanPDF(doc, challan) {
  const logoPath = path.resolve(__dirname, '../../M_Frontend/public/logo.png');
  doc.font('Helvetica');

  // --- Title ---
  doc.fontSize(16) // Slightly bigger title
    .font('Helvetica-Bold')
    .text('DELIVERY CHALLAN', { align: 'center' });

  // --- Horizontal Line ---
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
  doc.moveDown(0.7);

  // --- Challan Info ---
  doc.fontSize(11)
    .font('Helvetica-Bold')
    .text(`Challan No:`, 50, doc.y)
    .font('Helvetica')
    .text(`${challan.challanNumber}`, 130, doc.y - 13);

  doc.font('Helvetica-Bold')
    .text(`Date:`, 50, doc.y + 4)
    .font('Helvetica')
    .text(`${new Date(challan.createdAt).toLocaleDateString()}`, 130, doc.y - 13);

  doc.moveDown(0.8);

  // --- Transporter Details ---
  doc.font('Helvetica-Bold')
    .text('Transporter Details:', { underline: true });
  doc.moveDown(0.3);

  doc.font('Helvetica')
    .text(`Name: ${challan.transporterName}`)
    .text(`Contact: ${challan.transporterContact}`)
    .text(`Address: ${challan.transporterAddress}`);

  doc.moveDown(0.8);

  // --- Material Details ---
  doc.font('Helvetica-Bold')
    .text('Material Details:', { underline: true });
  doc.moveDown(0.3);

  doc.font('Helvetica')
    .text(`Material Quantity: ${challan.materialQuantity}`)
    .text(`Square Feet (SQFT): ${challan.squareFeet}`)
    .text(`Weight (KG): ${challan.weightInKg}`)
    .text(`Bundles: ${challan.bundles}`);

  doc.moveDown(0.8);

  // --- Custom Footer Line ---
  doc.font('Helvetica-Bold')
    .text('Mahesh Tank - 7415 442 057', { underline: true });

  // --- Signatures ---
  doc.moveDown(2.5); // Add spacing to push this lower
  const signY = doc.y;
  doc.font('Helvetica-Bold')
    .text('Authorized Signatory', 50, signY);

  doc.text("Receiver's Signature", doc.page.width - 180, signY);

  // --- Bottom Border Line ---
  doc.moveTo(50, doc.page.height - 50).lineTo(doc.page.width - 50, doc.page.height - 50).stroke();
}

module.exports = exports;
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Order = require('../models/order.model');
const Cad = require("../models/cad.model");
const WorkQueue = require('../models/workQueueItem.model');
const User = require('../models/user.models');
const { localFileUpload } = require("../utils/ImageUploader");
const Agenda = require('agenda');
const dotenv = require("dotenv");
const moment = require('moment-timezone'); // To format date & time
dotenv.config();
const { getSockets } = require("../lib/helper.js");
const { assignOrderToCutOut } = require("./autoCutout.controller.js");
const Log = require("../models/log.model")

const Customer = require("../models/customer.model");

const Address = require("../models/Address.model")

const agenda = new Agenda({ db: { address: process.env.MONGODB_URL } });

const { changeStatus } = require("../service/websocketStatus");
const notification = require("../models/notification.model");

exports.graphicsController = async (req, res) => {
  console.log("this is route for graphics controller")
}

// Helper function to find and assign an available Graphics user
async function findAvailableGraphicsUser() {
  console.log("findiing available graphics user");
  try {
    const graphicsUsers = await User.aggregate([
      {
        $match: {
          accountType: 'Graphics',
          isActive: true
        }
      },
      {
        $lookup: {
          from: 'workqueues',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$assignedTo', '$$userId'] },
                    { $in: ['$status', ['graphics_pending', 'InProgress']] }
                  ]
                }
              }
            }
          ],
          as: 'activeOrders'
        }
      },
      {
        $addFields: {
          activeOrderCount: { $size: '$activeOrders' }
        }
      },
      { $sort: { activeOrderCount: 1 } }
    ]);

    return graphicsUsers.length > 0 ? graphicsUsers[0] : null;
  } catch (error) {
    console.error('Error finding available Graphics user', error);
    return null;
  }
}

// Notification sending function
// Update your sendAssignmentNotification function
const socketManager = require('../middlewares/socketmanager.js');

async function sendAssignmentNotification(req, order) {
  try {

    const assignedUserId = order.assignedTo ? order.assignedTo._id.toString() : null;

    if (!assignedUserId) {
      console.log("No assigned user to notify");
      return;
    }

    const userIdArray = [assignedUserId];


    console.log(`Sending notification for order ${order._id}`);
    const io = req.app.get("io");

    if (!io) {
      console.error("IO instance not found");
      return;
    }

    await notification.create({ text: `Order with orderId ${order.orderId} has been assigned to you`, userId: userIdArray })

    // Get the socket ID for the assigned user
    const assignedUserSocketId = socketManager.getUserSocket(order.assignedTo.toString());

    if (assignedUserSocketId) {
      console.log(`Emitting to socket: ${assignedUserSocketId}`);
      io.to(assignedUserSocketId).emit("assignment", {
        orderId: order._id,
        message: `Order with orderId (${order.orderId}) has been assigned to you`
      });
      console.log(`Notification sent for order ${order._id}`);
    } else {
      console.log(`User ${order.assignedTo} is not connected`);
    }
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}

// Update your getSockets function
exports.getSockets = (users = []) => {
  return socketManager.getMultipleUserSockets(users);
};

// Calculate priority based on requirements
function calculatePriority(requirements) {
  const complexityFactors = requirements.split(',').length;
  return Math.min(5, Math.max(1, Math.ceil(complexityFactors)));
}

// Calculate estimated completion time
function calculateEstimatedCompletion() {
  const estimatedCompletionTime = new Date();
  estimatedCompletionTime.setDate(estimatedCompletionTime.getDate() + 3);
  return estimatedCompletionTime;
}

// Order Creation Controller
// exports.createOrder = async (req, res) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();


//     try {
//         const { requirements, dimensions,assignedTo } = req.body;
//         const files = req.files.images;
//         const customerId = req.params.id;
//         // console.log("customerId is:",customerId);
//         // console.log("assigned to is:",assignedTo);



//         // Validate input
//         if (!requirements || !dimensions || !files) {
//             return res.status(400).json({
//                 success: false,
//                 message: "All fields are mandatory"
//             });
//         }
//         console.log("data validate successfully in create order controller");



//         console.log("print  ");
//         //upload file locally
//         const filesArray = Array.isArray(files) ? files : [files];
//         const filesImage = await localFileUpload(
//                 files,

//             );

//         const imageUrls = filesImage.map((file) => file.path);
//         // console.log("imageUrls is:",imageUrls);
//         // console.log("files image in create order controller",filesImage);



//         // Find an available Graphics user
//         let assignedGraphicsUser 
//         // console.log("before any initialisation of assignedTo",assignedGraphicsUser);

//         if(assignedTo!=='undefined'){
//             assignedGraphicsUser={
//                 _id:assignedTo,
//             }
//             // console.log("assignedGraphicsUser value if assignedTo present",assignedTo);
//         }
//         else{
//             assignedGraphicsUser=await findAvailableGraphicsUser();
//             // console.log("assignedGraphicsUser is if assignedTo absent:",assignedGraphicsUser);
//         }


//         // Create new order
//         const newOrder = new Order({
//             customer: customerId,
//             requirements,
//             dimensions,
//             image: imageUrls,
//             createdBy: req.user.id,
//             status: 'graphics_pending',
//             assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
//         });

//         // Save order
//         const order = await newOrder.save({ session });

//         // Create Work Queue Item
//         const workQueueItem = new WorkQueue({
//             order: order._id,
//             status: 'graphics_pending',
//             assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null,
//             priority: calculatePriority(requirements),
//             estimatedCompletionTime: calculateEstimatedCompletion(),
//             processingSteps: [
//                 {
//                     stepName: 'Graphics Processing',
//                     status: 'graphics_pending',
//                     assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
//                 }
//             ]
//         });

//         // Save Work Queue Item
//         await workQueueItem.save({ session });

//         // Schedule order processing job
//         await agenda.schedule('in 1 minute', 'process-order', {
//             orderId: order._id,
//             workQueueId: workQueueItem._id,
//             assignedUserId: assignedGraphicsUser ? assignedGraphicsUser._id : null
//         });

//         // Commit transaction
//         await session.commitTransaction();
//         session.endSession();

//         // Populate and return order details
//         const populatedOrder = await Order.findById(order._id)
//             .populate("customer", "name email")

//             .populate("assignedTo", "name email")
//             .populate("createdBy", "name email");

//         // Send notification to assigned user if exists
//         if (assignedGraphicsUser) {
//             await sendAssignmentNotification(req,order);
//         }

//         res.status(201).json({
//             success: true,
//             message: assignedGraphicsUser 
//                 ? "Order created and assigned to Graphics user" 
//                 : "Order created, awaiting Graphics user assignment",
//             data: {
//                 order: populatedOrder,
//                 assignedUser: assignedGraphicsUser ? {
//                     _id: assignedGraphicsUser._id,
//                     name: assignedGraphicsUser.name,
//                     email: assignedGraphicsUser.email
//                 } : null
//             }
//         });

//     } catch (error) {
//          // Abort transaction
//         // await session.abortTransaction();
//         // session.endSession();
//         if (session.inTransaction()) {
//             await session.abortTransaction();
//         }
//         session.endSession();

//         console.error("Error creating order", error);
//         return res.status(400).json({
//             success: false,
//             message: "Problem in creating the order",
//             error: error.message
//         });

//     }
// };

exports.createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { requirements, dimensions, assignedTo } = req.body;
    const files = req.files.images;
    const changes = [];

    // Validate required fields
    if (!requirements || !dimensions || !files) {
      return res.status(400).json({
        success: false,
        message: "Requirements, dimensions, and images are mandatory"
      });
    }

    let customerId;
    let customerCreated = false;

    // Check if customerId is provided for existing customer
    if (req.body.customerId && req.body.customerId !== 'undefined') {
      customerId = req.body.customerId;

      // Verify the customer exists
      const existingCustomer = await Customer.findById(customerId);
      if (!existingCustomer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found"
        });
      }
    } else {
      // Create new customer
      const {
        firstName,
        lastName,
        email,
        phoneNo,
        gstNo,
        panNo,
      } = req.body;

      // Validate new customer required fields
      if (!firstName || !lastName || !email || !phoneNo) {
        return res.status(400).json({
          success: false,
          message: "First name, last name, email, and phone number are mandatory for new customer"
        });
      }

      const trimmedEmail = email.trim();

      // Check for existing email
      const existingCustomer = await Customer.findOne({ email: trimmedEmail });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: "Customer already registered with this email"
        });
      }

      // Check for existing phone number
      const existingPhone = await Customer.findOne({ phoneNo });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered with another customer"
        });
      }

      // Create address if provided
      let savedAddress = null;
      const address = {
        street: req.body['address[street]'],
        city: req.body['address[city]'],
        state: req.body['address[state]'],
        pincode: req.body['address[pincode]'],
        additionalDetail: req.body['address[additionalDetail]']
      };

      if (address && (address.street || address.city || address.state || address.pincode)) {
        // Only require all address fields if any address field is provided
        if (address.street && address.city && address.state && address.pincode) {
          const newAddress = new Address({
            street: address.street,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            additionalDetail: address.additionalDetail || ""
          });
          savedAddress = await newAddress.save({ session });
        } else {
          return res.status(400).json({
            success: false,
            message: "Address must include street, city, state, and pincode"
          });
        }
      }

      // Create new customer
      const newCustomer = new Customer({
        firstName,
        lastName,
        email: trimmedEmail,
        phoneNo,
        gstNo: gstNo || "",
        panNo: panNo || "",
        address: savedAddress ? savedAddress._id : null,
        createdBy: req.user.id
      });

      const customer = await newCustomer.save({ session });
      customerId = customer._id;
      customerCreated = true;

      changes.push(`New customer created: ${firstName} ${lastName} (${trimmedEmail})`);
    }

    console.log("Customer handling completed successfully");

    // Upload files locally
    const filesArray = Array.isArray(files) ? files : [files];
    const filesImage = await localFileUpload(files);
    const imageUrls = filesImage.map((file) => file.path);

    // Find an available Graphics user
    let assignedGraphicsUser;
    if (assignedTo && assignedTo !== 'undefined') {
      assignedGraphicsUser = {
        _id: assignedTo,
      };
    } else {
      assignedGraphicsUser = await findAvailableGraphicsUser();
    }

    // Create new order
    const newOrder = new Order({
      customer: customerId,
      requirements,
      dimensions,
      image: imageUrls,
      createdBy: req.user.id,
      status: 'graphics_pending',
      assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
    });

    // Save order
    const order = await newOrder.save({ session });

    // Get current user info for logs
    const createdByUser = await User.findById(req.user.id);
    changes.push(`Order created by ${createdByUser.name} (${createdByUser.accountType})`);

    // If order is assigned, add that to the logs too
    if (assignedGraphicsUser) {
      const assignedUser = await User.findById(assignedGraphicsUser._id);
      changes.push(`Order assigned to ${assignedUser.name} (${assignedUser.accountType})`);
    } else {
      changes.push(`Order awaiting graphics user assignment`);
    }

    // Save logs
    if (changes.length > 0) {
      for (const change of changes) {
        await Log.create({
          orderId: order._id,
          changes: change,
        }, { session });
      }
    }

    // Create Work Queue Item
    const workQueueItem = new WorkQueue({
      order: order._id,
      status: 'graphics_pending',
      assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null,
      priority: calculatePriority(requirements),
      estimatedCompletionTime: calculateEstimatedCompletion(),
      processingSteps: [
        {
          stepName: 'Graphics Processing',
          status: 'graphics_pending',
          assignedTo: assignedGraphicsUser ? assignedGraphicsUser._id : null
        }
      ]
    });

    // Save Work Queue Item
    await workQueueItem.save({ session });

    // Schedule order processing job
    await agenda.schedule('in 1 minute', 'process-order', {
      orderId: order._id,
      workQueueId: workQueueItem._id,
      assignedUserId: assignedGraphicsUser ? assignedGraphicsUser._id : null
    });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Populate and return order details
    const populatedOrder = await Order.findById(order._id)
      .populate("customer", "name email firstName lastName phoneNo")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    // Send notification to assigned user if exists
    if (assignedGraphicsUser) {
      await sendAssignmentNotification(req, order);
    }

    res.status(201).json({
      success: true,
      message: customerCreated
        ? "New customer created and order assigned successfully"
        : assignedGraphicsUser
          ? "Order created and assigned to Graphics user"
          : "Order created, awaiting Graphics user assignment",
      data: {
        order: populatedOrder,
        customerCreated,
        assignedUser: assignedGraphicsUser ? {
          _id: assignedGraphicsUser._id,
          name: assignedGraphicsUser.name,
          email: assignedGraphicsUser.email
        } : null
      }
    });

  } catch (error) {
    // Abort transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    console.error("Error creating order", error);

    // Handle specific mongoose errors
    if (error.code === 11000) {
      if (error.keyPattern && error.keyPattern.phoneNo) {
        return res.status(400).json({
          success: false,
          message: "Phone number already registered with another customer"
        });
      }
      if (error.keyPattern && error.keyPattern.email) {
        return res.status(400).json({
          success: false,
          message: "Email already registered with another customer"
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: "Problem in creating the order",
      error: error.message
    });
  }
};

// Get Pending Orders
exports.getPendingOrders = async (req, res) => {
  try {
    const pendingOrders = await Order.find({
      status: { $in: ['New', 'InWorkQueue'] }
    })
      .populate('customer', 'name email')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      count: pendingOrders.length,
      data: pendingOrders
    });
  } catch (error) {
    console.error('Error fetching pending orders', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending orders',
      error: error.message
    });
  }
};

// Reassign Unassigned Orders
exports.reassignUnassignedOrders = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find unassigned orders
    const unassignedOrders = await Order.find({
      status: 'InWorkQueue',
      assignedTo: null
    });

    // Reassign orders
    const reassignedOrders = [];
    for (let order of unassignedOrders) {
      // Find available Graphics user
      const availableUser = await findAvailableGraphicsUser();

      if (availableUser) {
        // Update order assignment
        order.assignedTo = availableUser._id;
        order.status = 'Assigned';
        await order.save({ session });

        // Update corresponding work queue item
        await WorkQueue.findOneAndUpdate(
          { order: order._id },
          {
            assignedTo: availableUser._id,
            status: 'Pending',
            $push: {
              processingSteps: {
                stepName: 'Reassignment',
                status: 'Pending',
                assignedTo: availableUser._id
              }
            }
          },
          { session }
        );

        reassignedOrders.push(order);
      }
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: 'Unassigned orders reassigned',
      reassignedCount: reassignedOrders.length,
      orders: reassignedOrders
    });
  } catch (error) {
    // Abort transaction
    await session.abortTransaction();
    session.endSession();

    console.error('Error reassigning orders', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign orders',
      error: error.message
    });
  }
};

// Get User's Assigned Orders
exports.getUserAssignedOrders = async (req, res) => {
  try {
    const userId = req.user.id; // Assuming authenticated user

    const assignedOrders = await Order.find({
      assignedTo: userId,
      status: { $nin: ['completed', 'paid'] }
    })
      .populate('customer', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });



    // const filteredOrders = assignedOrders.map(({customer,createdBy,assignedTo,...rest})=>rest);

    const filteredOrders = assignedOrders.map(order => {
      const obj = order.toObject();  // Convert Mongoose document to a plain object
      const { customer, createdBy, assignedTo, ...rest } = obj;
      return rest;
    });



    res.status(200).json({
      success: true,
      count: assignedOrders.length,
      data: filteredOrders
    });
  } catch (error) {
    console.error('Error fetching assigned orders', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned orders',
      error: error.message
    });
  }
};

// Agenda Order Processing Job
agenda.define('process-order', async (job) => {
  const { orderId, workQueueId, assignedUserId } = job.data;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch the order and work queue item
    const order = await Order.findById(orderId);
    const workQueueItem = await WorkQueue.findById(workQueueId);

    if (!order || !workQueueItem) {
      throw new Error('Order or Work Queue Item not found');
    }

    // Update order
    order.status = 'InProgress';
    await order.save({ session });

    // Update Work Queue Item
    workQueueItem.status = 'InProgress';
    workQueueItem.startedAt = new Date();

    // Update first processing step
    const initialStep = workQueueItem.processingSteps[0];
    initialStep.status = 'InProgress';
    initialStep.startedAt = new Date();

    await workQueueItem.save({ session });

    // Perform processing steps
    await processOrderSteps(order, workQueueItem, session);

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    console.log(`Order ${orderId} processed successfully`);

  } catch (error) {
    // Abort transaction
    await session.abortTransaction();
    session.endSession();

    // Handle processing errors
    console.error(`Order processing failed for order ${orderId}`, error);

    // Update order and work queue item status
    await Order.findByIdAndUpdate(orderId, {
      status: 'New',
      processingError: error.message
    });

    await WorkQueue.findByIdAndUpdate(workQueueId, {
      status: 'Failed',
      $push: {
        errorLog: {
          message: error.message
        }
      }
    });

    // Throw error to trigger retry mechanism
    throw error;
  }
});

// Process order steps
async function processOrderSteps(order, workQueueItem, session) {
  const processingSteps = workQueueItem.processingSteps;

  for (let step of processingSteps) {
    // Simulate step processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    step.status = 'Completed';
    step.completedAt = new Date();
  }

  // Update final status
  order.status = 'completed';
  workQueueItem.status = 'Completed';
  workQueueItem.completedAt = new Date();

  await order.save({ session });
  await workQueueItem.save({ session });
}

// Agenda Event Handlers
agenda.on('ready', () => {
  console.log('Agenda jobs are ready');
  agenda.start();
});

agenda.on('error', (error) => {
  console.error('Agenda encountered an error:', error);
});

// Graceful shutdown
async function gracefulShutdown() {
  await agenda.stop();
  process.exit(0);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);



// Allowed status values defined in your WorkQueue schema
const allowedStatuses = ["graphics_pending", "graphics_in_progress", "graphics_completed"];

exports.updateWorkQueueStatus = async (req, res) => {

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Destructure workQueueId and new status from the request body
    const { workQueueId, status } = req.body;
    const changes = [];



    // Validate that both workQueueId and status are provided
    if (!workQueueId || !status) {
      return res.status(400).json({
        success: false,
        message: 'WorkQueue ID and status are required'
      });
    }

    // Validate that the provided status is allowed
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status provided. Allowed statuses: ${allowedStatuses.join(', ')}`
      });
    }

    // Fetch the WorkQueue document within the session
    // const workQueueItem = await WorkQueue.findById(workQueueId).session(session);
    const workQueueItem = await WorkQueue.findOne({ order: workQueueId }).session(session);
    if (!workQueueItem) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'WorkQueue item not found'
      });
    }
    const previousStatus = workQueueItem.status;
    const currentUser = await User.findById(req.user.id);
    // Update the WorkQueue item's status
    workQueueItem.status = status;
    // Saving the document will trigger your pre('save') middleware that updates the Order status.


    // Update status and timestamps
    const istTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");

    if (status === "graphics_in_progress") {
      workQueueItem.startedAt = istTime; // Capture start time
    } else if (status === "graphics_completed") {
      workQueueItem.completedAt = istTime; // Capture completion time
    }



    const updatedWorkQueueItem = await workQueueItem.save({ session });

    changes.push(`${currentUser.name} role (${currentUser.accountType}) has changed status of order from "${previousStatus}" to "${status}"`);

    if (changes.length > 0) {
      for (const change of changes) {
        await Log.create({
          orderId: workQueueItem.order,
          changes: change,
        }, { session });
      }
    }


    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    changeStatus(req, workQueueItem);

    // if (status === "admin_approved") {
    //   // Call the assignOrderToCutOut function
    //   await assignOrderToCutOut(orderId, req, res);
    //   return; // The response is handled by assignOrderToCutOut
    // }

    res.status(200).json({
      success: true,
      message: 'WorkQueue status updated successfully, and Order status updated accordingly.',
      data: updatedWorkQueueItem
    });
  } catch (error) {
    // Abort the transaction if any error occurs
    await session.abortTransaction();
    session.endSession();

    console.error('Error updating WorkQueue status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};


const { cadFileUpload } = require('../utils/CadFileUploader');
const { textFileUpload } = require('../utils/TextFileUploader');
const archiver = require('archiver');
const Gallery = require("../models/Gallery");

// exports.uploadFile = async (req, res) => {
//   try {
//     const { orderId } = req.body;

//     if (!orderId) {
//       return res.status(400).json({
//         success: false,
//         message: "Order ID is required"
//       });
//     }

//     const { files } = req;

//     // Check if files were provided
//     if (!files || Object.keys(files).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No files were uploaded"
//       });
//     }

//     // Process CAD files
//     const cadFiles = files.cadFiles ?
//       (Array.isArray(files.cadFiles) ? files.cadFiles : [files.cadFiles]) :
//       [];

//     // Process image files
//     const imageFiles = files.images ?
//       (Array.isArray(files.images) ? files.images : [files.images]) :
//       [];

//     // Process text files (not compulsory)
//     const textFiles = files.textFiles ?
//       (Array.isArray(files.textFiles) ? files.textFiles : [files.textFiles]) :
//       [];


//     // Check if both types of files are present
//     if (cadFiles.length === 0 || imageFiles.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Both CAD files and images are required"
//       });
//     }

//     // Upload CAD files
//     const cadUploadResults = await cadFileUpload(cadFiles);

//     // Upload image files
//     const imageUploadResults = await localFileUpload(imageFiles);

//     // Extract file paths from upload results
//     const cadFilePaths = cadUploadResults.map(file => file.path);
//     const imagePaths = imageUploadResults.map(file => file.path);

//     // Upload text files if any are provided
//     let textFilePaths = [];
//     if (textFiles.length > 0) {
//       const textUploadResults = await textFileUpload(textFiles);
//       textFilePaths = textUploadResults.map(file => file.path);
//     }

//     // Create new CAD document in the database
//     const newCadEntry = await Cad.create({
//       order: orderId,
//       photo: imagePaths,
//       CadFile: cadFilePaths,
//       textFiles: textFilePaths
//     });

//     await Log.create({
//       orderId: orderId,
//       changes: `Uploaded files - CAD: ${cadFilePaths.length}, Images: ${imagePaths.length}, Text: ${textFilePaths.length}`
//     });

//     // Return success response with created document
//     return res.status(201).json({
//       success: true,
//       message: "Files uploaded and saved successfully",
//       data: newCadEntry
//     });

//   } catch (error) {
//     console.error("Error in uploadFile controller:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error uploading files",
//       error: error.message
//     });
//   }
// };

exports.uploadFile = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.user.id; // Assuming auth middleware provides user ID

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const { files } = req;

    // Check if files were provided
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded"
      });
    }

    // Process CAD files
    const cadFiles = files.cadFiles ?
      (Array.isArray(files.cadFiles) ? files.cadFiles : [files.cadFiles]) :
      [];

    // Process image files
    const imageFiles = files.images ?
      (Array.isArray(files.images) ? files.images : [files.images]) :
      [];

    // Process text files (not compulsory)
    const textFiles = files.textFiles ?
      (Array.isArray(files.textFiles) ? files.textFiles : [files.textFiles]) :
      [];

    // Check if both types of files are present
    if (cadFiles.length === 0 || imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Both CAD files and images are required"
      });
    }

    // Ensure equal number of CAD files and images for gallery pairing
    if (cadFiles.length !== imageFiles.length) {
      return res.status(400).json({
        success: false,
        message: "Number of CAD files must match number of images for proper pairing"
      });
    }

    // Upload CAD files
    const cadUploadResults = await cadFileUpload(cadFiles);

    // Upload image files
    const imageUploadResults = await localFileUpload(imageFiles);

    // Extract file paths from upload results
    const cadFilePaths = cadUploadResults.map(file => file.path);
    const imagePaths = imageUploadResults.map(file => file.path);

    // Upload text files if any are provided
    let textFilePaths = [];
    if (textFiles.length > 0) {
      const textUploadResults = await textFileUpload(textFiles);
      textFilePaths = textUploadResults.map(file => file.path);
    }

    // Create new CAD document in the database
    const newCadEntry = await Cad.create({
      order: orderId,
      photo: imagePaths,
      CadFile: cadFilePaths,
      textFiles: textFilePaths
    });

    // Get order details for gallery
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Create gallery entries (1 CAD file paired with 1 image)
    try {
      await Gallery.createGalleryEntries(
        order.orderId,
        orderId,
        cadFilePaths,
        imagePaths,
        userId,
        newCadEntry._id
      );

      console.log(`Created ${cadFilePaths.length} gallery entries for order ${order.orderId}`);
    } catch (galleryError) {
      console.error("Error creating gallery entries:", galleryError);
      // Don't fail the main upload, just log the error
    }

    await Log.create({
      orderId: orderId,
      changes: `Uploaded files - CAD: ${cadFilePaths.length}, Images: ${imagePaths.length}, Text: ${textFilePaths.length}`
    });

    // Return success response with created document
    return res.status(201).json({
      success: true,
      message: "Files uploaded and saved successfully",
      data: newCadEntry,
      galleryEntriesCreated: cadFilePaths.length
    });

  } catch (error) {
    console.error("Error in uploadFile controller:", error);
    return res.status(500).json({
      success: false,
      message: "Error uploading files",
      error: error.message
    });
  }
};

async function processBatchUpload(files, uploadFunction, batchSize = 50) {
  const results = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(files.length/batchSize)} (${batch.length} files)`);
    
    try {
      const batchResults = await uploadFunction(batch);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Batch upload failed for batch starting at index ${i}:`, error);
      throw error;
    }
  }
  
  return results;
}

// Helper function for creating gallery entries in batches
async function createGalleryEntriesBatch(cadFilePaths, imagePaths, userId, cadDocId, Gallery) {
  const BATCH_SIZE = 100;
  const galleryEntries = [];

  if (cadFilePaths.length > 0) {
    const minLength = Math.min(cadFilePaths.length, imagePaths.length);
    
    // Create paired entries (CAD + Image)
    for (let i = 0; i < minLength; i++) {
      galleryEntries.push({
        orderId: `DB-${Date.now()}-${i}`,
        order: null,
        cadFile: cadFilePaths[i],
        image: imagePaths[i],
        cadFileName: cadFilePaths[i].split('/').pop(),
        imageName: imagePaths[i].split('/').pop(),
        uploadedBy: userId,
        originalCadDoc: cadDocId
      });
    }
    
    // Handle remaining images if there are more images than CAD files
    for (let i = minLength; i < imagePaths.length; i++) {
      galleryEntries.push({
        orderId: `DB-${Date.now()}-${i}`,
        order: null,
        cadFile: '',
        image: imagePaths[i],
        cadFileName: '',
        imageName: imagePaths[i].split('/').pop(),
        uploadedBy: userId,
        originalCadDoc: cadDocId
      });
    }
  } else {
    // Create image-only entries
    for (let i = 0; i < imagePaths.length; i++) {
      galleryEntries.push({
        orderId: `DB-${Date.now()}-${i}`,
        order: null,
        cadFile: '',
        image: imagePaths[i],
        cadFileName: '',
        imageName: imagePaths[i].split('/').pop(),
        uploadedBy: userId,
        originalCadDoc: cadDocId
      });
    }
  }

  // Insert gallery entries in batches
  let successfulInserts = 0;
  for (let i = 0; i < galleryEntries.length; i += BATCH_SIZE) {
    const batch = galleryEntries.slice(i, i + BATCH_SIZE);
    try {
      await Gallery.insertMany(batch);
      successfulInserts += batch.length;
      console.log(`Inserted gallery batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(galleryEntries.length/BATCH_SIZE)} (${batch.length} entries)`);
    } catch (galleryError) {
      console.error(`Error creating gallery entries batch ${i}:`, galleryError);
      // Continue with next batch instead of failing completely
    }
  }
  
  return successfulInserts;
}

// Main upload controller - REPLACE YOUR CURRENT uploadFileToDB FUNCTION WITH THIS
exports.uploadFileToDB = async (req, res) => {
  try {
    const userId = req.user.id;
    const { files } = req;

    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files were uploaded"
      });
    }

    console.log('=== UPLOAD STARTED ===');
    console.log('Total file fields received:', Object.keys(files).length);

    // Process files with better error handling
    const cadFiles = files.cadFiles
      ? (Array.isArray(files.cadFiles) ? files.cadFiles : [files.cadFiles])
      : [];

    const imageFiles = files.images
      ? (Array.isArray(files.images) ? files.images : [files.images])
      : [];

    const textFiles = files.textFiles
      ? (Array.isArray(files.textFiles) ? files.textFiles : [files.textFiles])
      : [];

    // Log file counts for debugging
    console.log(`Processing: ${cadFiles.length} CAD files, ${imageFiles.length} images, ${textFiles.length} text files`);
    console.log(`Total files to process: ${cadFiles.length + imageFiles.length + textFiles.length}`);

    if (imageFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one image file is required"
      });
    }

    // Process uploads in batches to prevent memory issues
    const BATCH_SIZE = 50;
    
    let cadUploadResults = [];
    if (cadFiles.length > 0) {
      console.log('Starting CAD file uploads...');
      try {
        cadUploadResults = await processBatchUpload(cadFiles, cadFileUpload, BATCH_SIZE);
        console.log(`CAD upload complete: ${cadUploadResults.length} files processed`);
      } catch (error) {
        console.log('CAD file upload failed:', error.message);
        cadUploadResults = [];
      }
    }

    let imageUploadResults = [];
    if (imageFiles.length > 0) {
      console.log('Starting image file uploads...');
      imageUploadResults = await processBatchUpload(imageFiles, localFileUpload, BATCH_SIZE);
      console.log(`Image upload complete: ${imageUploadResults.length} files processed`);
    }

    let textUploadResults = [];
    if (textFiles.length > 0) {
      console.log('Starting text file uploads...');
      try {
        textUploadResults = await processBatchUpload(textFiles, textFileUpload, BATCH_SIZE);
        console.log(`Text upload complete: ${textUploadResults.length} files processed`);
      } catch (error) {
        console.log('Text file upload failed:', error.message);
        textUploadResults = [];
      }
    }

    // Create DB entry in Cad collection
    console.log('Creating database entry...');
    const newCadEntry = await Cad.create({
      photo: imageUploadResults.map(file => file.path),
      CadFile: cadUploadResults.map(file => file.path),
      textFiles: textUploadResults.map(file => file.path || ''),
      uploadedBy: userId
    });
    console.log(`Database entry created with ID: ${newCadEntry._id}`);

    // Create gallery entries in batches
    console.log('Creating gallery entries...');
    const cadFilePaths = cadUploadResults.map(file => file.path);
    const imagePaths = imageUploadResults.map(file => file.path);
    
    const galleryEntriesCreated = await createGalleryEntriesBatch(
      cadFilePaths, 
      imagePaths, 
      userId, 
      newCadEntry._id,
      Gallery
    );
    
    console.log(`Gallery entries created: ${galleryEntriesCreated}`);

    // Log upload
    await Log.create({
      changes: `Direct DB Upload - CAD: ${cadUploadResults.length}, Images: ${imageUploadResults.length}, Text: ${textUploadResults.length}`,
      userId
    });

    console.log('=== UPLOAD COMPLETED SUCCESSFULLY ===');

    return res.status(201).json({
      success: true,
      message: "Files uploaded successfully",
      data: {
        cadEntry: newCadEntry,
        uploadSummary: {
          cadFiles: cadUploadResults.length,
          imageFiles: imageUploadResults.length,
          textFiles: textUploadResults.length,
          totalFiles: cadUploadResults.length + imageUploadResults.length + textUploadResults.length,
          galleryEntriesCreated: galleryEntriesCreated
        }
      },
      galleryEntriesCreated: galleryEntriesCreated,
      totalFilesProcessed: cadUploadResults.length + imageUploadResults.length + textUploadResults.length
    });

  } catch (error) {
    console.error("=== UPLOAD ERROR ===");
    console.error("Error in uploadFileToDB controller:", error);
    console.error("Stack trace:", error.stack);
    
    return res.status(500).json({
      success: false,
      message: "Error uploading files",
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


// exports.uploadFileToDB = async (req, res) => {
//   try {
//     const userId = req.user.id; // From auth middleware
//     const { files } = req;

//     if (!files || Object.keys(files).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No files were uploaded"
//       });
//     }

//     // Process CAD files (now optional)
//     const cadFiles = files.cadFiles
//       ? (Array.isArray(files.cadFiles) ? files.cadFiles : [files.cadFiles])
//       : [];

//     // Process image files (required)
//     const imageFiles = files.images
//       ? (Array.isArray(files.images) ? files.images : [files.images])
//       : [];

//     // Process text files
//     const textFiles = files.textFiles
//       ? (Array.isArray(files.textFiles) ? files.textFiles : [files.textFiles])
//       : [];

//     // Ensure at least image files are present
//     if (imageFiles.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "At least one image file is required"
//       });
//     }

//     // Upload CAD files if any
//     let cadUploadResults = [];
//     if (cadFiles.length > 0) {
//       cadUploadResults = await cadFileUpload(cadFiles);
//     }

//     // Upload image files (required)
//     let imageUploadResults = [];
//     if (imageFiles.length > 0) {
//       imageUploadResults = await localFileUpload(imageFiles);
//     }

//     // Upload text files if any
//     let textUploadResults = [];
//     if (textFiles.length > 0) {
//       textUploadResults = await textFileUpload(textFiles);
//     }

//     // Create DB entry in Cad collection
//     const newCadEntry = await Cad.create({
//       photo: imageUploadResults.map(file => file.path),
//       CadFile: cadUploadResults.map(file => file.path),
//       textFiles: textUploadResults.map(file => file.path || ''),
//       uploadedBy: userId
//     });

//     // Create gallery entries for images
//     // If both CAD and images exist, pair them; otherwise create gallery entries for images only
//     const cadFilePaths = cadUploadResults.map(file => file.path);
//     const imagePaths = imageUploadResults.map(file => file.path);

//     try {
//       if (cadFilePaths.length > 0) {
//         // If CAD files exist, create paired gallery entries
//         const minLength = Math.min(cadFilePaths.length, imagePaths.length);
//         for (let i = 0; i < minLength; i++) {
//           await Gallery.create({
//             orderId: `DB-${Date.now()}-${i}`, // Generate unique orderId for database uploads
//             order: null, // No specific order for direct DB uploads
//             cadFile: cadFilePaths[i],
//             image: imagePaths[i],
//             cadFileName: cadFilePaths[i].split('/').pop(),
//             imageName: imagePaths[i].split('/').pop(),
//             uploadedBy: userId,
//             originalCadDoc: newCadEntry._id
//           });
//         }
        
//         // Handle remaining images if there are more images than CAD files
//         for (let i = minLength; i < imagePaths.length; i++) {
//           await Gallery.create({
//             orderId: `DB-${Date.now()}-${i}`, // Generate unique orderId for database uploads
//             order: null, // No specific order for direct DB uploads
//             cadFile: '', // Empty CAD file for image-only entries
//             image: imagePaths[i],
//             cadFileName: '',
//             imageName: imagePaths[i].split('/').pop(),
//             uploadedBy: userId,
//             originalCadDoc: newCadEntry._id
//           });
//         }
//       } else {
//         // If no CAD files, create gallery entries for images only
//         for (let i = 0; i < imagePaths.length; i++) {
//           await Gallery.create({
//             orderId: `DB-${Date.now()}-${i}`, // Generate unique orderId for database uploads
//             order: null, // No specific order for direct DB uploads
//             cadFile: '', // Empty CAD file for image-only entries
//             image: imagePaths[i],
//             cadFileName: '',
//             imageName: imagePaths[i].split('/').pop(),
//             uploadedBy: userId,
//             originalCadDoc: newCadEntry._id
//           });
//         }
//       }

//       console.log(`Created ${imagePaths.length} gallery entries for database upload`);
//     } catch (galleryError) {
//       console.error("Error creating gallery entries:", galleryError);
//       // Don't fail the main upload, just log the error
//     }

//     // Log upload
//     await Log.create({
//       changes: `Direct DB Upload - CAD: ${cadUploadResults.length}, Images: ${imageUploadResults.length}, Text: ${textUploadResults.length}`,
//       userId
//     });

//     // Respond with success
//     return res.status(201).json({
//       success: true,
//       message: "Files uploaded successfully",
//       data: newCadEntry,
//       galleryEntriesCreated: imagePaths.length
//     });

//   } catch (error) {
//     console.error("Error in uploadFileToDB controller:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error uploading files",
//       error: error.message
//     });
//   }
// };

// exports.uploadFileToDB = async (req, res) => {
//   try {
//     const userId = req.user.id; // From auth middleware
//     const { files } = req;

//     if (!files || Object.keys(files).length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "No files were uploaded"
//       });
//     }

//     // Process CAD files
//     const cadFiles = files.cadFiles
//       ? (Array.isArray(files.cadFiles) ? files.cadFiles : [files.cadFiles])
//       : [];

//     // Process image files
//     const imageFiles = files.images
//       ? (Array.isArray(files.images) ? files.images : [files.images])
//       : [];

//     // Process text files
//     const textFiles = files.textFiles
//       ? (Array.isArray(files.textFiles) ? files.textFiles : [files.textFiles])
//       : [];

//     // Ensure at least one of CAD or image files is present
//     if (cadFiles.length === 0 && imageFiles.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "At least one CAD file or image file is required"
//       });
//     }

//     // Upload CAD files if any
//     let cadUploadResults = [];
//     if (cadFiles.length > 0) {
//       cadUploadResults = await cadFileUpload(cadFiles);
//     }

//     // Upload image files if any
//     let imageUploadResults = [];
//     if (imageFiles.length > 0) {
//       imageUploadResults = await localFileUpload(imageFiles);
//     }

//     // Upload text files if any
//     let textUploadResults = [];
//     if (textFiles.length > 0) {
//       textUploadResults = await textFileUpload(textFiles);
//     }

//     // Create DB entry
//     const newCadEntry = await Cad.create({
//       photo: imageUploadResults.map(file => file.path),
//       CadFile: cadUploadResults.map(file => file.path),
//       textFiles: textUploadResults.map(file => file.path || ''),
//       uploadedBy: userId
//     });

//     // Log upload
//     await Log.create({
//       changes: `Uploaded files - CAD: ${cadUploadResults.length}, Images: ${imageUploadResults.length}, Text: ${textUploadResults.length}`,
//       userId
//     });

//     // Respond with success
//     return res.status(201).json({
//       success: true,
//       message: "Files uploaded successfully",
//       data: newCadEntry
//     });

//   } catch (error) {
//     console.error("Error in uploadFile controller:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error uploading files",
//       error: error.message
//     });
//   }
// };


// // Optionally - download all files of a specific type
exports.downloadAllFilesOfType = async (req, res) => {
  try {
    const { documentId } = req.params;
    const fileType = req.query.type || 'cad'; // Default to CAD files

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }

    // Find the CAD document by ID
    const cadDocument = await Cad.findById(documentId);

    if (!cadDocument) {
      return res.status(404).json({
        success: false,
        message: "CAD document not found"
      });
    }

    // Determine file array based on requested type
    let filePaths = [];
    let folderName = '';

    if (fileType === 'cad') {
      filePaths = cadDocument.CadFile;
      folderName = 'cad_files';
    } else if (fileType === 'image') {
      filePaths = cadDocument.photo;
      folderName = 'images';
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Must be 'cad' or 'image'"
      });
    }

    // Check if we have files to download
    if (filePaths.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No ${fileType} files found in this document`
      });
    }

    // Set response headers for ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${folderName}_${documentId}.zip`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add all files to archive
    for (let i = 0; i < filePaths.length; i++) {
      const relativePath = filePaths[i];
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(__dirname, '..', cleanPath);

      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        const filename = path.basename(absolutePath);
        // Add file to zip
        archive.file(absolutePath, { name: filename });
      } else {
        console.warn(`File not found: ${absolutePath}`);
      }
    }

    // Finalize archive
    archive.finalize();

  } catch (error) {
    console.error(`Error downloading ${fileType} files:`, error);
    return res.status(500).json({
      success: false,
      message: `Error downloading ${fileType} files`,
      error: error.message
    });
  }
};


exports.removeFromWorkQueue = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { workQueueId } = req.params;
    const { reason, completionNotes } = req.body;

    // Validate input
    if (!workQueueId) {
      return res.status(400).json({
        success: false,
        message: "Work Queue ID is required"
      });
    }

    console.log("Data validated successfully in remove from work queue controller");

    // Find the work queue item
    const workQueueItem = await WorkQueue.findById(workQueueId).session(session);

    if (!workQueueItem) {
      return res.status(404).json({
        success: false,
        message: "Work Queue item not found"
      });
    }

    // Find the associated order
    const order = await Order.findById(workQueueItem.order).session(session);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Associated order not found"
      });
    }

    // Update order status
    order.status = 'Completed';
    order.completionNotes = completionNotes || '';
    order.completedAt = new Date();
    order.completedBy = req.user.id;
    await order.save({ session });

    // Update work queue item
    workQueueItem.status = 'Completed';
    workQueueItem.completionReason = reason || 'Task Completed';
    workQueueItem.completedAt = new Date();

    // Update all pending processing steps to completed
    workQueueItem.processingSteps.forEach(step => {
      if (step.status === 'Pending') {
        step.status = 'Completed';
        step.completedAt = new Date();
        step.completedBy = req.user.id;
      }
    });

    await workQueueItem.save({ session });

    // Cancel any scheduled jobs for this order if they exist
    await agenda.cancel({ 'data.workQueueId': workQueueItem._id });

    // Notify the customer that their order is complete
    await sendOrderCompletionNotification(req, order);

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // Populate and return updated order details
    const populatedOrder = await Order.findById(order._id)
      .populate("customer", "name email")
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
    // .populate("completedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Item successfully removed from work queue",
      data: {
        order: populatedOrder,
        workQueue: workQueueItem
      }
    });

  } catch (error) {
    // Abort transaction
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();

    console.error("Error removing from work queue", error);
    return res.status(400).json({
      success: false,
      message: "Problem removing the item from work queue",
      error: error.message
    });
  }
};


// Helper function to send notification to customer when order is complete
const sendOrderCompletionNotification = async (req, order) => {
  try {
    // Find customer details
    const customer = await User.findById(order.customer);

    if (!customer) {
      console.error("Customer not found for notification");
      return;
    }

    // Create notification
    const notification = new Notification({
      recipient: customer._id,
      title: "Order Completed",
      message: `Your order #${order._id} has been completed.`,
      type: "order_completion",
      metadata: {
        orderId: order._id
      }
    });

    await notification.save();

    // If you have real-time notifications (like Socket.io), emit here
    // io.to(customer._id).emit('new_notification', notification);

    // Optionally, send an email notification
    // await sendEmail(customer.email, "Order Completed", `Your order #${order._id} has been completed.`);

    console.log(`Completion notification sent to customer: ${customer._id}`);
  } catch (error) {
    console.error("Error sending completion notification:", error);
  }
};





exports.downloadCadFile = async (req, res) => {
  try {
    const { documentId, fileIndex } = req.params;


    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }

    // Find the CAD document by ID
    const cadDocument = await Cad.findById(documentId);
    console.log("cad Document is :", cadDocument);

    if (!cadDocument) {
      return res.status(404).json({
        success: false,
        message: "CAD document not found"
      });
    }

    // Get the file path based on type and index
    const index = parseInt(fileIndex);

    if (isNaN(index)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file index"
      });
    }

    const fileType = req.query.type || 'cad'; // Default to CAD file if not specified
    let relativePath;

    if (fileType === 'cad') {
      if (index < 0 || index >= cadDocument.CadFile.length) {
        return res.status(404).json({
          success: false,
          message: "CAD file index out of range"
        });
      }
      relativePath = cadDocument.CadFile[index];
    } else if (fileType === 'image') {
      if (index < 0 || index >= cadDocument.photo.length) {
        return res.status(404).json({
          success: false,
          message: "Image file index out of range"
        });
      }
      relativePath = cadDocument.photo[index];
    } else if (fileType === 'text') {
      if (!cadDocument.textFiles || index < 0 || index >= cadDocument.textFiles.length) {
        return res.status(404).json({
          success: false,
          message: "Text file index out of range"
        });
      }
      relativePath = cadDocument.textFiles[index];
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Must be 'cad', 'image', or 'text'"
      });
    }

    // Convert relative path to absolute file path
    // Remove leading slash if it exists
    const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
    const absolutePath = path.join(__dirname, '..', cleanPath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "File not found on server"
      });
    }

    // Get filename from path
    const filename = path.basename(absolutePath);

    // Set appropriate headers for file download
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();

    if (fileType === 'cad') {
      switch (ext) {
        case '.dwg':
          res.setHeader('Content-Type', 'application/acad');
          break;
        case '.dxf':
          res.setHeader('Content-Type', 'application/dxf');
          break;
        case '.step':
        case '.stp':
          res.setHeader('Content-Type', 'application/step');
          break;
        case '.stl':
          res.setHeader('Content-Type', 'application/vnd.ms-pki.stl');
          break;
        default:
          res.setHeader('Content-Type', 'application/octet-stream');
      }
    } else if (fileType === 'image') {
      switch (ext) {
        case '.jpg':
        case '.jpeg':
          res.setHeader('Content-Type', 'image/jpeg');
          break;
        case '.png':
          res.setHeader('Content-Type', 'image/png');
          break;
        case '.gif':
          res.setHeader('Content-Type', 'image/gif');
          break;
        case '.webp':
          res.setHeader('Content-Type', 'image/webp');
          break;
        default:
          res.setHeader('Content-Type', 'image/jpeg');
      }
    } else if (fileType === 'text') {
      switch (ext) {
        case '.txt':
          res.setHeader('Content-Type', 'text/plain');
          break;
        case '.md':
          res.setHeader('Content-Type', 'text/markdown');
          break;
        case '.pdf':
          res.setHeader('Content-Type', 'application/pdf');
          break;
        case '.doc':
        case '.docx':
          res.setHeader('Content-Type', 'application/msword');
          break;
        case '.rtf':
          res.setHeader('Content-Type', 'application/rtf');
          break;
        case '.odt':
          res.setHeader('Content-Type', 'application/vnd.oasis.opendocument.text');
          break;
        case '.lxd':
          res.setHeader('Content-Type', 'application/octet-stream');
          break;
        default:
          res.setHeader('Content-Type', 'application/octet-stream');
      }
    }

    // Stream the file to the response
    const fileStream = fs.createReadStream(absolutePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error("Error downloading file:", error);
    return res.status(500).json({
      success: false,
      message: "Error downloading file",
      error: error.message
    });
  }
};

// New controller to download all files in a ZIP archive
exports.downloadAllFiles = async (req, res) => {
  console.log("this is download all files controller", req.params);

  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }

    // Find the CAD document by ID
    const cadDocument = await Cad.findById(documentId);
    console.log("this is download all files contr", req.cadDocument);


    if (!cadDocument) {
      return res.status(404).json({
        success: false,
        message: "CAD document not found"
      });
    }

    // Check if we have files to download
    if (cadDocument.CadFile.length === 0 && cadDocument.photo.length === 0 &&
      (!cadDocument.textFiles || cadDocument.textFiles.length === 0)) {
      return res.status(404).json({
        success: false,
        message: "No files found in this document"
      });
    }

    // Set response headers for ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=cad_files_${documentId}.zip`);

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    // Pipe archive to response
    archive.pipe(res);

    // Add all CAD files to archive
    for (let i = 0; i < cadDocument.CadFile.length; i++) {
      const relativePath = cadDocument.CadFile[i];
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(__dirname, '..', cleanPath);

      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        const filename = path.basename(absolutePath);
        // Add file to zip with path: /cad/filename
        archive.file(absolutePath, { name: `cad/${filename}` });
      } else {
        console.warn(`CAD file not found: ${absolutePath}`);
      }
    }

    // Add all image files to archive
    for (let i = 0; i < cadDocument.photo.length; i++) {
      const relativePath = cadDocument.photo[i];
      const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
      const absolutePath = path.join(__dirname, '..', cleanPath);

      // Check if file exists
      if (fs.existsSync(absolutePath)) {
        const filename = path.basename(absolutePath);
        // Add file to zip with path: /images/filename
        archive.file(absolutePath, { name: `images/${filename}` });
      } else {
        console.warn(`Image file not found: ${absolutePath}`);
      }
    }

    // Add all text files to archive (if they exist)
    if (cadDocument.textFiles && cadDocument.textFiles.length > 0) {
      for (let i = 0; i < cadDocument.textFiles.length; i++) {
        const relativePath = cadDocument.textFiles[i];
        const cleanPath = relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        const absolutePath = path.join(__dirname, '..', cleanPath);

        // Check if file exists
        if (fs.existsSync(absolutePath)) {
          const filename = path.basename(absolutePath);
          // Add file to zip with path: /text/filename
          archive.file(absolutePath, { name: `text/${filename}` });
        } else {
          console.warn(`Text file not found: ${absolutePath}`);
        }
      }
    }

    // Finalize archive
    archive.finalize();

  } catch (error) {
    console.error("Error downloading files:", error);
    return res.status(500).json({
      success: false,
      message: "Error downloading files",
      error: error.message
    });
  }
};


// Get all files for a specific order (updated to include download all links)
exports.getFilesByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    // Find CAD documents by order ID
    const cadDocuments = await Cad.find({ order: orderId });

    if (!cadDocuments || cadDocuments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files found for this order"
      });
    }

    // Format response with file information
    const result = cadDocuments.map(doc => {
      return {
        id: doc._id,
        cadFiles: doc.CadFile.map((path, index) => ({
          index,
          path,
          filename: path.split('/').pop(),
          downloadUrl: `/api/files/download/${doc._id}/${index}?type=cad`
        })),
        images: doc.photo.map((path, index) => ({
          index,
          path,
          filename: path.split('/').pop(),
          downloadUrl: `/api/files/download/${doc._id}/${index}?type=image`
        })),
        textFiles: (doc.textFiles || []).map((path, index) => ({
          index,
          path,
          filename: path.split('/').pop(),
          downloadUrl: `/api/files/download/${doc._id}/${index}?type=text`
        })),
        createdAt: doc.createdAt,
        // Add links to download all files
        downloadAllFilesUrl: `/api/files/download-all/${doc._id}`,
        downloadAllCadFilesUrl: `/api/files/download-all/${doc._id}?type=cad`,
        downloadAllImagesUrl: `/api/files/download-all/${doc._id}?type=image`,
        downloadAllTextFilesUrl: `/api/files/download-all/${doc._id}?type=text`
      };
    });

    return res.status(200).json({
      success: true,
      count: cadDocuments.length,
      data: result
    });

  } catch (error) {
    console.error("Error fetching files:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching files",
      error: error.message
    });
  }
};

exports.deleteCadFileOrPhotoByIndex = async (req, res) => {
  try {
    const { orderId, type, index } = req.body; // type = 'photo', 'CadFile', or 'textFiles'
    const userId = req.user.id;

    // Step 1: Validate order and user
    const order = await Order.findOne({
      _id: orderId,
      assignedTo: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or not assigned to this user",
      });
    }

    // Step 2: Fetch all CAD docs for this order
    const cadDocs = await Cad.find({ order: orderId });

    if (!cadDocs || cadDocs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No CAD entries found for this order",
      });
    }

    // Step 3: Validate type
    if (!['photo', 'CadFile', 'textFiles'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'photo', 'CadFile', or 'textFiles'.",
      });
    }

    // Step 4: Count total files of that type across all documents
    let totalFiles = cadDocs.reduce((sum, doc) => sum + (doc[type]?.length || 0), 0);

    // Only enforce minimum file requirement for CAD files and photos, not text files
    if ((type === 'photo' || type === 'CadFile') && totalFiles <= 1) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete the last remaining ${type}. At least one must remain.`,
      });
    }

    // Step 5: Locate the document and remove the file at the given index
    let currentIndex = 0;
    for (const doc of cadDocs) {
      const filesArray = doc[type] || [];
      if (index < currentIndex + filesArray.length) {
        const relativeIndex = index - currentIndex;
        const removedFile = filesArray.splice(relativeIndex, 1);
        await doc.save();

        return res.status(200).json({
          success: true,
          message: `${type} at index ${index} deleted successfully`,
          removed: removedFile[0],
          updatedCad: doc,
        });
      }
      currentIndex += filesArray.length;
    }

    // If we reach here, index was out of bounds
    return res.status(400).json({
      success: false,
      message: "Invalid index for deletion",
    });

  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// const mongoose = require("mongoose");

// const gallerySchema = new mongoose.Schema({
//   orderId: {
//     type: String,
//     required: true,
//     index: true
//   },
//   order: {
//     type: mongoose.Types.ObjectId,
//     ref: "Order",
//     required: true
//   },
//   cadFile: {
//     type: String,
//     required: true
//   },
//   image: {
//     type: String,
//     required: true
//   },
//   cadFileName: {
//     type: String,
//     required: true
//   },
//   imageName: {
//     type: String,
//     required: true
//   },
//   uploadedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },
//   uploadDate: {
//     type: Date,
//     default: Date.now
//   },
//   // Keep track of original CAD document for reference
//   originalCadDoc: {
//     type: mongoose.Types.ObjectId,
//     ref: "Cad"
//   },
//   // Additional metadata
//   fileSize: {
//     cadFileSize: Number,
//     imageSize: Number
//   },
//   mimeTypes: {
//     cadMimeType: String,
//     imageMimeType: String
//   },
//   tags: [{
//     type: String
//   }],
//   description: {
//     type: String
//   },
//   isActive: {
//     type: Boolean,
//     default: true
//   }
// }, { timestamps: true });

// // Compound index for efficient queries
// gallerySchema.index({ orderId: 1, createdAt: -1 });
// gallerySchema.index({ order: 1, uploadDate: -1 });

// // Static method to create gallery entries
// gallerySchema.statics.createGalleryEntries = async function(orderId, order, cadFiles, images, uploadedBy, originalCadDoc) {
//   const galleryEntries = [];
  
//   // Ensure we have equal number of CAD files and images
//   const minLength = Math.min(cadFiles.length, images.length);
  
//   for (let i = 0; i < minLength; i++) {
//     const galleryEntry = {
//       orderId: orderId,
//       order: order,
//       cadFile: cadFiles[i],
//       image: images[i],
//       cadFileName: cadFiles[i].split('/').pop(),
//       imageName: images[i].split('/').pop(),
//       uploadedBy: uploadedBy,
//       originalCadDoc: originalCadDoc
//     };
    
//     galleryEntries.push(galleryEntry);
//   }
  
//   return await this.insertMany(galleryEntries);
// };

// // Instance method to get paired items
// gallerySchema.methods.getPairedItem = function() {
//   return {
//     cadFile: this.cadFile,
//     image: this.image,
//     cadFileName: this.cadFileName,
//     imageName: this.imageName
//   };
// };

// module.exports = mongoose.model("Gallery", gallerySchema);

const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    index: true
  },
  order: {
    type: mongoose.Types.ObjectId,
    ref: "Order",
    required: false // Changed to false to allow null for direct DB uploads
  },
  cadFile: {
    type: String,
    required: false // Changed to false to allow empty CAD files
  },
  image: {
    type: String,
    required: true
  },
  cadFileName: {
    type: String,
    required: false // Changed to false to allow empty CAD file names
  },
  imageName: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  // Keep track of original CAD document for reference
  originalCadDoc: {
    type: mongoose.Types.ObjectId,
    ref: "Cad"
  },
  // Additional metadata
  fileSize: {
    cadFileSize: Number,
    imageSize: Number
  },
  mimeTypes: {
    cadMimeType: String,
    imageMimeType: String
  },
  tags: [{
    type: String
  }],
  description: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Compound index for efficient queries
gallerySchema.index({ orderId: 1, createdAt: -1 });
gallerySchema.index({ order: 1, uploadDate: -1 });


gallerySchema.statics.createGalleryEntries = async function(orderId, order, cadFiles, images, uploadedBy, originalCadDoc) {
  const galleryEntries = [];
  
  // Handle case where there are no CAD files
  if (cadFiles.length === 0) {
    // Create gallery entries for images only
    for (let i = 0; i < images.length; i++) {
      const galleryEntry = {
        orderId: orderId,
        order: order,
        cadFile: '', // Empty CAD file
        image: images[i],
        cadFileName: '',
        imageName: images[i].split('/').pop(),
        uploadedBy: uploadedBy,
        originalCadDoc: originalCadDoc
      };
      
      galleryEntries.push(galleryEntry);
    }
  } else {
    // Original logic for paired entries
    const minLength = Math.min(cadFiles.length, images.length);
    
    for (let i = 0; i < minLength; i++) {
      const galleryEntry = {
        orderId: orderId,
        order: order,
        cadFile: cadFiles[i],
        image: images[i],
        cadFileName: cadFiles[i].split('/').pop(),
        imageName: images[i].split('/').pop(),
        uploadedBy: uploadedBy,
        originalCadDoc: originalCadDoc
      };
      
      galleryEntries.push(galleryEntry);
    }
    
    for (let i = minLength; i < images.length; i++) {
      const galleryEntry = {
        orderId: orderId,
        order: order,
        cadFile: '', // Empty CAD file for extra images
        image: images[i],
        cadFileName: '',
        imageName: images[i].split('/').pop(),
        uploadedBy: uploadedBy,
        originalCadDoc: originalCadDoc
      };
      
      galleryEntries.push(galleryEntry);
    }
  }
  
  return await this.insertMany(galleryEntries);
};

// Instance method to get paired items
gallerySchema.methods.getPairedItem = function() {
  return {
    cadFile: this.cadFile,
    image: this.image,
    cadFileName: this.cadFileName,
    imageName: this.imageName
  };
};

module.exports = mongoose.model("Gallery", gallerySchema);
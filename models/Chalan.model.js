const mongoose = require("mongoose");

const challanSchema = new mongoose.Schema({
  challanNumber: {
    type: String,
    unique: true,
    required: false,
  },
  order: {
    type: mongoose.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  transporterName: {
    type: String,
    required: true,
  },
  transporterContact: {
    type: String,
    required: true,
  },
  transporterAddress: {
    type: String,
  },
  materialQuantity: {
    type: String,
  },
  squareFeet: {
    type: Number,
  },
  weightInKg: {
    type: Number,
  },
  bundles: {
    type: Number,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
}, { timestamps: true });

// Pre-save hook to auto-generate challanNumber
challanSchema.pre("save", async function (next) {
  if (this.isNew && !this.challanNumber) {
    try {
      const lastChallan = await mongoose.model("Challan")
        .findOne({})
        .sort({ createdAt: -1 })
        .select("challanNumber");

      let nextNumber = 1;

      if (lastChallan && lastChallan.challanNumber) {
        const parts = lastChallan.challanNumber.split("-");
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          nextNumber = lastSeq + 1;
        }
      }

      const formattedNumber = String(nextNumber).padStart(5, "0");
      this.challanNumber = `BSCS-CH-${formattedNumber}`;

      next();
    } catch (err) {
      next(err);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model("Challan", challanSchema);

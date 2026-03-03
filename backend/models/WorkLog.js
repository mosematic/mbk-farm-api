const mongoose = require('mongoose');

const workLogSchema = new mongoose.Schema({
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  checkIn: {
    type: Date,
    required: true
  },
  checkOut: Date,
  hoursWorked: Number,
  tasks: [{
    description: String,
    category: {
      type: String,
      enum: ['feeding', 'cleaning', 'medical', 'maintenance', 'harvesting', 'planting', 'general', 'other']
    },
    completed: {
      type: Boolean,
      default: false
    }
  }],
  notes: String,
  overtime: {
    type: Number,
    default: 0
  },
  approved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Calculate hours worked before saving
workLogSchema.pre('save', function(next) {
  if (this.checkIn && this.checkOut) {
    const diffMs = this.checkOut - this.checkIn;
    this.hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }
  next();
});

module.exports = mongoose.model('WorkLog', workLogSchema);
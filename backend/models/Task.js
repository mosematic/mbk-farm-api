const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  
  // Task Type
  category: {
    type: String,
    required: true,
    enum: [
      'feeding', 'watering', 'health_check', 'medication', 'vaccination',
      'breeding', 'milking', 'egg_collection', 'cleaning', 'maintenance',
      'planting', 'weeding', 'fertilizing', 'harvesting', 'irrigation',
      'pest_control', 'equipment_maintenance', 'fence_repair',
      'record_keeping', 'inventory', 'sales', 'purchasing', 'other'
    ]
  },
  
  // Assignment
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Related Items
  relatedLivestock: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' }],
  relatedCrops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Crop' }],
  relatedFields: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Field' }],
  relatedEquipment: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Equipment' }],
  
  // Scheduling
  dueDate: Date,
  startTime: Date,
  endTime: Date,
  estimatedDuration: Number, // in minutes
  actualDuration: Number,
  
  // Recurrence
  recurring: {
    type: Boolean,
    default: false
  },
  recurrencePattern: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'] },
    interval: Number,
    endDate: Date,
    daysOfWeek: [Number], // 0-6 for Sunday-Saturday
    dayOfMonth: Number
  },
  
  // Priority & Status
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'cancelled', 'overdue'],
    default: 'pending'
  },
  
  // Completion
  completedDate: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  completionNotes: String,
  
  // Resources
  supplies: [{
    item: String,
    quantity: Number,
    unit: String,
    cost: Number
  }],
  laborHours: Number,
  
  // Cost Tracking
  estimatedCost: Number,
  actualCost: Number,
  
  // Checklist
  checklist: [{
    item: String,
    completed: { type: Boolean, default: false },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: Date
  }],
  
  // Location
  location: String,
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  
  // Attachments
  photos: [String],
  documents: [{
    name: String,
    url: String,
    type: String
  }],
  
  // Notifications
  notifications: [{
    type: { type: String, enum: ['email', 'sms', 'push'] },
    sentTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentAt: Date,
    status: String
  }],
  
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Index for querying
taskSchema.index({ dueDate: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Task', taskSchema);
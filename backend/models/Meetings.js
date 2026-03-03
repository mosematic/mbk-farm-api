const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a meeting title']
  },
  type: {
    type: String,
    enum: ['board_meeting', 'staff_meeting', 'emergency', 'agm', 'other'],
    default: 'board_meeting'
  },
  date: {
    type: Date,
    required: true
  },
  startTime: String,
  endTime: String,
  location: String,
  isVirtual: {
    type: Boolean,
    default: false
  },
  meetingLink: String,
  attendees: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    attended: {
      type: Boolean,
      default: false
    },
    role: String
  }],
  agenda: [{
    item: String,
    presenter: String,
    duration: Number,
    discussed: {
      type: Boolean,
      default: false
    }
  }],
  minutes: {
    content: String,
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  decisions: [{
    decision: String,
    proposedBy: String,
    secondedBy: String,
    votesFor: Number,
    votesAgainst: Number,
    abstentions: Number,
    passed: Boolean
  }],
  actionItems: [{
    task: String,
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deadline: Date,
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'overdue'],
      default: 'pending'
    }
  }],
  documents: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  nextMeetingDate: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', meetingSchema);
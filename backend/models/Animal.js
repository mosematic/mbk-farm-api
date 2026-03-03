const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
  tag: {
    type: String,
    required: [true, 'Please add an animal tag/ID'],
    unique: true
  },
  name: String,
  type: {
    type: String,
    required: true,
    enum: ['cattle', 'goat', 'sheep', 'pig', 'chicken', 'duck', 'turkey', 'rabbit', 'other']
  },
  breed: String,
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  dateOfBirth: Date,
  dateAcquired: {
    type: Date,
    default: Date.now
  },
  acquisitionType: {
    type: String,
    enum: ['born', 'purchased', 'donated', 'transferred'],
    default: 'purchased'
  },
  acquisitionPrice: {
    type: Number,
    default: 0
  },
  weight: Number,
  healthStatus: {
    type: String,
    enum: ['healthy', 'sick', 'recovering', 'quarantine', 'deceased'],
    default: 'healthy'
  },
  location: String,
  mother: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  father: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  notes: String,
  vaccinations: [{
    name: String,
    date: Date,
    nextDue: Date,
    administeredBy: String
  }],
  medicalHistory: [{
    condition: String,
    treatment: String,
    date: Date,
    vet: String,
    cost: Number
  }],
  images: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  disposalDate: Date,
  disposalType: {
    type: String,
    enum: ['sold', 'deceased', 'transferred', 'slaughtered', null]
  },
  disposalPrice: Number,
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Animal', animalSchema);
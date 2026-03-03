const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  // Identification
  name: {
    type: String,
    required: true
  },
  fieldNumber: String,
  
  // Size
  size: {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['acres', 'hectares', 'sq_meters'], default: 'acres' }
  },
  
  // Location
  location: String,
  coordinates: {
    latitude: Number,
    longitude: Number
  },
  boundaries: [{
    latitude: Number,
    longitude: Number
  }],
  
  // Type & Use
  type: {
    type: String,
    enum: ['cropland', 'pasture', 'woodland', 'fallow', 'orchard', 'buildings', 'water', 'other']
  },
  currentUse: String,
  
  // Soil
  soilType: String,
  soilPH: Number,
  drainage: {
    type: String,
    enum: ['excellent', 'good', 'moderate', 'poor']
  },
  
  // Crops/Livestock
  currentCrops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Crop' }],
  currentLivestock: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' }],
  
  // Crop Rotation
  rotationHistory: [{
    crop: String,
    plantDate: Date,
    harvestDate: Date,
    yield: Number
  }],
  
  // Infrastructure
  irrigation: {
    available: Boolean,
    type: String,
    lastMaintenance: Date
  },
  fencing: {
    available: Boolean,
    type: String,
    condition: String,
    lastMaintenance: Date
  },
  structures: [String],
  
  // Tasks
  lastTillage: Date,
  lastFertilization: Date,
  lastPestControl: Date,
  
  notes: String,
  images: [String],
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending'],
    default: 'active'
  },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Field', fieldSchema);
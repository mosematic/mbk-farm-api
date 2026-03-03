const mongoose = require('mongoose');

const livestockSchema = new mongoose.Schema({
  // Identification
  tagId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: String,
  visualId: String, // e.g., "Red cow with white spot"
  electronicId: String, // RFID tag
  tattoo: String,
  
  // Basic Info
  species: {
    type: String,
    required: true,
    enum: ['cattle', 'goat', 'sheep', 'pig', 'chicken', 'duck', 'turkey', 'rabbit', 'guinea_fowl', 'fish', 'other']
  },
  breed: String,
  sex: {
    type: String,
    enum: ['male', 'female', 'unknown'],
    required: true
  },
  purpose: {
    type: String,
    enum: ['meat', 'dairy', 'eggs', 'breeding', 'dual_purpose', 'work', 'companion', 'other']
  },
  
  // Dates
  birthDate: Date,
  purchaseDate: Date,
  weaningDate: Date,
  retirementDate: Date,
  deathDate: Date,
  
  // Physical Attributes
  weight: [{
    value: Number,
    unit: { type: String, default: 'kg' },
    date: { type: Date, default: Date.now },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  height: Number,
  color: String,
  markings: String,
  
  // Genetics
  dam: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' }, // Mother
  sire: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' }, // Father
  offspring: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' }],
  
  // Acquisition
  acquisitionType: {
    type: String,
    enum: ['purchased', 'born_on_farm', 'donated', 'transferred', 'inherited'],
    default: 'purchased'
  },
  acquisitionCost: Number,
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  
  // Location & Management
  currentLocation: {
    type: String,
    required: true
  },
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  group: String, // Herd/Flock name
  status: {
    type: String,
    enum: ['active', 'sold', 'deceased', 'butchered', 'transferred', 'missing'],
    default: 'active'
  },
  
  // Health
  healthStatus: {
    type: String,
    enum: ['healthy', 'sick', 'injured', 'quarantine', 'recovering', 'pregnant', 'lactating'],
    default: 'healthy'
  },
  vetRecords: [{
    date: Date,
    type: String, // checkup, treatment, vaccination, surgery
    description: String,
    veterinarian: String,
    diagnosis: String,
    treatment: String,
    medication: String,
    dosage: String,
    cost: Number,
    nextVisit: Date,
    notes: String
  }],
  vaccinations: [{
    vaccine: String,
    date: Date,
    batchNumber: String,
    administeredBy: String,
    nextDue: Date,
    cost: Number
  }],
  
  // Breeding
  breeding: {
    breedingStatus: {
      type: String,
      enum: ['available', 'pregnant', 'nursing', 'retired', 'not_breeding']
    },
    lastBreedingDate: Date,
    expectedDeliveryDate: Date,
    deliveries: [{
      date: Date,
      numberOfOffspring: Number,
      offspring: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' }],
      complications: String,
      assistedBy: String
    }]
  },
  
  // Production (for dairy, eggs, etc.)
  production: [{
    date: Date,
    type: String, // milk, eggs, wool, etc.
    quantity: Number,
    unit: String,
    quality: String,
    notes: String
  }],
  
  // Financial
  estimatedValue: Number,
  insurancePolicy: String,
  insuranceValue: Number,
  
  // Feeding
  feedingSchedule: {
    frequency: String,
    feedType: [String],
    amount: String,
    specialDiet: String
  },
  
  // Disposal Info
  disposalInfo: {
    date: Date,
    type: { type: String, enum: ['sold', 'butchered', 'deceased', 'transferred'] },
    reason: String,
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    salePrice: Number,
    weight: Number,
    notes: String
  },
  
  // Attachments
  images: [String],
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadDate: Date
  }],
  
  // Metadata
  tags: [String],
  customFields: mongoose.Schema.Types.Mixed,
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for age
livestockSchema.virtual('age').get(function() {
  if (!this.birthDate) return null;
  const ageMs = Date.now() - this.birthDate.getTime();
  const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  const ageMonths = Math.floor((ageMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
  return { years: ageYears, months: ageMonths };
});

// Virtual for current weight
livestockSchema.virtual('currentWeight').get(function() {
  if (!this.weight || this.weight.length === 0) return null;
  return this.weight[this.weight.length - 1];
});

// Method to calculate total cost
livestockSchema.methods.getTotalCost = function() {
  const vetCosts = this.vetRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
  const vaccineCosts = this.vaccinations.reduce((sum, vax) => sum + (vax.cost || 0), 0);
  return (this.acquisitionCost || 0) + vetCosts + vaccineCosts;
};

module.exports = mongoose.model('Livestock', livestockSchema);
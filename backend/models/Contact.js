const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  // Basic Info
  type: {
    type: String,
    enum: ['customer', 'supplier', 'both', 'veterinarian', 'contractor', 'other'],
    required: true
  },
  businessName: String,
  contactPerson: {
    firstName: String,
    lastName: String,
    title: String
  },
  
  // Contact Details
  email: {
    type: String,
    lowercase: true,
    trim: true
  },
  phone: {
    primary: String,
    secondary: String,
    whatsapp: String
  },
  
  // Address
  address: {
    street: String,
    city: String,
    district: String,
    region: String,
    country: { type: String, default: 'Uganda' },
    postalCode: String
  },
  
  // Business Details
  taxId: String,
  businessLicense: String,
  
  // Relationship
  category: [String], // e.g., ['feed_supplier', 'vet_services']
  tags: [String],
  
  // Financial
  creditLimit: Number,
  paymentTerms: String,
  accountBalance: {
    type: Number,
    default: 0
  },
  
  // History
  transactions: [{
    type: { type: String, enum: ['sale', 'purchase', 'payment', 'credit'] },
    date: Date,
    amount: Number,
    reference: String,
    balance: Number
  }],
  
  // Stats
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  lastContactDate: Date,
  lastPurchaseDate: Date,
  lastSaleDate: Date,
  
  // Preferences
  preferredCommunication: {
    type: String,
    enum: ['email', 'phone', 'sms', 'whatsapp']
  },
  language: {
    type: String,
    default: 'English'
  },
  
  // Notes
  notes: String,
  internalNotes: String,
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  
  // Attachments
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadDate: Date
  }],
  
  // Ratings
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  customFields: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Method to get full name
contactSchema.virtual('fullName').get(function() {
  if (this.businessName) return this.businessName;
  if (this.contactPerson && this.contactPerson.firstName) {
    return `${this.contactPerson.firstName} ${this.contactPerson.lastName || ''}`.trim();
  }
  return 'Unnamed Contact';
});

module.exports = mongoose.model('Contact', contactSchema);
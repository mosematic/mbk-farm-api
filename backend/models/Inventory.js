const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  // Item Info
  itemName: {
    type: String,
    required: true
  },
  itemCode: {
    type: String,
    unique: true,
    sparse: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'feed', 'hay', 'grain', 'supplements', 'bedding',
      'medication', 'vaccines', 'veterinary_supplies',
      'seeds', 'fertilizer', 'pesticides', 'herbicides',
      'tools', 'equipment_parts', 'fencing', 'hardware',
      'cleaning_supplies', 'packaging', 'other'
    ]
  },
  subcategory: String,
  
  // Quantity
  currentQuantity: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    enum: ['kg', 'g', 'lbs', 'liters', 'gallons', 'bags', 'bales', 'pieces', 'boxes', 'bottles', 'other']
  },
  
  // Reorder Levels
  minimumQuantity: {
    type: Number,
    default: 0
  },
  reorderPoint: Number,
  reorderQuantity: Number,
  maximumQuantity: Number,
  
  // Location
  storageLocation: String,
  field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
  
  // Pricing
  averageCost: Number,
  lastPurchasePrice: Number,
  totalValue: Number,
  
  // Supplier
  preferredSupplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
  suppliers: [{
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    price: Number,
    lastOrderDate: Date
  }],
  
  // Product Details
  brand: String,
  manufacturer: String,
  sku: String,
  barcode: String,
  
  // Dates
  expirationDate: Date,
  lastRestockDate: Date,
  
  // Transaction History
  transactions: [{
    type: { type: String, enum: ['purchase', 'usage', 'adjustment', 'waste', 'sale'] },
    quantity: Number,
    date: { type: Date, default: Date.now },
    reason: String,
    cost: Number,
    relatedTo: String, // Reference to task, animal, etc.
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }],
  
  // Batch/Lot Tracking
  batches: [{
    batchNumber: String,
    quantity: Number,
    purchaseDate: Date,
    expirationDate: Date,
    cost: Number,
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }
  }],
  
  // Alerts
  lowStockAlert: {
    enabled: { type: Boolean, default: true },
    threshold: Number
  },
  expirationAlert: {
    enabled: { type: Boolean, default: true },
    daysBefore: { type: Number, default: 30 }
  },
  
  // Additional Info
  description: String,
  usageInstructions: String,
  safetyNotes: String,
  
  // Attachments
  images: [String],
  documents: [{
    name: String,
    url: String,
    type: String
  }],
  
  tags: [String],
  active: { type: Boolean, default: true },
  customFields: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Calculate total value before save
inventorySchema.pre('save', function(next) {
  if (this.currentQuantity && this.averageCost) {
    this.totalValue = this.currentQuantity * this.averageCost;
  }
  next();
});

// Method to check if reorder is needed
inventorySchema.methods.needsReorder = function() {
  return this.reorderPoint && this.currentQuantity <= this.reorderPoint;
};

// Method to check if expired or expiring soon
inventorySchema.methods.isExpiring = function(days = 30) {
  if (!this.expirationDate) return false;
  const daysUntilExpiration = Math.ceil((this.expirationDate - Date.now()) / (1000 * 60 * 60 * 24));
  return daysUntilExpiration <= days && daysUntilExpiration >= 0;
};

module.exports = mongoose.model('Inventory', inventorySchema);
const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  // Sale Info
  saleNumber: {
    type: String,
    unique: true,
    required: true
  },
  saleDate: {
    type: Date,
    default: Date.now
  },
  
  // Customer
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contact',
    required: true
  },
  
  // Items
  items: [{
    type: { type: String, enum: ['livestock', 'produce', 'product', 'service'] },
    livestock: { type: mongoose.Schema.Types.ObjectId, ref: 'Livestock' },
    crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' },
    inventory: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory' },
    description: String,
    quantity: { type: Number, required: true },
    unit: String,
    unitPrice: { type: Number, required: true },
    totalPrice: Number,
    weight: Number,
    grade: String
  }],
  
  // Pricing
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    amount: Number,
    percentage: Number,
    reason: String
  },
  shippingCost: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  
  // Payment
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mtn_mobile_money', 'airtel_money', 'cheque', 'credit', 'other']
  },
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_60', 'custom']
  },
  dueDate: Date,
  
  payments: [{
    date: Date,
    amount: Number,
    method: String,
    reference: String,
    notes: String
  }],
  
  // Delivery
  deliveryMethod: {
    type: String,
    enum: ['pickup', 'delivery', 'shipping']
  },
  deliveryDate: Date,
  deliveryAddress: {
    street: String,
    city: String,
    district: String,
    country: { type: String, default: 'Uganda' },
    postalCode: String
  },
  deliveryNotes: String,
  deliveryStatus: {
    type: String,
    enum: ['pending', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending'
  },
  
  // Invoice
  invoiceNumber: String,
  invoiceDate: Date,
  
  // Marketplace (if applicable)
  marketplace: {
    name: String, // e.g., "Kampala Market", "Farm Gate"
    location: String,
    commission: Number
  },
  
  // Notes & Attachments
  notes: String,
  internalNotes: String,
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  
  // Tracking
  status: {
    type: String,
    enum: ['draft', 'confirmed', 'completed', 'cancelled'],
    default: 'confirmed'
  },
  
  tags: [String],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Calculate totals before save
saleSchema.pre('save', function(next) {
  // Calculate item totals
  this.items.forEach(item => {
    item.totalPrice = item.quantity * item.unitPrice;
  });
  
  // Calculate subtotal
  this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
  
  // Calculate discount
  let discountAmount = 0;
  if (this.discount) {
    if (this.discount.percentage) {
      discountAmount = this.subtotal * (this.discount.percentage / 100);
    } else if (this.discount.amount) {
      discountAmount = this.discount.amount;
    }
  }
  
  // Calculate total
  this.totalAmount = this.subtotal - discountAmount + (this.tax || 0) + (this.shippingCost || 0);
  
  next();
});

// Generate sale number
saleSchema.pre('save', async function(next) {
  if (!this.saleNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.saleNumber = `SALE-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
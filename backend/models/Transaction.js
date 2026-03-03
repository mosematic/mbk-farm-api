const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Income categories
      'animal_sale', 'product_sale', 'donation', 'grant', 'other_income',
      // Expense categories
      'animal_purchase', 'feed', 'medicine', 'equipment', 'salary', 
      'utilities', 'maintenance', 'transport', 'seeds', 'fertilizer', 'other_expense'
    ]
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'UGX'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'bank_transfer', 'mtn_mobile_money', 'airtel_money', 'cheque'],
    required: true
  },
  paymentDetails: {
    accountNumber: String,
    transactionId: String,
    bankName: String,
    mobileNumber: String
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  receipt: String,
  relatedAnimal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Animal'
  },
  vendor: {
    name: String,
    contact: String
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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

module.exports = mongoose.model('Transaction', transactionSchema);
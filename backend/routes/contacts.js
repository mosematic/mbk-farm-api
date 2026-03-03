const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/contacts
// @desc    Get all contacts
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { type, status, search } = req.query;
    let query = {};

    if (type) {
      if (type.includes(',')) {
        query.type = { $in: type.split(',') };
      } else {
        query.type = type;
      }
    }
    
    if (status) query.status = status;
    
    if (search) {
      query.$or = [
        { businessName: { $regex: search, $options: 'i' } },
        { 'contactPerson.firstName': { $regex: search, $options: 'i' } },
        { 'contactPerson.lastName': { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .sort({ businessName: 1, 'contactPerson.firstName': 1 });

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/contacts/stats
// @desc    Get contact statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const stats = {
      total: await Contact.countDocuments({ status: 'active' }),
      customers: await Contact.countDocuments({ 
        type: { $in: ['customer', 'both'] },
        status: 'active'
      }),
      suppliers: await Contact.countDocuments({ 
        type: { $in: ['supplier', 'both'] },
        status: 'active'
      }),
      veterinarians: await Contact.countDocuments({ 
        type: 'veterinarian',
        status: 'active'
      }),
      topCustomers: await Contact.find({ 
        type: { $in: ['customer', 'both'] }
      })
        .sort({ totalSales: -1 })
        .limit(5)
        .select('fullName businessName totalSales'),
      
      topSuppliers: await Contact.find({ 
        type: { $in: ['supplier', 'both'] }
      })
        .sort({ totalPurchases: -1 })
        .limit(5)
        .select('fullName businessName totalPurchases')
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/contacts/:id
// @desc    Get single contact
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/contacts
// @desc    Create new contact
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const contact = await Contact.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/contacts/:id
// @desc    Update contact
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/contacts/:id/transaction
// @desc    Add transaction to contact
// @access  Private
router.post('/:id/transaction', protect, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const transaction = {
      type: req.body.type,
      date: req.body.date || new Date(),
      amount: req.body.amount,
      reference: req.body.reference
    };

    // Update balance
    if (transaction.type === 'sale') {
      contact.accountBalance += transaction.amount;
    } else if (transaction.type === 'payment') {
      contact.accountBalance -= transaction.amount;
    } else if (transaction.type === 'purchase') {
      contact.accountBalance -= transaction.amount;
    } else if (transaction.type === 'credit') {
      contact.accountBalance += transaction.amount;
    }

    transaction.balance = contact.accountBalance;
    contact.transactions.push(transaction);
    contact.lastContactDate = new Date();

    await contact.save();

    res.json(contact);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/contacts/:id
// @desc    Delete contact (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({ message: 'Contact deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/contacts/:id/history
// @desc    Get contact transaction history
// @access  Private
router.get('/:id/history', protect, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .select('transactions fullName businessName');

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({
      contact: {
        name: contact.fullName,
        businessName: contact.businessName
      },
      transactions: contact.transactions.sort((a, b) => b.date - a.date)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
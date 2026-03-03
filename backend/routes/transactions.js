const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/transactions
// @desc    Get all transactions
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { type, category, paymentMethod, startDate, endDate, approved } = req.query;
    let query = {};

    if (type) query.type = type;
    if (category) query.category = category;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (approved !== undefined) query.approved = approved === 'true';
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(query)
      .populate('recordedBy', 'name')
      .populate('approvedBy', 'name')
      .populate('relatedAnimal', 'tag name type')
      .sort({ date: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/transactions/summary
// @desc    Get financial summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const { year, month } = req.query;
    
    let matchQuery = {};
    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      matchQuery.date = { $gte: startDate, $lte: endDate };
    }

    // Total income and expenses
    const totals = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    // By category
    const byCategory = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { type: '$type', category: '$category' },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // By payment method
    const byPaymentMethod = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly trend (last 12 months)
    const monthlyTrend = await Transaction.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 24 }
    ]);

    const income = totals.find(t => t._id === 'income')?.total || 0;
    const expenses = totals.find(t => t._id === 'expense')?.total || 0;

    res.json({
      totalIncome: income,
      totalExpenses: expenses,
      netBalance: income - expenses,
      byCategory,
      byPaymentMethod,
      monthlyTrend
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/transactions
// @desc    Add transaction
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const transaction = await Transaction.create({
      ...req.body,
      recordedBy: req.user._id
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/transactions/:id/approve
// @desc    Approve transaction
// @access  Private/Admin
router.put('/:id/approve', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { approved: true, approvedBy: req.user._id },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
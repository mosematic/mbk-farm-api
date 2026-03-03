const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Livestock = require('../models/Livestock');
const Contact = require('../models/Contact');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/sales
// @desc    Get all sales
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, paymentStatus, customer, startDate, endDate } = req.query;
    let query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (customer) query.customer = customer;
    
    if (startDate && endDate) {
      query.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const sales = await Sale.find(query)
      .populate('customer', 'fullName businessName email phone')
      .populate('items.livestock', 'tagId name species')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ saleDate: -1 });

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sales/stats
// @desc    Get sales statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const stats = {
      totalSales: await Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $ne: 'cancelled' }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).then(result => result[0]?.total || 0),
      
      totalOrders: await Sale.countDocuments({
        saleDate: { $gte: startOfMonth, $lte: endOfMonth },
        status: { $ne: 'cancelled' }
      }),

      pendingPayment: await Sale.aggregate([
        {
          $match: {
            paymentStatus: { $in: ['pending', 'partial'] }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).then(result => result[0]?.total || 0),

      pendingCount: await Sale.countDocuments({
        paymentStatus: { $in: ['pending', 'partial'] }
      }),

      averageSale: await Sale.aggregate([
        {
          $match: {
            saleDate: { $gte: startOfMonth, $lte: endOfMonth },
            status: { $ne: 'cancelled' }
          }
        },
        { $group: { _id: null, avg: { $avg: '$totalAmount' } } }
      ]).then(result => result[0]?.avg || 0),

      byMonth: await Sale.aggregate([
        {
          $match: {
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$saleDate' },
              month: { $month: '$saleDate' }
            },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 }
      ])
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sales/:id
// @desc    Get single sale
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'fullName businessName email phone address')
      .populate('items.livestock', 'tagId name species breed')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name');

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/sales
// @desc    Create new sale
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const sale = await Sale.create({
      ...req.body,
      createdBy: req.user._id
    });

    // Update livestock status if livestock sold
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        if (item.type === 'livestock' && item.livestock) {
          await Livestock.findByIdAndUpdate(item.livestock, {
            status: 'sold',
            'disposalInfo.date': sale.saleDate,
            'disposalInfo.type': 'sold',
            'disposalInfo.buyer': sale.customer,
            'disposalInfo.salePrice': item.unitPrice,
            'disposalInfo.weight': item.weight
          });
        }
      }
    }

    // Update customer stats
    await Contact.findByIdAndUpdate(sale.customer, {
      $inc: { 
        totalSales: sale.totalAmount,
        accountBalance: sale.paymentStatus === 'paid' ? 0 : sale.totalAmount
      },
      lastSaleDate: sale.saleDate
    });

    const populatedSale = await Sale.findById(sale._id)
      .populate('customer', 'fullName businessName')
      .populate('items.livestock', 'tagId name');

    res.status(201).json(populatedSale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/sales/:id
// @desc    Update sale
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const sale = await Sale.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('customer', 'fullName businessName');

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/sales/:id/payment
// @desc    Add payment to sale
// @access  Private
router.post('/:id/payment', protect, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const payment = {
      date: req.body.date || new Date(),
      amount: req.body.amount,
      method: req.body.method,
      reference: req.body.reference,
      notes: req.body.notes
    };

    sale.payments.push(payment);

    // Calculate total paid
    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);

    // Update payment status
    if (totalPaid >= sale.totalAmount) {
      sale.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      sale.paymentStatus = 'partial';
    }

    // Update customer balance
    await Contact.findByIdAndUpdate(sale.customer, {
      $inc: { accountBalance: -payment.amount }
    });

    await sale.save();

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/sales/:id/status
// @desc    Update sale status
// @access  Private
router.put('/:id/status', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    sale.status = req.body.status;
    
    if (req.body.status === 'completed') {
      sale.deliveryStatus = 'delivered';
    }

    await sale.save();

    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/sales/:id/invoice
// @desc    Get sale invoice
// @access  Private
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('customer', 'fullName businessName email phone address')
      .populate('items.livestock', 'tagId name species')
      .populate('createdBy', 'name');

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // You could generate PDF here or return data for frontend to generate
    res.json({
      sale,
      farmDetails: {
        name: "My Brothers Keeper Farm",
        address: "Uganda",
        phone: "+256 XXX XXX XXX",
        email: "info@mbkfarm.com"
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/sales/:id
// @desc    Delete/Cancel sale
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // If livestock was sold, revert status
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        if (item.type === 'livestock' && item.livestock) {
          await Livestock.findByIdAndUpdate(item.livestock, {
            status: 'active',
            $unset: { disposalInfo: "" }
          });
        }
      }
    }

    sale.status = 'cancelled';
    await sale.save();

    res.json({ message: 'Sale cancelled successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
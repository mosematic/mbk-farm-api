const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/inventory
// @desc    Get all inventory items
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { category, search, lowStock, expiring } = req.query;
    let query = { active: true };

    if (category) query.category = category;
    
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await Inventory.find(query)
      .populate('preferredSupplier', 'fullName businessName')
      .populate('createdBy', 'name')
      .sort({ itemName: 1 });

    // Filter for low stock
    let filteredItems = items;
    if (lowStock === 'true') {
      filteredItems = items.filter(item => item.needsReorder());
    }

    // Filter for expiring items
    if (expiring === 'true') {
      filteredItems = items.filter(item => item.isExpiring(30));
    }

    res.json(filteredItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/inventory/stats
// @desc    Get inventory statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const items = await Inventory.find({ active: true });

    const stats = {
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + (item.totalValue || 0), 0),
      lowStockItems: items.filter(item => item.needsReorder()).length,
      expiringItems: items.filter(item => item.isExpiring(30)).length,
      outOfStock: items.filter(item => item.currentQuantity === 0).length,
      byCategory: await Inventory.aggregate([
        { $match: { active: true } },
        { 
          $group: { 
            _id: '$category', 
            count: { $sum: 1 },
            totalValue: { $sum: '$totalValue' }
          } 
        },
        { $sort: { totalValue: -1 } }
      ]),
      recentTransactions: await Inventory.aggregate([
        { $match: { active: true } },
        { $unwind: '$transactions' },
        { $sort: { 'transactions.date': -1 } },
        { $limit: 10 },
        {
          $project: {
            itemName: 1,
            transaction: '$transactions'
          }
        }
      ])
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/inventory/alerts
// @desc    Get inventory alerts
// @access  Private
router.get('/alerts', protect, async (req, res) => {
  try {
    const items = await Inventory.find({ active: true });

    const alerts = {
      lowStock: items.filter(item => item.needsReorder()).map(item => ({
        itemId: item._id,
        itemName: item.itemName,
        currentQuantity: item.currentQuantity,
        reorderPoint: item.reorderPoint,
        unit: item.unit,
        severity: item.currentQuantity === 0 ? 'critical' : 'warning'
      })),
      expiring: items.filter(item => item.isExpiring(30)).map(item => {
        const daysUntil = Math.ceil((new Date(item.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
        return {
          itemId: item._id,
          itemName: item.itemName,
          expirationDate: item.expirationDate,
          daysUntilExpiration: daysUntil,
          currentQuantity: item.currentQuantity,
          unit: item.unit,
          severity: daysUntil <= 7 ? 'critical' : 'warning'
        };
      })
    };

    res.json(alerts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/inventory/:id
// @desc    Get single inventory item
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id)
      .populate('preferredSupplier', 'fullName businessName email phone')
      .populate('suppliers.supplier', 'fullName businessName')
      .populate('transactions.performedBy', 'name')
      .populate('createdBy', 'name');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/inventory
// @desc    Add new inventory item
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const item = await Inventory.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/inventory/:id
// @desc    Update inventory item
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/inventory/:id/transaction
// @desc    Record inventory transaction (usage, purchase, adjustment)
// @access  Private
router.post('/:id/transaction', protect, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const { type, quantity, reason, cost, relatedTo, notes } = req.body;

    // Update quantity based on transaction type
    if (type === 'purchase') {
      item.currentQuantity += quantity;
      item.lastRestockDate = new Date();
      
      // Update average cost
      if (cost) {
        const totalCost = (item.averageCost * (item.currentQuantity - quantity)) + (cost * quantity);
        item.averageCost = totalCost / item.currentQuantity;
        item.lastPurchasePrice = cost;
      }
    } else if (type === 'usage' || type === 'waste' || type === 'sale') {
      if (item.currentQuantity < quantity) {
        return res.status(400).json({ message: 'Insufficient quantity' });
      }
      item.currentQuantity -= quantity;
    } else if (type === 'adjustment') {
      item.currentQuantity = quantity; // Direct adjustment
    }

    // Add transaction record
    item.transactions.push({
      type,
      quantity,
      date: new Date(),
      reason,
      cost,
      relatedTo,
      performedBy: req.user._id,
      notes
    });

    await item.save();

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/inventory/:id/batch
// @desc    Add batch/lot to inventory
// @access  Private
router.post('/:id/batch', protect, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.batches.push(req.body);
    item.currentQuantity += req.body.quantity;
    await item.save();

    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/inventory/:id
// @desc    Delete inventory item (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({ message: 'Item deactivated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/inventory/category/:category
// @desc    Get items by category
// @access  Private
router.get('/category/:category', protect, async (req, res) => {
  try {
    const items = await Inventory.find({ 
      category: req.params.category,
      active: true 
    }).sort({ itemName: 1 });

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
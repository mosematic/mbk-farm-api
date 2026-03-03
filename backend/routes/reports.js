const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Transaction = require('../models/Transaction');
const Livestock = require('../models/Livestock');
const Inventory = require('../models/Inventory');
const Task = require('../models/Task');
const Contact = require('../models/Contact');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/reports/comprehensive
// @desc    Get comprehensive farm report
// @access  Private
router.get('/comprehensive', protect, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const end = endDate ? new Date(endDate) : new Date();

    // Revenue
    const salesData = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const revenue = {
      total: salesData[0]?.total || 0,
      count: salesData[0]?.count || 0,
      growth: 0 // Calculate vs previous period
    };

    // Expenses
    const expensesData = await Transaction.aggregate([
      {
        $match: {
          type: 'expense',
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const expenses = {
      total: expensesData.reduce((sum, e) => sum + e.total, 0),
      categories: expensesData.map(e => ({
        name: e._id.replace(/_/g, ' '),
        amount: e.total
      }))
    };

    // Profit Margin
    const profitMargin = revenue.total > 0 
      ? ((revenue.total - expenses.total) / revenue.total * 100).toFixed(2)
      : 0;

    // Monthly Trend
    const monthlyTrend = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$saleDate' },
            month: { $month: '$saleDate' }
          },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'transactions',
          let: { year: '$_id.year', month: '$_id.month' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $year: '$date' }, '$$year'] },
                    { $eq: [{ $month: '$date' }, '$$month'] },
                    { $eq: ['$type', 'expense'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' }
              }
            }
          ],
          as: 'expenseData'
        }
      },
      {
        $project: {
          month: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month',
              day: 1
            }
          },
          revenue: 1,
          expenses: { $ifNull: [{ $arrayElemAt: ['$expenseData.total', 0] }, 0] }
        }
      },
      { $sort: { month: 1 } }
    ]);

    // Livestock
    const livestockStats = await Livestock.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$species',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedValue' }
        }
      }
    ]);

    const livestock = {
      count: await Livestock.countDocuments({ isActive: true }),
      totalValue: livestockStats.reduce((sum, l) => sum + (l.totalValue || 0), 0),
      bySpecies: livestockStats.map(l => ({
        species: l._id,
        count: l.count,
        value: l.totalValue
      }))
    };

    // Sales by Type
    const salesByType = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.type',
          total: { $sum: '$items.totalPrice' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Top Customers
    const topCustomers = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$customer',
          total: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'contacts',
          localField: '_id',
          foreignField: '_id',
          as: 'customerInfo'
        }
      },
      {
        $project: {
          name: { $arrayElemAt: ['$customerInfo.fullName', 0] },
          total: 1,
          orders: 1
        }
      }
    ]);

    // Top Products
    const topProducts = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.description',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.totalPrice' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: '$_id',
          quantity: 1,
          revenue: 1
        }
      }
    ]);

    // KPIs
    const totalCustomers = await Contact.countDocuments({ 
      type: { $in: ['customer', 'both'] },
      status: 'active'
    });
    
    const repeatCustomers = await Sale.aggregate([
      {
        $match: {
          saleDate: { $gte: start, $lte: end },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$customer',
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]);

    const kpis = {
      customerRetention: totalCustomers > 0 
        ? ((repeatCustomers.length / totalCustomers) * 100).toFixed(2)
        : 0,
      averageOrderValue: revenue.count > 0 
        ? (revenue.total / revenue.count).toFixed(2)
        : 0,
      inventoryTurnover: 0 // Calculate based on your needs
    };

    res.json({
      revenue,
      expenses,
      profitMargin,
      monthlyTrend,
      livestock,
      sales: {
        byType: salesByType
      },
      topCustomers,
      topProducts,
      kpis
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/financial
// @desc    Get financial report
// @access  Private
router.get('/financial', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const income = await Transaction.aggregate([
      {
        $match: {
          type: 'income',
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const expenses = await Transaction.aggregate([
      {
        $match: {
          type: 'expense',
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalIncome = income.reduce((sum, i) => sum + i.total, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0);

    res.json({
      period: { start, end },
      income: {
        total: totalIncome,
        byCategory: income
      },
      expenses: {
        total: totalExpenses,
        byCategory: expenses
      },
      netProfit: totalIncome - totalExpenses,
      profitMargin: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(2) : 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/livestock
// @desc    Get livestock report
// @access  Private
router.get('/livestock', protect, async (req, res) => {
  try {
    const activeAnimals = await Livestock.find({ isActive: true });

    const report = {
      summary: {
        totalActive: activeAnimals.length,
        totalValue: activeAnimals.reduce((sum, a) => sum + (a.estimatedValue || 0), 0),
        bySpecies: await Livestock.aggregate([
          { $match: { isActive: true } },
          {
            $group: {
              _id: '$species',
              count: { $sum: 1 },
              avgWeight: { $avg: { $arrayElemAt: ['$weight.value', -1] } }
            }
          }
        ]),
        byHealthStatus: await Livestock.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$healthStatus', count: { $sum: 1 } } }
        ]),
        byPurpose: await Livestock.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$purpose', count: { $sum: 1 } } }
        ])
      },
      breeding: {
        pregnant: await Livestock.countDocuments({ 
          isActive: true,
          healthStatus: 'pregnant'
        }),
        lactating: await Livestock.countDocuments({ 
          isActive: true,
          healthStatus: 'lactating'
        }),
        breedingStock: await Livestock.countDocuments({
          isActive: true,
          purpose: 'breeding'
        })
      },
      health: {
        needingAttention: activeAnimals.filter(a => 
          ['sick', 'injured', 'quarantine'].includes(a.healthStatus)
        ).length,
        upcomingVaccinations: activeAnimals.filter(a => 
          a.vaccinations.some(v => {
            const daysUntil = Math.ceil((new Date(v.nextDue) - new Date()) / (1000 * 60 * 60 * 24));
            return daysUntil >= 0 && daysUntil <= 30;
          })
        ).length
      }
    };

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/reports/export
// @desc    Export report
// @access  Private
router.get('/export', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;

    // This is a simplified version
    // You would typically use libraries like:
    // - exceljs for Excel files
    // - pdfkit or puppeteer for PDF files

    const data = {
      message: 'Export functionality would be implemented here',
      type,
      startDate,
      endDate
    };

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
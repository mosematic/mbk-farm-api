const express = require('express');
const router = express.Router();
const Animal = require('../models/Animal');
const Transaction = require('../models/Transaction');
const WorkLog = require('../models/WorkLog');
const Meeting = require('../models/Meeting');
const { protect } = require('../middleware/auth');

// @route   GET /api/dashboard/overview
// @desc    Get dashboard overview
// @access  Private
router.get('/overview', protect, async (req, res) => {
  try {
    // Animals summary
    const totalAnimals = await Animal.countDocuments({ isActive: true });
    const animalsByType = await Animal.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Financial summary (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyFinancials = await Transaction.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]);

    const monthlyIncome = monthlyFinancials.find(f => f._id === 'income')?.total || 0;
    const monthlyExpenses = monthlyFinancials.find(f => f._id === 'expense')?.total || 0;

    // Work logs summary (current month)
    const workLogsSummary = await WorkLog.aggregate([
      {
        $match: {
          date: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalHours: { $sum: '$hoursWorked' },
          totalDays: { $sum: 1 }
        }
      }
    ]);

    // Upcoming meetings
    const upcomingMeetings = await Meeting.find({
      date: { $gte: new Date() },
      status: 'scheduled'
    })
      .sort({ date: 1 })
      .limit(5)
      .populate('createdBy', 'name');

    // Recent transactions
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('recordedBy', 'name');

    // Animals needing attention (sick or quarantine)
    const animalsNeedingAttention = await Animal.find({
      isActive: true,
      healthStatus: { $in: ['sick', 'quarantine'] }
    }).limit(5);

    // Pending action items from meetings
    const pendingActionItems = await Meeting.aggregate([
      { $unwind: '$actionItems' },
      {
        $match: {
          'actionItems.status': { $in: ['pending', 'overdue'] }
        }
      },
      { $limit: 5 },
      {
        $project: {
          task: '$actionItems.task',
          deadline: '$actionItems.deadline',
          status: '$actionItems.status',
          meetingTitle: '$title'
        }
      }
    ]);

    res.json({
      animals: {
        total: totalAnimals,
        byType: animalsByType,
        needingAttention: animalsNeedingAttention
      },
      financials: {
        monthlyIncome,
        monthlyExpenses,
        netBalance: monthlyIncome - monthlyExpenses,
        recentTransactions
      },
      workLogs: workLogsSummary[0] || { totalHours: 0, totalDays: 0 },
      meetings: {
        upcoming: upcomingMeetings,
        pendingActionItems
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
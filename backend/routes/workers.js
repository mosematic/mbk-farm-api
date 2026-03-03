const express = require('express');
const router = express.Router();
const User = require('../models/User');
const WorkLog = require('../models/WorkLog');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/workers
// @desc    Get all workers
// @access  Private/Admin/Manager
router.get('/', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const workers = await User.find({ role: 'worker' }).select('-password');
    res.json(workers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/workers/:id/performance
// @desc    Get worker performance
// @access  Private/Admin/Manager
router.get('/:id/performance', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const workLogs = await WorkLog.find({
      worker: req.params.id,
      date: { $gte: startDate, $lte: endDate }
    });

    const totalHours = workLogs.reduce((acc, log) => acc + (log.hoursWorked || 0), 0);
    const totalDays = workLogs.length;
    const tasksCompleted = workLogs.reduce((acc, log) => {
      return acc + log.tasks.filter(t => t.completed).length;
    }, 0);

    res.json({
      totalHours,
      totalDays,
      tasksCompleted,
      averageHoursPerDay: totalDays > 0 ? (totalHours / totalDays).toFixed(2) : 0,
      workLogs
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
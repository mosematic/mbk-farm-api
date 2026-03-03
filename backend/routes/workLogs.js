const express = require('express');
const router = express.Router();
const WorkLog = require('../models/WorkLog');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/work-logs
// @desc    Get work logs
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { worker, startDate, endDate, approved } = req.query;
    let query = {};

    // Workers can only see their own logs
    if (req.user.role === 'worker') {
      query.worker = req.user._id;
    } else if (worker) {
      query.worker = worker;
    }

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (approved !== undefined) {
      query.approved = approved === 'true';
    }

    const workLogs = await WorkLog.find(query)
      .populate('worker', 'name email')
      .populate('approvedBy', 'name')
      .sort({ date: -1 });

    res.json(workLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/work-logs/check-in
// @desc    Worker check in
// @access  Private
router.post('/check-in', protect, async (req, res) => {
  try {
    // Check if already checked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const existingLog = await WorkLog.findOne({
      worker: req.user._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingLog && !existingLog.checkOut) {
      return res.status(400).json({ message: 'Already checked in. Please check out first.' });
    }

    const workLog = await WorkLog.create({
      worker: req.user._id,
      date: new Date(),
      checkIn: new Date(),
      tasks: req.body.tasks || []
    });

    res.status(201).json(workLog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/work-logs/check-out
// @desc    Worker check out
// @access  Private
router.put('/check-out', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const workLog = await WorkLog.findOne({
      worker: req.user._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      },
      checkOut: null
    });

    if (!workLog) {
      return res.status(404).json({ message: 'No active check-in found' });
    }

    workLog.checkOut = new Date();
    workLog.notes = req.body.notes || workLog.notes;
    workLog.tasks = req.body.tasks || workLog.tasks;
    await workLog.save();

    res.json(workLog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/work-logs/:id/approve
// @desc    Approve work log
// @access  Private/Admin/Manager
router.put('/:id/approve', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const workLog = await WorkLog.findByIdAndUpdate(
      req.params.id,
      { approved: true, approvedBy: req.user._id },
      { new: true }
    ).populate('worker', 'name email');

    if (!workLog) {
      return res.status(404).json({ message: 'Work log not found' });
    }

    res.json(workLog);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/work-logs/my-logs
// @desc    Get current user's work logs
// @access  Private
router.get('/my-logs', protect, async (req, res) => {
  try {
    const workLogs = await WorkLog.find({ worker: req.user._id })
      .sort({ date: -1 })
      .limit(30);

    res.json(workLogs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/work-logs/summary
// @desc    Get work log summary
// @access  Private/Admin/Manager
router.get('/summary', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const summary = await WorkLog.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: '$worker',
          totalHours: { $sum: '$hoursWorked' },
          totalDays: { $sum: 1 },
          totalOvertime: { $sum: '$overtime' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'workerInfo'
        }
      },
      {
        $unwind: '$workerInfo'
      },
      {
        $project: {
          workerName: '$workerInfo.name',
          totalHours: 1,
          totalDays: 1,
          totalOvertime: 1
        }
      }
    ]);

    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
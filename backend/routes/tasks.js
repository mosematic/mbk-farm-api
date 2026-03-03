const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/tasks
// @desc    Get all tasks
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { 
      status, category, assignedTo, startDate, endDate, 
      priority, relatedLivestock 
    } = req.query;
    
    let query = {};

    // Workers can only see their assigned tasks
    if (req.user.role === 'worker') {
      query.assignedTo = req.user._id;
    } else if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (relatedLivestock) query.relatedLivestock = relatedLivestock;
    
    if (startDate && endDate) {
      query.dueDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name')
      .populate('completedBy', 'name')
      .populate('relatedLivestock', 'tagId name species')
      .populate('relatedCrops', 'name')
      .populate('relatedFields', 'name')
      .sort({ dueDate: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/stats
// @desc    Get task statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let query = {};
    if (req.user.role === 'worker') {
      query.assignedTo = req.user._id;
    }

    const stats = {
      total: await Task.countDocuments(query),
      pending: await Task.countDocuments({ ...query, status: 'pending' }),
      inProgress: await Task.countDocuments({ ...query, status: 'in_progress' }),
      completed: await Task.countDocuments({ ...query, status: 'completed' }),
      overdue: await Task.countDocuments({
        ...query,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $lt: today }
      }),
      dueToday: await Task.countDocuments({
        ...query,
        status: { $in: ['pending', 'in_progress'] },
        dueDate: { $gte: today, $lt: tomorrow }
      }),
      byCategory: await Task.aggregate([
        { $match: query },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email phone')
      .populate('assignedBy', 'name')
      .populate('completedBy', 'name')
      .populate('relatedLivestock', 'tagId name species')
      .populate('relatedCrops', 'name')
      .populate('relatedFields', 'name');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const task = await Task.create({
      ...req.body,
      assignedBy: req.user._id,
      createdBy: req.user._id
    });

    // If recurring, create future instances
    if (task.recurring && task.recurrencePattern) {
      // Logic to create recurring tasks would go here
      // This is a simplified version
    }

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name');

    res.status(201).json(populatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id/start
// @desc    Start a task
// @access  Private
router.put('/:id/start', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.status = 'in_progress';
    task.startTime = new Date();
    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id/complete
// @desc    Complete a task
// @access  Private
router.put('/:id/complete', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    task.status = 'completed';
    task.completedDate = new Date();
    task.completedBy = req.user._id;
    task.endTime = new Date();
    
    // Calculate actual duration if start time exists
    if (task.startTime) {
      const diffMs = task.endTime - task.startTime;
      task.actualDuration = Math.round(diffMs / (1000 * 60)); // minutes
    }

    if (req.body.completionNotes) {
      task.completionNotes = req.body.completionNotes;
    }

    await task.save();

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id/checklist/:checklistId
// @desc    Update checklist item
// @access  Private
router.put('/:id/checklist/:checklistId', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const checklistItem = task.checklist.id(req.params.checklistId);
    if (checklistItem) {
      checklistItem.completed = req.body.completed;
      if (req.body.completed) {
        checklistItem.completedBy = req.user._id;
        checklistItem.completedAt = new Date();
      }
      await task.save();
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/calendar/:month/:year
// @desc    Get tasks for calendar view
// @access  Private
router.get('/calendar/:month/:year', protect, async (req, res) => {
  try {
    const { month, year } = req.params;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let query = {
      dueDate: { $gte: startDate, $lte: endDate }
    };

    if (req.user.role === 'worker') {
      query.assignedTo = req.user._id;
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name')
      .select('title dueDate status priority category');

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
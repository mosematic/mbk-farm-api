const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/meetings
// @desc    Get all meetings
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, type, startDate, endDate } = req.query;
    let query = {};

    if (status) query.status = status;
    if (type) query.type = type;
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const meetings = await Meeting.find(query)
      .populate('attendees.user', 'name email role')
      .populate('createdBy', 'name')
      .populate('minutes.recordedBy', 'name')
      .populate('actionItems.assignedTo', 'name')
      .sort({ date: -1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/meetings/:id
// @desc    Get single meeting
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('attendees.user', 'name email role')
      .populate('createdBy', 'name')
      .populate('minutes.recordedBy', 'name')
      .populate('actionItems.assignedTo', 'name');

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/meetings
// @desc    Create meeting
// @access  Private/Admin/Manager/Board
router.post('/', protect, authorize('admin', 'manager', 'board_member'), async (req, res) => {
  try {
    const meeting = await Meeting.create({
      ...req.body,
      createdBy: req.user._id
    });

    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/meetings/:id
// @desc    Update meeting
// @access  Private
router.put('/:id', protect, authorize('admin', 'manager', 'board_member'), async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/meetings/:id/minutes
// @desc    Add/Update meeting minutes
// @access  Private
router.put('/:id/minutes', protect, authorize('admin', 'manager', 'board_member'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.minutes = {
      content: req.body.content,
      recordedBy: req.user._id
    };

    await meeting.save();

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/meetings/:id/decisions
// @desc    Add decision to meeting
// @access  Private
router.post('/:id/decisions', protect, authorize('admin', 'manager', 'board_member'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.decisions.push(req.body);
    await meeting.save();

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/meetings/:id/action-items
// @desc    Add action item
// @access  Private
router.post('/:id/action-items', protect, authorize('admin', 'manager', 'board_member'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.actionItems.push(req.body);
    await meeting.save();

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/meetings/:id/action-items/:actionId
// @desc    Update action item status
// @access  Private
router.put('/:id/action-items/:actionId', protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    const actionItem = meeting.actionItems.id(req.params.actionId);
    if (actionItem) {
      actionItem.status = req.body.status;
      await meeting.save();
    }

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/meetings/:id/attendance
// @desc    Mark attendance
// @access  Private
router.put('/:id/attendance', protect, authorize('admin', 'manager', 'board_member'), async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    req.body.attendees.forEach(att => {
      const attendee = meeting.attendees.find(a => a.user.toString() === att.user);
      if (attendee) {
        attendee.attended = att.attended;
      }
    });

    await meeting.save();

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
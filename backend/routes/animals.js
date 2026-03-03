const express = require('express');
const router = express.Router();
const Animal = require('../models/Animal');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/animals
// @desc    Get all animals
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { type, healthStatus, isActive, search } = req.query;
    let query = {};

    if (type) query.type = type;
    if (healthStatus) query.healthStatus = healthStatus;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { tag: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const animals = await Animal.find(query)
      .populate('mother', 'tag name')
      .populate('father', 'tag name')
      .populate('addedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(animals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/animals/stats
// @desc    Get animal statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const totalAnimals = await Animal.countDocuments({ isActive: true });
    
    const byType = await Animal.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const byHealth = await Animal.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$healthStatus', count: { $sum: 1 } } }
    ]);

    const byGender = await Animal.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    const recentAdditions = await Animal.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      totalAnimals,
      byType,
      byHealth,
      byGender,
      recentAdditions
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/animals/:id
// @desc    Get single animal
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id)
      .populate('mother', 'tag name')
      .populate('father', 'tag name')
      .populate('addedBy', 'name');

    if (!animal) {
      return res.status(404).json({ message: 'Animal not found' });
    }

    res.json(animal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/animals
// @desc    Add new animal
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const animal = await Animal.create({
      ...req.body,
      addedBy: req.user._id
    });

    res.status(201).json(animal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/animals/:id
// @desc    Update animal
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const animal = await Animal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!animal) {
      return res.status(404).json({ message: 'Animal not found' });
    }

    res.json(animal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/animals/:id/vaccination
// @desc    Add vaccination record
// @access  Private
router.post('/:id/vaccination', protect, async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id);
    
    if (!animal) {
      return res.status(404).json({ message: 'Animal not found' });
    }

    animal.vaccinations.push(req.body);
    await animal.save();

    res.json(animal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/animals/:id/medical
// @desc    Add medical record
// @access  Private
router.post('/:id/medical', protect, async (req, res) => {
  try {
    const animal = await Animal.findById(req.params.id);
    
    if (!animal) {
      return res.status(404).json({ message: 'Animal not found' });
    }

    animal.medicalHistory.push(req.body);
    await animal.save();

    res.json(animal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/animals/:id
// @desc    Delete animal (soft delete)
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin', 'manager'), async (req, res) => {
  try {
    const animal = await Animal.findByIdAndUpdate(
      req.params.id,
      { isActive: false, disposalDate: new Date() },
      { new: true }
    );

    if (!animal) {
      return res.status(404).json({ message: 'Animal not found' });
    }

    res.json({ message: 'Animal removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
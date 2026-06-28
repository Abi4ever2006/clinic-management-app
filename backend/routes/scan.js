const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyJWT, requireRole } = require('../middleware/auth');
const { cloudinary } = require('../config/cloudinary');
const { scanPrescriptionImage } = require('../services/geminiService');

// Use memory storage — we upload directly to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// POST /api/scan/prescription
// Upload image and extract medicine data using Gemini AI
router.post(
  '/prescription',
  verifyJWT,
  requireRole('doctor'),
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided' });
      }

      console.log('Image received:', req.file.originalname, req.file.mimetype);

      // Step 1: Upload image to Cloudinary
      const base64Image = req.file.buffer.toString('base64');
      const dataUri = `data:${req.file.mimetype};base64,${base64Image}`;

      console.log('Uploading image to Cloudinary...');

      const uploadResult = await cloudinary.uploader.upload(dataUri, {
        folder: 'clinic/prescription-scans',
        resource_type: 'image',
        public_id: `scan_${Date.now()}`,
      });

      console.log('Image uploaded:', uploadResult.secure_url);

      // Step 2: Send to Gemini Vision API
      console.log('Sending to Gemini for analysis...');
      const medicines = await scanPrescriptionImage(uploadResult.secure_url);

      res.json({
        success: true,
        imageUrl: uploadResult.secure_url,
        medicines,
        count: medicines.length,
      });

    } catch (err) {
      console.error('Scan error:', err.message);
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
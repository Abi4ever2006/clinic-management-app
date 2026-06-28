const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const pdfStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'clinic/prescriptions',
        resource_type: 'raw',
        format: 'pdf', 
    },
});

const imageStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'clinic/prescription-images',
        resource_type: 'image',
        allow_formats: ['jpg', 'jpeg', 'png', 'webp'],
    },
});

const uploadPDF = multer({ storage: pdfStorage });
const uploadImage = multer({ storage: imageStorage });

module.exports = { cloudinary, uploadPDF, uploadImage };
const jwt = require('jsonwebtoken');
const { admin } = require('../config/firebase');

const verifyFirebaseToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const idToken = authHeader.split('Bearer ')[1];

    try{
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.firebaseUser = decodedToken;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid Firebase token' });
    }
};

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('=== JWT DECODED ===');
    console.log('user id:', decoded.id);
    console.log('user role:', decoded.role);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  console.log('=== REQUIRE ROLE CHECK ===');
  console.log('Required roles:', roles);
  console.log('User role:', req.user?.role);
  console.log('Match:', roles.includes(req.user?.role));

  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }
  next();
};

module.exports = { verifyFirebaseToken, verifyJWT, requireRole };
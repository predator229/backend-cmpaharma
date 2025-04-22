const admin = require('../config/firebase');

const verifyFirebaseToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(403).json({ message: 'No token provided' });

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token', error: error.message });
    }
};

module.exports = verifyFirebaseToken;

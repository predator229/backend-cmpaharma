require('module-alias/register');
const admin = require('@config/firebase');
const { socket } = require('socket.io');


// Middleware pour vérifier le token Firebase dans les requêtes HTTP classiques
const verifyFirebaseToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ message: 'Token manquant' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;
        next(); 
    } catch (error) {
        console.error("⚠️ Erreur d'authentification HTTP :", error.message);
        res.status(401).json({ message: 'Token invalide', error: error.message });
    }
};

// Middleware pour vérifier le token Firebase dans la connexion WebSocket
const verifyFirebaseSocketToken = async (socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        console.error("❌ Token manquant dans la connexion WebSocket");
        return next(new Error("Token manquant"));
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        socket.user = decodedToken;
        console.log(`✅ Authentification réussie pour ${socket.user.uid}`);
        next();
    } catch (error) {
        console.error("⚠️ Erreur d'authentification WebSocket :", error.message);
        next(new Error("Token invalide"));
    }
};

module.exports = { verifyFirebaseToken, verifyFirebaseSocketToken };

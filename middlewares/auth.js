// auth.js - middleware modifié
require('module-alias/register');
const { getFirebaseApp } = require('@config/firebase');

const createAuthMiddleware = (type) => {
    const firebaseApp = getFirebaseApp(type);

    if (!firebaseApp) {
        throw new Error(`Firebase app not initialized for type: ${type}`);
    }

    const verifyFirebaseToken = async (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(403).json({ message: 'Token manquant' });
        }
        try {
            const decodedToken = await firebaseApp.auth().verifyIdToken(token);
            req.user = decodedToken;
            console.log(`[${type.toUpperCase()}] Auth HTTP OK pour ${decodedToken.uid}`);
            next(); 
        } catch (error) {
            console.error(`[${type.toUpperCase()}] ❌ Erreur HTTP auth:`, error.message);
            res.status(401).json({ message: 'Token invalide',  });
        }
    };

    const  injectDeliverType = (req, res, next) => {
        req.body.type = type;
        next();
    }    

    const verifyFirebaseSocketToken = async (socket, next) => {
        const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
        
        if (!token) {
            console.error(`[${type.toUpperCase()}] ❌ Token manquant dans la connexion WebSocket`);
            return next(new Error("Token manquant"));
        }
    
        try {
            const decodedToken = await firebaseApp.auth().verifyIdToken(token);
            socket.user = decodedToken;
            console.log(`[${type.toUpperCase()}] ✅ Authentification WebSocket réussie pour ${decodedToken.uid}`);
            next();
        } catch (error) {
            console.error(`[${type.toUpperCase()}] ⚠️ Erreur d'authentification WebSocket:`, error.message);
            next(new Error("Token invalide"));
        }
    };
            
    return { verifyFirebaseToken, verifyFirebaseSocketToken, injectDeliverType };
};

module.exports = { createAuthMiddleware };
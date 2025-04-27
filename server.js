require('module-alias/register');
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs').promises; 
const path = require('path');
const { faker } = require('@faker-js/faker');

const deliverRoutes = require('@routes/delivers/api');
const adminRoutes = require('@routes/admins/api');

const { createAuthMiddleware } = require('@middlewares/auth');

const deliverSocketRoutes = require('@routes/delivers/api_socket');
const adminSocketRoutes = require('@routes/admins/api_socket');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json());
app.use(cors());
app.use(helmet());

async function importData() {
    try {
        // if (process.env.NODE_ENV !== 'production') {
            console.log('🗑️ Suppression de toutes les collections...');
            const collections = await mongoose.connection.db.listCollections().toArray();
            for (let collection of collections) {
                await mongoose.connection.db.collection(collection.name).deleteMany({});
            }

            const ok = await loadModels(path.join(__dirname, 'models'));
            if (ok) {
                const data = await fs.readFile('countries.json', 'utf8');
                const countries = JSON.parse(data);    
                const Country = require('@models/Country'); 
                await Country.insertMany(countries);
                console.log('🌍 Countries data has been added to the database!');
            } else {
                console.error('❌ Les modèles n\'ont pas pu être chargés.');
            }
        // }

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

async function loadModels(directory) {
    const models = {};
    try {
        const files = await fs.readdir(directory); // Lire le répertoire de manière asynchrone

        for (const file of files) {
            const filePath = path.join(directory, file);

            if ((await fs.stat(filePath)).isFile() && filePath.endsWith('.js')) {
                const modelName = path.basename(file, '.js');
                const model = require(filePath);

                models[modelName] = model;
                console.log(`✅ Modèle chargé : ${modelName}`);
            }
        }
        return true;  // Retourner true si les modèles sont chargés avec succès
    } catch (error) {
        console.error('❌ Error loading models:', error);
        return false;  // Retourner false si une erreur se produit
    }
}

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB connecté avec succès');
        await importData();  // Appel de l'importation des données et du chargement des modèles
        console.log('✅ Importation des données terminée.');

        app.use('/deliver/api', deliverRoutes);
        app.use('/admin/api', adminRoutes);

        const server = http.createServer(app);
        const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

        const connectedUsers = new Map();
        const deliverNamespace = io.of('/deliver');
        const adminNamespace = io.of('/admin');

        const { verifyFirebaseSocketToken: deliverVerifyFirebaseSocketToken } = createAuthMiddleware('deliver');
        const { verifyFirebaseSocketToken: adminVerifyFirebaseSocketToken } = createAuthMiddleware('admin');

        deliverNamespace.use(deliverVerifyFirebaseSocketToken);
        deliverNamespace.on('connection', (socket) => {
            console.log(`🔌 Livreur connecté : ${socket.user.uid}`);
            deliverSocketRoutes(socket);
        });

        adminNamespace.use(adminVerifyFirebaseSocketToken);
        adminNamespace.on('connection', (socket) => {
            console.log(`🔌 Administrateur connecté : ${socket.user.uid}`);
            adminSocketRoutes(socket);
        });

        server.listen(PORT, () => {
            console.log(`🚀 Le server est lancé et tourne sur le port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Erreur de connexion MongoDB :', err);
        process.exit(1);
    });

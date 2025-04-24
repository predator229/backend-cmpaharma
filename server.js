require('dotenv').config();

require('module-alias/register');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http'); 
const fs = require('fs').promises;
const { Server } = require('socket.io');
const { faker } = require('@faker-js/faker');

const Country = require('@models/Country');
require('@models/User');
require('@models/Mobil');

const usersRoutes = require('@routes/api');
const socketRoutes = require('@routes/api_socket');
const {verifyFirebaseSocketToken} = require('@middlewares/auth');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json());
app.use(cors());
app.use(helmet());

async function importData() {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log('🗑️ Suppression de toutes les collections...');
            const collections = await mongoose.connection.db.listCollections().toArray();
            for (let collection of collections) {
                await mongoose.connection.db.collection(collection.name).deleteMany({});
            }
        }

        const data = await fs.readFile('countries.json', 'utf8');
        const countries = JSON.parse(data);

        await Country.insertMany(countries);
        console.log('🌍 Countries data has been added to the database!');
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB connecté avec succès');
        await importData();

        console.log('✅ Importation des données terminée.');

        app.use('/api', usersRoutes);

        const server = http.createServer(app);

        const io = new Server(server, {
            cors: {
                origin: '*', 
                methods: ['GET', 'POST'],
                allowedHeaders: ['Content-Type', 'Authorization'],
            }
        });

        const connectedUsers = new Map();

        io.use(verifyFirebaseSocketToken);

        io.on('connection', (socket) => {
            console.log(`🔌 Client connecté : ${socket.user.uid}`);
            socketRoutes(socket); // ⬅️ routes WS
        });

        server.listen(PORT, () => {
            console.log('📌 Modèles Mongoose chargés:', mongoose.modelNames());
            console.log(`🚀 Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ Erreur de connexion MongoDB :', err);
        process.exit(1);
    });

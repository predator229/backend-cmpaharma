require('module-alias/register');
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs').promises; 
const fss = require('fs');

const path = require('path');
const { faker } = require('@faker-js/faker');

const Country = require('@models/Country');
const Permission = require('@models/Permission');
const Group = require('@models/Group');
const datas_permission = require('./pharmacies_permissions.json');

const deliverRoutes = require('@routes/delivers/api');
const adminRoutes = require('@routes/admins/api');

const { createAuthMiddleware } = require('@middlewares/auth');

const deliverSocketRoutes = require('@routes/delivers/api_socket');
const adminSocketRoutes = require('@routes/admins/api_socket');

const app = express();
const PORT = process.env.PORT || 5050;

const Pharmacy = require('@models/Pharmacy');
const Activity = require('@models/Activity');
const { v4: uuidv4 } = require('uuid');
const Category = require('./models/Category');

app.use(express.json());
app.use(cors());
app.use(helmet());

async function seedPermissions() {
  await Permission.deleteMany({});
  await Permission.insertMany(datas_permission);

  console.log('✅ Permissions seeded!');
}
async function seedGroupsWithValidation() {
  try {
    const allPermissions = await Permission.find({});
    const permissionsMap = new Map();

    allPermissions.forEach(p => {
      if (Array.isArray(p.permissions)) {
        p.permissions.forEach(code => permissionsMap.set(code, p._id));
      } else if (p.code) {
        permissionsMap.set(p.code, p._id);
      }
    });

    const groupsData = JSON.parse(fss.readFileSync('groups_all.json', 'utf8'));

    for (const group of groupsData) {
      let permissionIds = [];
      if (group.permissions === "ALL") {
        permissionIds = allPermissions.map(p => p._id);
      } else if (Array.isArray(group.permissions)) {
        permissionIds = group.permissions
          .map(code => permissionsMap.get(code))
          .filter(Boolean);
        const missing = group.permissions.filter(code => !permissionsMap.has(code));
        if (missing.length) console.warn(`⚠️ Group ${group.code} missing permissions:`, missing);
      } else {
        console.warn(`⚠️ Group ${group.code} invalid permissions field`);
        continue;
      }

      const exists = await Group.findOne({ code: group.code });
      if (!exists) {
        await Group.create({
          code: group.code,
          name: group.name,
          description: group.description,
          isActive: group.isActive !== undefined ? group.isActive : true,
          plateform: group.plateform,
          permissions: permissionIds,
          createdBy: group.createdBy || 'System'
        });
        console.log(`✅ Group ${group.code} created`);
      } else {
        await Group.findOneAndUpdate(
          { code: group.code },
          {
            name: group.name,
            description: group.description,
            isActive: group.isActive !== undefined ? group.isActive : exists.isActive,
            plateform: group.plateform,
            permissions: permissionIds
          },
          { new: true }
        );
        console.log(`🔄 Group ${group.code} updated`);
      }
    }
  } catch (error) {
    console.error('❌ Error in seedGroupsWithValidation:', error);
    throw error;
  }
}

async function importData() {
    try {
      console.log('🗑️ Suppression de toutes les collections...');
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (let collection of collections) {
          await mongoose.connection.db.collection(collection.name).deleteMany({});
      }
      const ok = await loadModels(path.join(__dirname, 'models'));
      if (ok) {
          const data = await fs.readFile('countries.json', 'utf8');
          const countries = JSON.parse(data);    
          await Country.insertMany(countries);
          console.log('🌍 Countries data has been added to the database!');
          var  categories = ['Médicaments','Cosmétiques','Hygiène','Bébé','Nutrition','Homéopathie','Matériel médical','Premiers secours','Vitamines et compléments','Santé sexuelle','Soins dentaires','Optique','Orthopédie','Aromathérapie','Phytothérapie','Produits vétérinaires','Produits bio','Produits sans ordonnance','Soins capillaires','Soins de la peau','Maquillage','Protection solaire','Incontinence','Allergies','Douleurs et fièvre','Tension artérielle','Diabète','Arrêt du tabac','Tests et diagnostics','Produits pour sportifs','Produits minceur','Produits pour hommes','Produits pour femmes','Produits pour seniors','Produits pour animaux','Accessoires médicaux','Désinfectants','Masques et protections','Lentilles et solutions','Produits d\'hiver','Produits d\'été'];
          categories = categories.map(category => category.toLowerCase());
          var categories_collections = categories.map(async category => {
            cat = new Category;
            cat.name = category;
            await cat.save();
            return cat;
          });
          await seedPermissions().catch(console.error);
          await seedGroupsWithValidation().catch(console.error);
      } else {
          console.error('❌ Les modèles n\'ont pas pu être chargés.');
      }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// const generateActivity = () => {
//   const types = ['order', 'pharmacy', 'payment', 'user', 'delivery'];
//   // const types = ['login', 'logout', 'order_created', 'order_updated', 'pharmacy_updated', 'profile_updated'];
//   const users = ['admin', 'deliver', 'customer', 'pharmacy_owner'];
//   return {
//     type: faker.helpers.arrayElement(types),
//     title: faker.lorem.sentence(),
//     userId: uuidv4(),
//     id_object: uuidv4(),
//     userType: faker.helpers.arrayElement(users),
//     description: faker.lorem.sentence(),
//     createdAt: faker.date.recent({ days: 60 })
//   };
// };

// const seedActivities = async (count) => {
//   try {
//     await Activity.deleteMany({});
//     console.log('Cleared existing activities');

//     const activities = [];
//     for (let i = 0; i < count; i++) {
//       activities.push(generateActivity());
//       if ((i + 1) % 10 === 0 || i === count - 1) {
//         console.log(`Generated ${i + 1} of ${count} activities`);
//       }
//     }

//     await Activity.insertMany(activities);
//     console.log(`Successfully seeded ${count} activities`);
//   } catch (error) {
//     console.error('Error seeding activities:', error);
//   }
// };

async function loadModels(directory) {
    const models = {};
    try {
        const files = await fs.readdir(directory);

        for (const file of files) {
            const filePath = path.join(directory, file);

            if ((await fs.stat(filePath)).isFile() && filePath.endsWith('.js')) {
                const modelName = path.basename(file, '.js');
                const model = require(filePath);
                models[modelName] = model;
                if (process.env.NODE_ENV == 'dev') { console.log(`✅ Modèle chargé : ${modelName}`); }
            }
        }
        return true;
    } catch (error) {
        console.error('❌ Error loading models:', error);
        return false;
    }
}
const connectWithRetry = () => {
  if (process.env.NODE_ENV == 'development') { console.log(`🟡 Tentative de connexion MongoDB...`); }
  mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
      if (process.env.NODE_ENV == 'development') { console.log(`✅ MongoDB connecté avec succès`); }

        if (process.env.NODE_ENV == 'developpement') {
          await importData();
          console.log('✅ Importation des données terminée.');
        }
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
        setTimeout(connectWithRetry, 5000);
    });
  }
  connectWithRetry();


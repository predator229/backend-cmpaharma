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
// JWT_SECRET
const path = require('path');
const { faker } = require('@faker-js/faker');

const Country = require('@models/Country');
const Permission = require('@models/Permission');
const Group = require('@models/Group');
const Admin = require('@models/Admin');
const Mobil = require('@models/Mobil');
const SetupBase = require('@models/SetupBase');

const datas_permission = require('./pharmacies_permissions.json');

const deliverRoutes = require('@routes/delivers/api');
const adminRoutes = require('@routes/admins/api');

const { createAuthMiddleware } = require('@middlewares/auth');

const deliverSocketRoutes = require('@routes/delivers/api_socket');
const adminSocketRoutes = require('@controllers/admins/api_socket');
const internalMessagingSocketRoutes = require('@controllers/admins/api_socket_conversation');

const app = express();
const PORT = process.env.PORT || 5050;

const Pharmacy = require('@models/Pharmacy');
const Activity = require('@models/Activity');
const { v4: uuidv4 } = require('uuid');
const Category = require('./models/Category');
const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, registerActivity } = require('@tools/flutter_tools');

const MiniChatMessage = require('@models/MiniChatMessage'); 
const MiniChatAttachement = require('@models/MiniChatAttachement');

app.use(express.json());
app.use(cors());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(helmet());

async function seedGroupsWithValidation() {
  try {
    await Permission.deleteMany({});
    await Permission.insertMany(datas_permission);

    const allPermissions = await Permission.find({});
    const permissionsMap = new Map();

    allPermissions.forEach(permission => {
      if (Array.isArray(permission.permissions)) {
        permission.permissions.forEach(code => {
          permissionsMap.set(code, permission._id);
        });
      } else if (permission.code) {
        permissionsMap.set(permission.code, permission._id);
      }
    });
    await Group.deleteMany({});

    const groupsData = JSON.parse(fss.readFileSync('groups_all.json', 'utf8'));

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const group of groupsData) {
      try {
        let permissionIds = [];
        if (group.permissions === "ALL") {
          permissionIds = allPermissions.map(p => p._id);
        } else if (Array.isArray(group.permissions)) {
          permissionIds = group.permissions
            .map(code => permissionsMap.get(code))
            .filter(Boolean);

            const missing = group.permissions.filter(code => !permissionsMap.has(code));
          if (missing.length > 0) {
            console.warn(`⚠️ Group ${group.code} missing ${missing.length} permissions:`, missing);
          }
          
          console.log(`📝 Group ${group.code} assigned ${permissionIds.length}/${group.permissions.length} permissions`);
        } else {
          console.warn(`⚠️ Group ${group.code} has invalid permissions field, skipping...`);
          errorCount++;
          continue;
        }
        const existingGroup = await Group.findOne({ code: group.code });
        
        if (!existingGroup) {
          await Group.create({
            code: group.code,
            name: group.name,
            description: group.description,
            isActive: group.isActive !== undefined ? group.isActive : true,
            plateform: group.plateform,
            permissions: permissionIds,
            createdBy: group.createdBy || 'System'
          });
          createdCount++;
        } else {
          await Group.findOneAndUpdate(
            { code: group.code },
            {
              name: group.name,
              description: group.description,
              isActive: group.isActive !== undefined ? group.isActive : existingGroup.isActive,
              plateform: group.plateform,
              permissions: permissionIds,
              updatedAt: new Date()
            },
            { new: true }
          );
          updatedCount++;
        }
      } catch (groupError) {
        console.error(`❌ Error processing group ${group.code}:`, groupError.message);
        errorCount++;
      }
    }
    
  } catch (error) {
    console.error('❌ Fatal error in seedGroupsWithValidation:', error);
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
          // await seedPermissions().catch(console.error);
          await seedGroupsWithValidation().catch(console.error);
      } else {
          console.error('❌ Les modèles n\'ont pas pu être chargés.');
      }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

async function fakeUser() { //generate fake users but no possibility to connect cuz not related to firebase.
  try {
    const groups = await Group.find({ code : {$in : ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant']} });
    const existingUsers = groups ? await Admin.find({ groups : { $in : groups.map(g => g._id) } }) : [];
    const counstries = await Country.find();
    const setups = await SetupBase.find();

    if (groups) {
      for (let i = 0; i < 30; i++) {
        const name = faker.person.firstName();
        const surname = faker.person.lastName();
        const country = counstries[Math.floor(Math.random() * counstries.length)];
        const lengthUserGroup = Math.floor(Math.random() * groups.length);
        const user_group = groups ? groups.slice(0, lengthUserGroup).map(g => g._id): [];

        // const phone = new Mobil({
        //   digits:  'fake-'+faker.phone.number().replace('-', ''),
        //   indicatif: country.dial_code,
        //   title: 'fake phone number for '+name+' '+surname,
        // });
        // await phone.save();
        const user = {
          name: 'fake-'+name,
          surname: 'fake-'+surname,
          email: 'fake-'+faker.internet.email(),
          // phone: phone._id,
          country: country._id,
          city: 'fake-'+faker.location.city(),
          address: faker.location.streetAddress(),
          groups: user_group,
          setups: setups[Math.floor(Math.random() * setups.length)]._id,
          pharmaciesManaged : ['688a12de4922282243bfeea3'],
        };

        const existingUser = existingUsers.find(u => u.email === user.email);
        if (!existingUser) {
          await Admin.create(user);
        }
      }
    }
  }catch (error) {
    console.error('❌ Error when generating fake users :', error);
  }
}

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

        // if (process.env.NODE_ENV == 'developpement') {
        //   await importData();
        // }
        // await seedGroupsWithValidation();
        // await fakeUser();
        app.use('/deliver/api', deliverRoutes);
        app.use('/admin/api', adminRoutes);

        const server = http.createServer(app);
        const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

        const connectedUsers = new Map();
        const deliverNamespace = io.of('/deliver');
        const chatpharmacyParams = io.of('/admin/websocket/pharmacy_contact_admin');
        const conversationNamespace = io.of('/admin/websocket/internal_messaging');

        const { verifyFirebaseSocketToken: deliverVerifyFirebaseSocketToken } = createAuthMiddleware('deliver');
        const { verifyFirebaseSocketToken: adminVerifyFirebaseSocketToken } = createAuthMiddleware('admin');

        deliverNamespace.use(deliverVerifyFirebaseSocketToken);
        deliverNamespace.on('connection', (socket) => {
            console.log(`🔌 Livreur connecté : ${socket.user.uid}`);
            deliverSocketRoutes(socket);
        });

        chatpharmacyParams.use(adminVerifyFirebaseSocketToken);
        chatpharmacyParams.on('connection', async (socket) => {
          adminSocketRoutes(socket, chatpharmacyParams);
        });

        conversationNamespace.use(adminVerifyFirebaseSocketToken);
        conversationNamespace.on('connection', async (socket) => {
          internalMessagingSocketRoutes(socket, conversationNamespace);
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

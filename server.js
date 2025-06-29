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
  console.log('✅ Permissions seeded!');
}
async function seedGroupsWithValidation() {
  try {
    console.log('🔄 Starting groups seeding process...');
    
    // Clear and recreate permissions
    await Permission.deleteMany({});
    await Permission.insertMany(datas_permission);
    console.log(`✅ ${datas_permission.length} permissions inserted`);

    // Build permissions map for faster lookup
    const allPermissions = await Permission.find({});
    const permissionsMap = new Map();

    allPermissions.forEach(permission => {
      if (Array.isArray(permission.permissions)) {
        // If permission has nested permissions array
        permission.permissions.forEach(code => {
          permissionsMap.set(code, permission._id);
        });
      } else if (permission.code) {
        // If permission has a single code
        permissionsMap.set(permission.code, permission._id);
      }
    });

    console.log(`📋 Built permissions map with ${permissionsMap.size} entries`);

    // Clear existing groups
    await Group.deleteMany({});
    console.log('🗑️ Existing groups cleared');

    // Read groups data
    const groupsData = JSON.parse(fss.readFileSync('groups_all.json', 'utf8'));
    console.log(`📖 Loaded ${groupsData.length} groups from file`);

    let createdCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const group of groupsData) {
      try {
        let permissionIds = [];
        
        // Handle permissions assignment
        if (group.permissions === "ALL") {
          permissionIds = allPermissions.map(p => p._id);
          console.log(`🔓 Group ${group.code} assigned ALL permissions (${permissionIds.length})`);
        } else if (Array.isArray(group.permissions)) {
          permissionIds = group.permissions
            .map(code => permissionsMap.get(code))
            .filter(Boolean);
          
          // Check for missing permissions
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

        // Check if group already exists
        const existingGroup = await Group.findOne({ code: group.code });
        
        if (!existingGroup) {
          // Create new group
          await Group.create({
            code: group.code,
            name: group.name,
            description: group.description,
            isActive: group.isActive !== undefined ? group.isActive : true,
            plateform: group.plateform,
            permissions: permissionIds,
            createdBy: group.createdBy || 'System'
          });
          console.log(`✅ Group ${group.code} created successfully`);
          createdCount++;
        } else {
          // Update existing group
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
          console.log(`🔄 Group ${group.code} updated successfully`);
          updatedCount++;
        }
      } catch (groupError) {
        console.error(`❌ Error processing group ${group.code}:`, groupError.message);
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log(`✅ Created: ${createdCount} groups`);
    console.log(`🔄 Updated: ${updatedCount} groups`);
    console.log(`❌ Errors: ${errorCount} groups`);
    console.log(`📋 Total permissions available: ${allPermissions.length}`);
    
    if (errorCount === 0) {
      console.log('🎉 Groups seeding completed successfully!');
    } else {
      console.log('⚠️ Groups seeding completed with some errors.');
    }

  } catch (error) {
    console.error('❌ Fatal error in seedGroupsWithValidation:', error);
    throw error;
  }
}

// Optional: Add validation function to verify seeding results
async function validateSeeding() {
  try {
    const totalGroups = await Group.countDocuments();
    const totalPermissions = await Permission.countDocuments();
    const activeGroups = await Group.countDocuments({ isActive: true });
    
    console.log('\n🔍 Validation Results:');
    console.log(`📊 Total groups in DB: ${totalGroups}`);
    console.log(`🔓 Total permissions in DB: ${totalPermissions}`);
    console.log(`✅ Active groups: ${activeGroups}`);
    
    // Check for groups without permissions
    const groupsWithoutPermissions = await Group.find({ 
      permissions: { $size: 0 } 
    }).select('code name');
    
    if (groupsWithoutPermissions.length > 0) {
      console.warn('⚠️ Groups without permissions:', 
        groupsWithoutPermissions.map(g => g.code)
      );
    }
    
    return {
      totalGroups,
      totalPermissions,
      activeGroups,
      groupsWithoutPermissions: groupsWithoutPermissions.length
    };
  } catch (error) {
    console.error('❌ Error in validation:', error);
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
          await importData();
          console.log('✅ Importation des données terminée.');
        // }
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


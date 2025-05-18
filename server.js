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

const Pharmacy = require('@models/Pharmacy');
const Activity = require('@models/Activity');
const { v4: uuidv4 } = require('uuid');

app.use(express.json());
app.use(cors());
app.use(helmet());

const generateProduct = () => {
    const categories = ['Médicaments', 'Cosmétiques', 'Hygiène', 'Bébé', 'Nutrition', 'Homéopathie'];
    
    return {
      id: uuidv4(),
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      price: parseFloat(faker.commerce.price(1, 200, 2)),
      imageUrl: faker.image.url(),
      stock: faker.number.int({ min: 0, max: 100 }),
      category: faker.helpers.arrayElement(categories)
    };
  };
  const generateOrders = (count) => {
    const orders = [];
    const statuses = ['pending', 'completed', 'cancelled'];
    const paymentStatuses = ['paid', 'unpaid'];
    const deliveryStatuses = ['pending', 'on-the-way', 'delivered'];
    
    for (let i = 0; i < count; i++) {
      const productsCount = faker.number.int({ min: 1, max: 5 });
      const products = [];
      let totalAmount = 0;
      
      for (let j = 0; j < productsCount; j++) {
        const product = generateProduct();
        products.push(product);
        totalAmount += product.price;
      }
      
      orders.push({
        id: uuidv4(),
        customer: uuidv4(), // Simulating a customer ID
        products: products,
        totalAmount: totalAmount,
        status: faker.helpers.arrayElement(statuses),
        paymentStatus: faker.helpers.arrayElement(paymentStatuses),
        deliveryStatus: faker.helpers.arrayElement(deliveryStatuses),
        deliveryPerson: faker.datatype.boolean() ? uuidv4() : undefined,
        createdAt: faker.date.recent({ days: 60 })
      });
    }
    
    return orders;
  };
  const generateOpeningHours = () => {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const workingHours = {};
    const openingHours = {};
    
    days.forEach(day => {
      const isClosed = day === 'Dimanche' ? faker.datatype.boolean({ probability: 0.8 }) : faker.datatype.boolean({ probability: 0.1 });
      
      let opening = faker.date.between({ from: '2023-01-01T08:00:00', to: '2023-01-01T10:00:00' });
      let closing = faker.date.between({ from: '2023-01-01T17:00:00', to: '2023-01-01T20:00:00' });
      
      const openingTime = opening.toTimeString().slice(0, 5);
      const closingTime = closing.toTimeString().slice(0, 5);
      
      workingHours[day] = {
        open: !isClosed,
        opening: openingTime,
        closing: closingTime
      };
      
      openingHours[day] = {
        open: !isClosed,
        opening: openingTime,
        closing: closingTime
      };
    });
    
    return { workingHours, openingHours };
  };
  const generateFrenchLocation = () => {
      const minLat = 41.3; // Southern France
      const maxLat = 51.1; // Northern France
      const minLon = -4.8; // Western France
      const maxLon = 9.6;  // Eastern France
  
    return {
      latitude: faker.location.latitude({ min: minLat, max: maxLat }),
      longitude: faker.location.longitude({ min: minLon, max: maxLon })
    };
  };
  const generatePharmacy = () => {
    const { workingHours, openingHours } = generateOpeningHours();
    const productsCount = faker.number.int({ min: 10, max: 50 });
    const ordersCount = faker.number.int({ min: 5, max: 30 });
    
    const products = [];
    for (let i = 0; i < productsCount; i++) {
      products.push(generateProduct());
    }
    
    const orders = generateOrders(ordersCount);
    
    const totalRevenue = orders.reduce((total, order) => {
      return order.status === 'completed' ? total + order.totalAmount : total;
    }, 0);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentOrders = orders.filter(order => new Date(order.createdAt) >= thirtyDaysAgo);
    const orders30days = recentOrders.length;
    
    const revenue30days = recentOrders.reduce((total, order) => {
      return order.status === 'completed' ? total + order.totalAmount : total;
    }, 0);
    
    const statusRandom = Math.random();
    let status;
    
    if (statusRandom < 0.6) {
      status = 'active';
    } else if (statusRandom < 0.7) {
      status = 'pending';
    } else if (statusRandom < 0.8) {
      status = 'inactive';
    } else if (statusRandom < 0.9) {
      status = 'suspended';
    } else if (statusRandom < 0.95) {
      status = 'rejected';
    } else {
      status = 'deleted';
    }
    
    // Generate suspension data if status is suspended
    let suspensionDate = null;
    let suspensionReason = null;
    
    if (status === 'suspended') {
      suspensionDate = faker.date.recent({ days: 60 });
      suspensionReason = faker.helpers.arrayElement([
        'Non-conformité aux règles sanitaires',
        'Inspection défavorable',
        'Plaintes de clients',
        'Fraude suspectée',
        'Demande du propriétaire'
      ]);
    }
    
    const registerDate = faker.date.past({ years: 5 });
    
    return {
      name: `Pharmacie ${faker.location.street()} ${faker.person.lastName()}`,
      address: faker.location.streetAddress(true),
      logoUrl: faker.datatype.boolean({ probability: 0.7 }) ? faker.image.url() : null,
      ownerId: uuidv4(), // Simulating an owner ID
      licenseNumber: `PH${faker.string.numeric(8)}`,
      siret: faker.string.numeric(14),
      phoneNumber: faker.phone.number(),
      email: faker.internet.email(),
      status: status,
      location: generateFrenchLocation(),
      products: products,
      workingHours: workingHours,
      openingHours: openingHours,
      orders: orders,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      suspensionDate: suspensionDate,
      suspensionReason: suspensionReason,
      registerDate: registerDate,
      orders30days: orders30days,
      revenue30days: parseFloat(revenue30days.toFixed(2)),
      rating: faker.datatype.boolean() ? parseFloat(faker.number.float({ min: 1, max: 5, precision: 0.1 }).toFixed(1)) : null
    };
  };
  const seedPharmacies = async (count) => {
    try {
      await Pharmacy.deleteMany({});
      console.log('Cleared existing pharmacies');
      
      const pharmacies = [];
      
      for (let i = 0; i < count; i++) {
        const pharmacy = generatePharmacy();
        pharmacies.push(pharmacy);
        
        if ((i + 1) % 10 === 0 || i === count - 1) {
          console.log(`Generated ${i + 1} of ${count} pharmacies`);
        }
      }
      
      await Pharmacy.insertMany(pharmacies);
      console.log(`Successfully seeded ${count} pharmacies`);
      
    } catch (error) {
      console.error('Error seeding pharmacies:', error);
    }
  };
async function importData() {
    try {
            console.log('🗑️ Suppression de toutes les collections...');
            const collections = await mongoose.connection.db.listCollections().toArray();
            for (let collection of collections) {
                await mongoose.connection.db.collection(collection.name).deleteMany({});

            const ok = await loadModels(path.join(__dirname, 'models'));
            if (ok) {
                const data = await fs.readFile('countries.json', 'utf8');
                const countries = JSON.parse(data);    
                const Country = require('@models/Country'); 
                await Country.insertMany(countries);
                console.log('🌍 Countries data has been added to the database!');
                seedPharmacies(100);
                seedActivities(300);
            } else {
                console.error('❌ Les modèles n\'ont pas pu être chargés.');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
        // process.exit(1);
    }
}

const generateActivity = () => {
  const types = ['order', 'pharmacy', 'payment', 'user', 'delivery'];
  // const types = ['login', 'logout', 'order_created', 'order_updated', 'pharmacy_updated', 'profile_updated'];
  const users = ['admin', 'deliver', 'customer', 'pharmacy_owner'];
  return {
    type: faker.helpers.arrayElement(types),
    title: faker.lorem.sentence(),
    userId: uuidv4(),
    id_object: uuidv4(),
    userType: faker.helpers.arrayElement(users),
    description: faker.lorem.sentence(),
    createdAt: faker.date.recent({ days: 60 })
  };
};

const seedActivities = async (count) => {
  try {
    await Activity.deleteMany({});
    console.log('Cleared existing activities');

    const activities = [];
    for (let i = 0; i < count; i++) {
      activities.push(generateActivity());
      if ((i + 1) % 10 === 0 || i === count - 1) {
        console.log(`Generated ${i + 1} of ${count} activities`);
      }
    }

    await Activity.insertMany(activities);
    console.log(`Successfully seeded ${count} activities`);
  } catch (error) {
    console.error('Error seeding activities:', error);
  }
};

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
                console.log(`✅ Modèle chargé : ${modelName}`);
            }
        }
        return true;  // Retourner true si les modèles sont chargés avec succès
    } catch (error) {
        console.error('❌ Error loading models:', error);
        return false;  // Retourner false si une erreur se produit
    }
}

const connectWithRetry = () => {
  console.log('🟡 Tentative de connexion MongoDB...');
  mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('✅ MongoDB connecté avec succès');
        if (process.env.NODE_ENV !== 'production') {
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


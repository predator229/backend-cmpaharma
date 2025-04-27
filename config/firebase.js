const firebaseAdmin = require('firebase-admin');
require('module-alias/register');

const adminServiceAccount = require('@firebase_files/cmpharmaadmin-firebase-adminsdk-fbsvc-5ec8c549e4.json');
const livreurServiceAccount = require('@firebase_files/pharmadelivery-6dd80-firebase-adminsdk-fbsvc-f1c8de4300.json');

let adminApp, livreurApp;

if (!firebaseAdmin.apps.find(app => app.name === 'admin-app')) {
  adminApp = firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(adminServiceAccount),
  }, 'admin-app');
} else {
  adminApp = firebaseAdmin.app('admin-app');
}

if (!firebaseAdmin.apps.find(app => app.name === 'deliver-app')) {
  livreurApp = firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(livreurServiceAccount),
  }, 'deliver-app');
} else {
  livreurApp = firebaseAdmin.app('livreur-app');
}

const getFirebaseApp = (type) => {
  if (type === 'admin') {
    return adminApp;
  } else if (type === 'deliver') {
    return livreurApp;
  } else {
    throw new Error('Unknown Firebase app type');
  }
};

module.exports = { getFirebaseApp };

const admin = require('firebase-admin');
const serviceAccount = require('../pharmadelivery-6dd80-firebase-adminsdk-fbsvc-f1c8de4300.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});
  
module.exports = admin;

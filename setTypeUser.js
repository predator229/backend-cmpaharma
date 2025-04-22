//
//require('dotenv').config();
//
//const mongoose = require('mongoose');
//const fs = require('fs');
//const TypeUser = require('./models/TypeUser'); // Assure-toi que ton modèle est bien importé
//
//// Connexion à MongoDB
//mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//.then(() => {
//  console.log('MongoDB Connected...');
//}).catch(err => {
//  console.log('MongoDB connection error:', err);
//});
//
//var typesUser = [
//    { title: 'Propriétaire', description: 'Propriétaire de compte'},
//    { title: 'Compte client', description: 'Propriétaire de d\'apartement'} ,
//    { title: 'Administrateur', description: 'Administarateur de de pharmadelivery'}
//];
//typesUser.forEach(element => {
//    saveindb = new TypeUser();
//    saveindb.title = element.title;
//    saveindb.description = element.description
//    saveindb.save()
//
//    console.log("gata");
//});
//
//mongoose.connection.close();

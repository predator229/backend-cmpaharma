require('module-alias/register');
require('dotenv').config();

const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse,registerActivity, loadAllPermissions, getUserInfoByEmail, createUserAndSendEmailLink } = require('@tools/flutter_tools');
const LocationBoundsService = require('@tools/LocationBoundsService');

const { parsePhoneNumberFromString } = require('libphonenumber-js');
const Uid = require('@models/Uid');
const Country = require('@models/Country');
const Mobil = require('@models/Mobil');
const Deliver = require('@models/Deliver');
const Admin = require('@models/Admin');
const SetupBase = require('../../models/SetupBase');
const Pharmacy = require('@models/Pharmacy');
const Activity = require('@models/Activity');
const Order = require('@models/Order');
const OpeningHours = require('@models/OpeningHours');
const Location = require('@models/Location');
const DeliveryZone = require('@models/DeliveryZone');
const ZoneCoordinates = require('@models/ZoneCoordinates');
const File = require('@models/File');
const Category = require('@models/Category');
const Product = require('@models/Product');
const Permission = require('@models/Permission');
const Conversation = require('@models/Conversation');
const Ticket = require('@models/Ticket');
const TicketTemplate = require('@models/TicketTemplate');
const TicketMessage = require('@models/TicketMessage');

const TicketStats = require('@tools/TicketStats');

const path = require('path');

const Group = require('@models/Group');
const MiniChatMessage = require('@models/MiniChatMessage');

const mongoose = require('mongoose');

const fs = require('fs');

const nodemailer = require('nodemailer');
const { query } = require('express');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', 
    port: 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER, 
        pass: process.env.MAIL_PASS,
    },
});

const authentificateUser = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;

        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        return res.status(200).json({'error':0, user: user, message: user.new_user ? 'Bienvenu !' : 'Bon retour !', onlyShowListPharm : the_admin.onlyShowListPharm  });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const loadGeneralsInfo = async (req, res) => {
    try {
        const { status, region, search, thisPeriod } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        user.onlyShowListPharm = the_admin.onlyShowListPharm;

        let query = {};
        
        if (status) { query.status = status;}
        if (region) {
            const locations = await Location.find({ latitude: region }).select('_id');
            const locationIds = locations.map(loc => loc._id);
            query.location = { $in: locationIds };
        }
        if (search) {
            const cleanedSearch = search.replace(/\s+/g, '').replace(/^(\+33|0)/, '');
            const regex = new RegExp(cleanedSearch, 'i');
            query.$or = [
                { name: regex },
                { address: regex },
                { email: regex },
                { phoneNumber: { $regex: regex } },
                { licenseNumber: regex },
                { siret: regex },
            ];
        }

        const pharmaciesCount = await Pharmacy.countDocuments(query);
        const adminCount = await Admin.countDocuments();
        const deliverCount = await Deliver.countDocuments();
        const totalUser = adminCount + deliverCount;

        //  pourcentage
            // period: 1 = mois dernier, 2 = année dernière, 3 = semaine dernière, 4 = jour précédent
        const now = new Date();
        let startPeriod, endPeriod;
        switch (parseInt(thisPeriod) || 1) {
            case 2: // année dernière
                startPeriod = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                endPeriod = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 3: // semaine dernière
                const dayOfWeek = now.getDay() || 7; // dimanche = 7
                const lastWeekStart = new Date(now);
                lastWeekStart.setDate(now.getDate() - dayOfWeek - 6);
                lastWeekStart.setHours(0, 0, 0, 0);

                const lastWeekEnd = new Date(now);
                lastWeekEnd.setDate(now.getDate() - dayOfWeek - 1);
                lastWeekEnd.setHours(23, 59, 59, 999);

                startPeriod = lastWeekStart;
                endPeriod = lastWeekEnd;
                break;
            case 4: // jour précédent
                startPeriod = new Date(now);
                startPeriod.setDate(now.getDate() - 1);
                startPeriod.setHours(0, 0, 0, 0);
                endPeriod = new Date(startPeriod);
                endPeriod.setHours(23, 59, 59, 999);
                break;
            case 1: // Mois dernier (par défaut)
            default:
                startPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endPeriod = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                break;
        }

        // Utilisateurs
        const adminCurrentPeriod = await Admin.countDocuments({createdAt: { $gte: endPeriod }});
        const deliverCurrentPeriod = await Deliver.countDocuments({createdAt: { $gte: endPeriod }});
        const totalCurrentPeriod = adminCurrentPeriod + deliverCurrentPeriod;

        const adminLastPeriod = await Admin.countDocuments({createdAt: { $gte: startPeriod, $lt: endPeriod }});
        const deliverLastPeriod = await Deliver.countDocuments({createdAt: { $gte: startPeriod, $lt: endPeriod }});
        const totalLastPeriod = adminLastPeriod + deliverLastPeriod;

        let percentIncreaseUser = 0;
        if (totalLastPeriod){
            if (totalCurrentPeriod > 0) { percentIncreaseUser = (totalLastPeriod / totalCurrentPeriod) * 100;}
            else { percentIncreaseUser = 0;}
        }
        else { percentIncreaseUser = 100;}

        // Pharmacies
        const pharmaciesCurrentPeriod = await Pharmacy.countDocuments({ createdAt: { $gte: endPeriod } });
        const pharmaciesLastPeriod = await Pharmacy.countDocuments({ createdAt: { $gte: startPeriod, $lt: endPeriod } });

        let percentIncreasePharmacies = 0;
        if (pharmaciesLastPeriod){
            if (pharmaciesCurrentPeriod > 0) { percentIncreasePharmacies = (pharmaciesLastPeriod / pharmaciesCurrentPeriod) * 100; }
            else { percentIncreasePharmacies = 0; }
        }
        else { percentIncreasePharmacies = 100; }

        const recentActivities = await Activity.find({})
            .sort({ "created_at.date": -1 })
            .limit(5);

        const recentPharmacies = await Pharmacy.find({})
            .sort({ "created_at.date": -1 })
            .limit(5);

        data = {
            global_infos : [
                {
                    name : 'Pharmacies',
                    type: percentIncreasePharmacies ? 1 : 0,
                    total: pharmaciesCount,
                    difference: percentIncreasePharmacies,
                    color: 'bg-success',
                    icon: 'fa fa-clinic-medical',
                    divicon: 'pharmacy-icon',
                    peperiod: pharmaciesCurrentPeriod,
                },
                {
                    name : 'Commandes',
                    type: 1,
                    total: 0,
                    difference: '0',
                    icon: 'fa fa-shopping-cart',
                    divicon: 'order-icon',
                },
                {
                    name : 'Revenus plateforme',
                    type: 1,
                    total: 0,
                    difference: '0',
                    icon: 'fa fa-euro-sign',
                    divicon: 'revenue-icon',
                },
                {
                    name : 'Utilisateurs',
                    type: percentIncreaseUser ? 1 : 0,
                    difference: percentIncreaseUser,
                    total: totalUser,
                    icon: 'fa fa-user',
                    divicon: 'user-icon',
                    peperiod: totalCurrentPeriod,
                }
            ],
            recent_activities: recentActivities,
            recent_pharmacies: recentPharmacies,
        };
        return res.status(200).json({'error':0, user: user, data: data, onlyShowListPharm : the_admin.onlyShowListPharm});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const loadAllActivities = async (req, res) => {
    try {
        const { status, region, search, thisPeriod, user_, all, prePage } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) && user.groups.length > 0
            ? user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code))
            : false;

        query = {};
        if (user_ && typeof user_ === 'string') {
            query.author = user_;
        } else if (user_ && typeof user_.toString === 'function') {
            query.author = user_.toString();
        }

        let query = {};
        let results = [];
        let ids = [];
        let activities = [];

        if (userInGroupAdmin) {

            const sections = ['categories','pharmacies','products'];
            for (const elmt of sections) {
                switch (elmt) {
                    case 'categories': results = await Category.find({});  break;
                    case 'products': results = await Product.find({});  break;
                    case 'pharmacies': results = Pharmacy.find({}); break;
                    default:break;
                }
                results.forEach(p => {
                    if (!ids.includes(p._id)){ ids.push(p._id) }
                });
            }
            if (ids.length) { query.id_object = { $in: ids }; }

            if (user_ && typeof user_ === 'string') {
                query.author = user_;
            } else if (user_ && typeof user_.toString === 'function') {
                query.author = user_.toString();
            }
            activities = await Activity.find(query).sort({ created_at: -1 });
        }

        data = {
            recent_activities: activities,
        };
        return res.status(200).json({'error':0, user: user, data: data, onlyShowListPharm : the_admin.onlyShowListPharm });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const setProfilInfo = async (req, res) => {
    try {
        const { name, surname, email, phone, countryCode } = req.body;
        if (!name || !surname ) { //|| !email || !phone || !countryCode
            return res.status(400).json({ message: 'Missing required fields' });   
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        user.name = name;
        user.surname = surname;
        await user.save();

        return res.status(200).json({'error':0, user: user, message: 'Modification effectuee avec success !' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const setSettingsFont = async (req, res) => {
    try {
        const { font } = req.body;
        if (!font) {
            return res.status(400).json({ message: 'Missing required fields' });   
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const setups = await SetupBase.findOne({ _id: user.setups._id });
        if (!setups) {
            return res.status(404).json({ message: 'Setup not found' });
        }
        setups.font_family = font;
        await setups.save();
        await registerActivity('General Settings', setups._id, user._id,  "Parametre generals modifier", "Les parametres generaux de l'utilisateur ont ete modifies pour l\'utilisateur "+user.name);

        user.setups = setups;

        return res.status(200).json({'error':0, user: user, message: 'Modification effectuee avec success !', onlyShowListPharm : the_admin.onlyShowListPharm });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieList = async (req, res) => {
    try {
        const { status, region, search, andUsersList } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
      
        if (status) { query.status = status;}
        if (region) {
            const locations = await Location.find({ latitude: region }).select('_id');
            const locationIds = locations.map(loc => loc._id);
            query.location = { $in: locationIds };
        }
        if (search) {
            const cleanedSearch = search.replace(/\s+/g, '').replace(/^(\+33|0)/, '');
            const regex = new RegExp(cleanedSearch, 'i');
            query.$or = [
                { name: regex },
                { address: regex },
                { email: regex },
                { phoneNumber: { $regex: regex } },
                { licenseNumber: regex },
                { siret: regex },
            ];
        }
        let pharmacies =  [];
        if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query._id = { $in: user.pharmaciesManaged.map(pharm => pharm._id) };
            pharmacies = await Pharmacy.find(query).populate('location').lean();
        }else{
            if ( user?.groups?.some(g => ['superadmin','admin', 'manager'].includes(g.code))) {
                pharmacies = await Pharmacy.find(query).populate('location').lean();
            }else{
                return res.status(200).json({'error':0, user: user, data: pharmacies, query: query });
            }
        }
        pharmacies = await Promise.all(pharmacies.map(async function (pharmacy) { 
            var rorders30days = await Order.find({ pharmacy_id: pharmacy._id, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
                        .populate('deliver_id')
                        .populate('customer_id')
                        .populate('products');
            pharmacy.revenue30days = rorders30days.reduce((total, order) => total + (order.totalAmount || 0), 0);
            pharmacy.rorders30days = rorders30days.length;
            if (!pharmacy.id) { pharmacy.id = pharmacy._id; }
            return pharmacy;
        }));

        const usersList = {};
        const usersArray = [];
        if (andUsersList) {
            const users = pharmacies.map(pharm => pharm._id) ? await Admin.find({ pharmaciesManaged: { $in: pharmacies.map(pharm => pharm._id) } }) : [];
            users.map(user => {
                if (!usersList[user._id]) { usersList[user._id] = { key: user._id, name: user.name+' '+user.surname }; }
                usersArray.push({ key: user._id, name: user.name+' '+user.surname });
            });
        }

        return res.status(200).json({'error':0,  usersArray, usersList, user: user, data: pharmacies, onlyShowListPharm : the_admin.onlyShowListPharm });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieDetails = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let pharmacy = await Pharmacy.findById(id)
                .populate([
                    { path: 'location'},
                    { path: 'country'},
                    { path: 'workingHours'},
                    {path: 'deliveryZone', populate: [
                        { path: 'coordinates', populate: [
                            {path: 'points'},
                        ]},
                    ]},
                    { path: 'documents', populate: [
                        { path: 'logo'},
                        { path: 'license'},
                        { path: 'idDocument'},
                        { path: 'insurance'},
                    ]},
                ]);

        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' }); }
        pharmacy.orders = await Order.find({ pharmacy_id: pharmacy._id, status: 'pending' })
                                        .populate('deliver_id')
                                        .populate('customer_id')
                                        .populate('products');
        pharmacy.orders30days = await Order.find({ pharmacy_id: pharmacy._id, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
                                    .populate('deliver_id')
                                    .populate('customer_id')
                                    .populate('products');
        pharmacy.revenue30days  = pharmacy.orders30days.reduce((total, order) => total + order.totalAmount, 0);

        pharmacy.logoUrl = pharmacy.logoUrl ?? pharmacy.documents?.logo?.url;

        return res.status(200).json({'error':0, logoUrl:pharmacy.documents?.logo?.url ?? 'heh', data: pharmacy, user: user });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieNew = async (req, res) => {
    try {
        const { name, address, logoUrl, licenseNumber, siret, phoneNumber, email, location, workingHours, openingHours, country, city } = req.body;
        if (!name || !address || !logoUrl || !licenseNumber  || !siret  || !phoneNumber  || !email  || !location || !workingHours || !openingHours || !country || !city ) { return res.status(400).json({ message: 'Tous les champs obligatoires sont requis !' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const existingPharmacy = await Pharmacy.findOne({ $or: [ { email }, { licenseNumber }, { siret } ] });
        if (existingPharmacy) {
            return res.status(400).json({
              success: false,
              message: 'Une pharmacie avec cet email, numéro de licence ou SIRET existe déjà'
            });
        }

        var location_ = new Location(location);
        await location_.save();

        // workingHours, openingHours

        const theCountrie = await Country.findOne({ name: country });
        if (!theCountrie) {
            return res.status(400).json({ message: 'Pays non trouvé' });
        }

        const pharmacy = new Pharmacy({ name, address, logoUrl, ownerId: req.user.id, licenseNumber, siret, phoneNumber, email, status: 'pending', location: location_._id, country: theCountrie._id, city:city });
        await pharmacy.save();
        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},

            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);

        await registerActivity('Pharmacie', pharmacy._id, user._id,  "Pharmacie Ajoute", "La pharmacie "+pharmacy.name+" a ete ajoute!");
        await registerActivity('Location', pharmacy._id, user._id,  "Emplacement Ajoute", "L\'emplacement de la pharmacie "+pharmacy.name+" a ete ajoute!");

        return res.status(200).json({'error':0, success: true, user: user, data: pharmacy });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieEdit = async (req, res) => {
    try {
        const { id, name, address, logoUrl, phoneNumber, email, location, workingHours, openingHours, country, city } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        if (name) pharmacy.name = name;
        if (address) pharmacy.address = address;
        if (logoUrl) pharmacy.logoUrl = logoUrl;
        if (phoneNumber) pharmacy.phoneNumber = phoneNumber;
        if (email) pharmacy.email = email;
        if (city) pharmacy.city = city;
        
        if (country) {
            theCountrie = await Country.findOne({ name: country });
            pharmacy.country = theCountrie._id;
        }

        // if (workingHours) pharmacy.workingHours = workingHours;
        // if (openingHours) pharmacy.openingHours = openingHours;
        
        await pharmacy.save();
        await registerActivity('Pharmacie', pharmacy._id, user._id,  "Pharmacie Modifiee", "Les informations de la pharmacie "+pharmacy.name+" a ete modifie!");
        if (location) {
            var theLoc = await Location.find({ _id: location._id });
                if (theLoc && (theLoc.latitude !== location.latitude || theLoc.longitude !== location.longitude)) {
                theLoc.latitude = theLoc.latitude;
                theLoc.longitude = theLoc.longitude;
                await theLoc.save();
                await registerActivity('Location', pharmacy._id, user._id,  "Emplacement Modifie", "L\'emplacement de la pharmacie "+pharmacy.name+" a ete modifie!");
            }
        }

        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);

        return res.status(200).json({'error':0, success: true, user: user, data: pharmacy });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieDelete = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        await pharmacy.deleteOne();
  
        res.json({ error: 0, success: true, message: 'Pharmacie supprimée avec succès' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieApprove = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        if (pharmacy.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cette pharmacie n\'est pas en attente d\'approbation' });
        }
          
        pharmacy.status = 'active';
        await pharmacy.save();
        await registerActivity('Pharmacie', pharmacy._id, user._id, "Pharmacie Modifiee", "Le statut de la pharmacie "+pharmacy.name+" a ete modifie en "+ pharmacy.status);
      
        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);
        return res.status(200).json({'error':0, success: true,user: user, data: pharmacy });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieSuspend= async (req, res) => {
    try {
        const { id, reason } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        if (pharmacy.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Cette pharmacie n\'est pas active' });
        }
          
        pharmacy.status = 'suspended';
        pharmacy.suspensionDate = new Date();
        pharmacy.suspensionReason = reason || 'Suspension administrative';
        await pharmacy.save();
        await registerActivity('Pharmacie', pharmacy._id, user._id,  "Pharmacie Modifiee", "Le statut de la pharmacie "+pharmacy.name+" a ete modifie en "+ pharmacy.status);

        return res.status(200).json({'error':0, success: true,user: user, data: pharmacy });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieActive= async (req, res) => {
    try {
        const { id } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        if (pharmacy.status !== 'suspended' && pharmacy.status !== 'inactive') {
            return res.status(400).json({ success: false, message: 'Cette pharmacie n\'est pas suspendue ou inactive' });
        }
          
        pharmacy.status = 'active';
        pharmacy.suspensionDate = null;
        pharmacy.suspensionReason = null;
        await pharmacy.save();
        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);
        await registerActivity('Pharmacie', pharmacy._id, user._id,  "Pharmacie Modifiee", "Le statut de la pharmacie "+pharmacy.name+" a ete modifie en "+ pharmacy.status);

        return res.status(200).json({'error':0,success: true, user: user, data: pharmacy });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieReject= async (req, res) => {
    try {
        const { id, reason } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        if (pharmacy.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cette pharmacie n\'est pas en attente d\'approbation' });
        }
          
        pharmacy.status = 'rejected';
        pharmacy.suspensionReason = reason || 'Demande rejetée';
        await pharmacy.save();
        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);
        await registerActivity('Pharmacie', pharmacy._id, user._id,  "Pharmacie Modifiee", "Le statut de la pharmacie "+pharmacy.name+" a ete modifie en "+ pharmacy.status);
            
        return res.status(200).json({'error':0,success: true, user: user, data: pharmacy });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieDocuments= async (req, res) => {
    try {
        const { id, type_ } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);

        // This is a placeholder for document retrieval logic
        // In a real application, this would retrieve documents from a storage service
      
        res.json({ 'error':0,  success: true, user: user, data:  pharmacy, message: `Document ${type_} pour la pharmacie ${pharmacy.name} visualisé` });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieDocumentsDownload = async (req, res) => {
    try {
        const { id, type_ } = req.body;
        if (!id ) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });}

        pharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);
        // This is a placeholder for document retrieval logic
        // In a real application, this would retrieve documents from a storage service
      
        res.json({ 'error':0,  success: true, user: user, data:  pharmacy, message: `Document ${type_} pour la pharmacie ${pharmacy.name} téléchargé` });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieCategorieImagesUpload = async (req, res) => {
    try {
        const { type_, categoryId, uid } = req.body;
        const file = req.file;

        const missingFields = [];
        if (!file) missingFields.push('file');
        if (!type_ || !['imageUrl', 'iconUrl'].includes(type_)) missingFields.push('type_');
        if (!categoryId) missingFields.push('categoryId');
        if (!uid) missingFields.push('uid');

        if (missingFields.length > 0) {
            return res.status(400).json({ message: 'Missing required fields', missingFields });
        }

        req.body.type = "admin"

        const the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) return res.status(404).json({ message: 'User not found' });

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const category = await Category.findById(categoryId);
        if (!category) return res.status(404).json({ error: 1, success: false, message: 'Category non trouvée' });

        const thetime = Date.now().toString();
        const extension = file.originalname ? file.originalname.split('.').pop() : 'png';

        const existant = await File.find({
            fileType: type_,
            'linkedTo.model': 'Category',
            'linkedTo.objectId': category._id
        });
        if (existant.length > 0) {
            await File.deleteMany({
                fileType: type_,
                'linkedTo.model': 'Category',
                'linkedTo.objectId': category._id
            });
            for (const f of existant) {
                if (f.url && fs.existsSync(f.url)) {
                    try { fs.unlinkSync(f.url); } catch (e) {}
                }
            }
        }

        const uploadDir = path.join(__dirname, '../../uploads', categoryId, type_);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const newFilePath = file.path.replace('uploads/',`uploads/${categoryId}/${type_}/` );
        fs.renameSync(file.path, newFilePath);
        file.path = newFilePath;
        const file_ = new File({
            originalName: file.originalname ?? ("new_file_" + thetime),
            fileName: `${category.name}_${type_}_${thetime}.${extension}`,
            fileType: type_,
            fileSize: file.size,
            url: file.path,
            extension: extension,
            uploadedBy: user._id,
            linkedTo: { model: "Category", objectId: category._id, },
            tags: [],
            isPrivate: true,
            meta: {
                width: file.width ?? 200,
                height: file.height ?? 200,
                pages: file.page ?? 1
            }
        });

        await file_.save();

        // if (type_ != 'chat_pharm_apartment'){
            if (type_ == 'imageUrl') {  category.imageUrl = file_._id;; }
            if (type_ == 'iconUrl') {  category.iconUrl = file_._id;; }
            await category.save();
        // }
        category.populate([
            { path: 'imageUrl'},
            { path: 'iconUrl'},
            { path: 'parentCategory'},
            { path: 'pharmaciesList', populate : [
                    { path: 'location'},
                    { path: 'country'},
                    { path: 'workingHours'},
                    {path: 'deliveryZone', populate: [
                        { path: 'coordinates', populate: [
                            {path: 'points'},
                        ]},
                    ]},
                    { path: 'documents', populate: [
                        { path: 'logo'},
                        { path: 'license'},
                        { path: 'idDocument'},
                        { path: 'insurance'},
                    ]},
                ],
            },
            { path: 'subcategories'}
        ]);

        // if (type_ != 'chat_pharm_apartment'){
            // await loadAllActivitiesAndSendMailAdmins(pharmacy, ['document'], user, type_);
            await registerActivity('Categorie', category._id, user._id, "Mise a jour Categorie", `L\'${ type_ == 'imageUrl' ? 'image' : 'icone' } de la categorie ${category.name} a été mise à jour !`);
        // }
        res.json({ error: 0, success: true, fileId: file_._id,  user: user, data: category, message: `Document ${type_} pour la pharmacie ${category.name} uploadé avec succès sur le serveur` });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieDocumentsUpload = async (req, res) => {
    try {
        const { type_, pharmacyId, uid } = req.body;
        const file = req.file;

        const missingFields = [];
        if (!file) missingFields.push('file');
        if (!type_ || !['logo', 'license', 'idDocument', 'insurance', 'chat_pharm_apartment', 'internal_chat'].includes(type_)) missingFields.push('type_');
        if (!pharmacyId) missingFields.push('pharmacyId');
        if (!uid) missingFields.push('uid');

        if (missingFields.length > 0) {
            return res.status(400).json({ message: 'Missing required fields', missingFields });
        }

        req.body.type = "admin"

        const the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) return res.status(404).json({ message: 'User not found' });

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const pharmacy = type_ == 'internal_chat' ? await Conversation.findById(pharmacyId) :  await Pharmacy.findById(pharmacyId);
        if (!pharmacy) return res.status(404).json({ error: 1, success: false, message: 'Pharmacie non trouvée' });

        const thetime = Date.now().toString();
        const extension = file.originalname ? file.originalname.split('.').pop() : 'png';

        if (['chat_pharm_apartment', 'internal_chat'].includes(type_)) {
            const existant = await File.find({
                fileType: type_,
                'linkedTo.model': 'Pharmacies',
                'linkedTo.objectId': pharmacy._id
            });
            if (existant.length > 0) {
                await File.deleteMany({
                    fileType: type_,
                    'linkedTo.model': 'Pharmacies',
                    'linkedTo.objectId': pharmacy._id
                });
                for (const f of existant) {
                    if (f.url && fs.existsSync(f.url)) {
                        try { fs.unlinkSync(f.url); } catch (e) {}
                    }
                }
            }
        }

        const uploadDir = path.join(__dirname, '../../uploads', pharmacyId, type_);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const newFilePath = file.path.replace('uploads/',`uploads/${pharmacyId}/${type_}/` );
        fs.renameSync(file.path, newFilePath);
        file.path = newFilePath;
        const file_ = new File({
            originalName: file.originalname ?? ("new_file_" + thetime),
            fileName: `${pharmacy.name ?? 'conv_'+pharmacyId}_${type_}_${thetime}.${extension}`,
            fileType: type_,
            fileSize: file.size,
            url: file.path,
            extension: extension,
            uploadedBy: user._id,
            linkedTo: { model: type_ == 'internal_chat' ? 'Conversations' :"Pharmacies", objectId: pharmacy._id, },
            tags: [],
            isPrivate: type_ === 'logo',
            meta: {
                width: file.width ?? 200,
                height: file.height ?? 200,
                pages: file.page ?? 1
            }
        });

        await file_.save();

        if (!['chat_pharm_apartment', 'internal_chat'].includes(type_)){
            pharmacy.documents = pharmacy.documents || {};
            pharmacy.documents[type_] = file_._id;
            await pharmacy.save();
            pharmacy.populate([
                { path: 'location'},
                { path: 'country'},
                { path: 'workingHours'},
                {path: 'deliveryZone', populate: [
                    { path: 'coordinates', populate: [{path: 'points'},]},
                    
                ]},
                { path: 'documents', populate: [
                    { path: 'logo'},
                    { path: 'license'},
                    { path: 'idDocument'},
                    { path: 'insurance'},
                ]},
            ]);
            await loadAllActivitiesAndSendMailAdmins(pharmacy, ['document'], user, type_);
        }
        res.json({ error: 0, success: true, fileId: file_._id,  user: user, data: pharmacy, message: `Document ${type_} pour la pharmacie ${pharmacy.name} uploadé avec succès sur le serveur` });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieUpdate = async (req, res) => {
    try {
        let { 
            id, name, address, phoneNumber, email, licenseNumber, siret, 
            location, workingHours, suspensionDate, suspensionReason, comentaire, country, city, deliveryZone, deliveryServices 
        } = req.body;

        if (!id || !name || !address || !phoneNumber || !email || !licenseNumber || !siret || !country || !city) {
            return res.status(400).json({ 
                success: false,
                error:0,
                message: 'Tous les champs obligatoires doivent être renseignés' 
            });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { 
            return res.status(404).json({ message: 'User not found' }); 
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const existingPharmacy = await Pharmacy.findById(id);
        if (!existingPharmacy) {
            return res.status(404).json({
                error : 1,
                success: false,
                message: 'Pharmacie non trouvée'
            });
        }

        const duplicatePharmacy = await Pharmacy.findOne({ 
            _id: { $ne: id },
            $or: [{ email }, { licenseNumber }, { siret }] 
        });
        
        if (duplicatePharmacy) {
            return res.status(400).json({
                error : 1,
                success: false,
                message: 'Une autre pharmacie avec cet email, numéro de licence ou SIRET existe déjà'
            });
        }

        if (deliveryServices) {
            if (typeof deliveryServices.homeDelivery == 'undefined' || typeof deliveryServices.pickupInStore == 'undefined' || typeof deliveryServices.expressDelivery == 'undefined' || typeof deliveryServices.scheduledDelivery == 'undefined') {
                return res.status(400).json({
                    error : 1,
                    success: false,
                    message: 'Les services de livraison doivent être spécifiés'
                });
            }
        }

        const theCountrie = await Country.findOne({ _id: country });
        let newCountrie = null;
        if (!theCountrie) {
            return res.status(400).json({
                error : 1,
                success: false,
                message: `Le pays ${country} n'existe pas dans notre base de données`
            });
        }else{
            if (existingPharmacy.country !== theCountrie._id) {
                newCountrie = theCountrie._id;
            }
        }

        let newCity = null;
        if (city) {
            if (existingPharmacy.city !== city) {
                location = null;
                if (existingPharmacy.location){ await Location.deleteMany({_id: existingPharmacy.location}); }
                existingPharmacy.location = null;
                existingPharmacy.city = city;
                newCity = city;
                if (existingPharmacy.cityBounds){ await ZoneCoordinates.deleteMany({_id: existingPharmacy.cityBounds}); }
                existingPharmacy.cityBounds = null;
                if (existingPharmacy.deliveryZone){ await DeliveryZone.deleteMany({_id: existingPharmacy.cityBounds}); }
                existingPharmacy.deliveryZone = null;
            }
            // ici on creer le cityBounds
        }
        let existingLocation = null;
        if (location) {
            let verif = false;
            existingLocation = existingPharmacy.location ? await Location.findById(existingPharmacy.location) : null;

            if (existingLocation) {
                if (location.latitude != existingLocation.latitude || location.longitude != existingLocation.longitude) { verif = true; }
            }else{
                verif = true;
                existingLocation = new Location();
            }
            if (verif){
                if (!location.latitude || !location.longitude) {
                    return res.status(400).json({
                        error : 1,
                        success: false,
                        message: 'Les coordonnées de localisation (latitude et longitude) sont requises pour modifier la localisation de la pharmacie'
                    });
                }
                if((!existingPharmacy.city && !city) || (!existingPharmacy.country && !theCountrie)){
                    return res.status(400).json({
                        error : 1,
                        success: false,
                        message: 'La ville et le pays doivent être définis pour modifier la localisation de la pharmacie'
                    });
                }
                const cccc = theCountrie ?? await Country.findById(existingPharmacy.country);
                const locationService = new LocationBoundsService();
                const isIt = cccc ? await locationService.isLocationInCityBounds({city : city ?? existingPharmacy.city, country : cccc}, location) : false;
                if (!isIt || isIt.isInBounds === false) {
                    return res.status(200).json({
                        error : 1,
                        success: false,
                        message: isIt ? `La localisation de la pharmacie que vous essayer d\'enregistrer  n\'est pas dans les limites de la ville que vous avez defini pour la pharmacie (${isIt.cityName}). Veuillez vérifier les coordonnées.` : 'Erreur lors de la vérification des limites de la ville. Veuillez réessayer plus tard.'
                    });
                }
                existingLocation.latitude = location.latitude;
                existingLocation.longitude = location.longitude;
            }
        }
        let updates = [];

        var message = existingPharmacy.status == 'pending' ? 'Pharmacie mise à jour avec succès. Nos administrateurs vont procéder à la vérification des informations fournies. Vous serez notifié par e-mail une fois la validation effectuée.' : 'Pharmacie mise à jour avec succès.';


        let workingHoursIds = [];
        if (workingHours && workingHours.length > 0) {
            if (existingPharmacy.workingHours && existingPharmacy.workingHours.length > 0) {
                await OpeningHours.deleteMany({ _id: { $in: existingPharmacy.workingHours } });
            }

            for (const hour of workingHours) {
                if (hour.open) {
                    const openingHour = new OpeningHours({
                        day: hour.day,
                        open: hour.open,
                        opening: hour.opening,
                        closing: hour.closing
                    });
                    await openingHour.save();
                    workingHoursIds.push(openingHour._id);
                }
            }
        }

        const requiredDoc = ['license', 'idDocument', 'insurance'];
        for (const element of requiredDoc) {
            var doc = existingPharmacy.documents[element]  ? await File.findOne({_id: existingPharmacy.documents[element] }) : null;
            if (!doc || doc == null ) {
                const nameDoc = element == 'license' ? 'license pharmaceutique' : (  element == 'idDocument' ? 'Pièce d\'identité'  : 'attestation d\'assurance')
                 return res.status(200).json({
                    error : 1,
                    success: false,
                    message: `Le document : ${nameDoc} est requis ! \n Veuillez l'uploader pour continuer.`
                });
            }
        }

        let newDeliveryZone = null;
        if (deliveryZone) {
            if ( !deliveryZone.coordinates || !deliveryZone.coordinates.points || deliveryZone.coordinates.points.length < 3) {
            return res.status(400).json({
                error: 1,
                success: false,
                message: 'Les coordonnées de la zone de livraison sont requises et doivent contenir au moins 3 points'
            });
            }

            // Récupérer ou créer la zone de livraison
            newDeliveryZone = existingPharmacy.deliveryZone ? await DeliveryZone.findById(existingPharmacy.deliveryZone) : new DeliveryZone();

            // Récupérer ou créer les coordonnées de la zone
            let zoneCoordinates;
            if (newDeliveryZone.coordinates) {
                zoneCoordinates = await ZoneCoordinates.findById(newDeliveryZone.coordinates);
                // Supprimer les anciens points
                if (zoneCoordinates && Array.isArray(zoneCoordinates.points) && zoneCoordinates.points.length) {
                    await Location.deleteMany({ _id: { $in: zoneCoordinates.points } });
                }
            } else {
                zoneCoordinates = new ZoneCoordinates();
            }

            // Créer et sauvegarder les nouveaux points
            const newPoints = [];
            for (const point of deliveryZone.coordinates.points) {
            const newPoint = new Location({
                latitude: point.latitude,
                longitude: point.longitude
            });
            await newPoint.save();
            newPoints.push(newPoint._id);
            }
            zoneCoordinates.points = newPoints;
            await zoneCoordinates.save();

            // Mettre à jour la zone de livraison
            newDeliveryZone.coordinates = zoneCoordinates._id;
            newDeliveryZone.type = deliveryZone.type || 'zone';
            newDeliveryZone.radius = deliveryZone.radius || 20;
            newDeliveryZone.isActive = typeof deliveryZone.isActive === 'boolean' ? deliveryZone.isActive : true;
            newDeliveryZone.maxSelectionArea = deliveryZone.maxSelectionArea || 1000;
            await newDeliveryZone.save();
        }

        const updateData = {
            name,
            address,
            phoneNumber,
            email,
            licenseNumber,
            siret,
            status: existingPharmacy.status, 
            // suspensionDate: suspensionDate ? new Date(suspensionDate) : null,
            // suspensionReason,
            country: theCountrie._id,
            city,
            comentaire,
            deliveryZone: newDeliveryZone,
            deliveryServices: deliveryServices ?? {
                homeDelivery: true,
                pickupInStore: true,
                expressDelivery: false,
                scheduledDelivery: false,
            }
        };

        if (deliveryServices) {
            updates.push('deliveryServices');
        }

        if (existingLocation) {
            await existingLocation.save();
            updateData.location = existingLocation._id;
            updates.push('location');
        }
        if (newCity){
            updates.push('city');
        }
        if (address != existingPharmacy.address){
            updates.push('address');
        }
        if (newCountrie){
            updates.push('country');
        }         
        if (phoneNumber !== existingPharmacy.phoneNumber){
            updates.push('phoneNumber');
        }
        if (email !== existingPharmacy.email){
            updates.push('email');
        }
        if (licenseNumber !== existingPharmacy.licenseNumber){
            updates.push('licenseNumber');
        }
        if (siret !== existingPharmacy.siret){
            updates.push('siret');
        }
        
        const setPending = ['city', 'country', 'phoneNumber', 'email', 'siret', 'licenseNumber', 'adress' ];

        if (setPending.some(update => updates.includes(update)) || existingPharmacy.status == 'pending') {
            updateData.status = 'inactive';
        }

        if (newDeliveryZone) {
            updateData.deliveryZone = newDeliveryZone._id;
            updates.push('deliveryZone');
        }
        
        if (workingHoursIds.length > 0) {
            updateData.workingHours = workingHoursIds;
            updates.push('workingsHours');
        }

        const updatedPharmacy = await Pharmacy.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true, runValidators: true }
        ).populate('location').populate('workingHours');

        await loadAllActivitiesAndSendMailAdmins(existingPharmacy, updates, user, '');

        updatedPharmacy.populate([
            { path: 'location'},
            { path: 'country'},
            { path: 'workingHours'},
            {path: 'deliveryZone', populate: [
                { path: 'coordinates', populate: [{path: 'points'},]},
                
            ]},
            { path: 'documents', populate: [
                { path: 'logo'},
                { path: 'license'},
                { path: 'idDocument'},
                { path: 'insurance'},
            ]},
        ]);

        return res.status(200).json({
            error: 0,
            success: true,
            message: message,
            user: user,
            data: updatedPharmacy
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de la pharmacie:', error);
        return res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
};
const pharmacieWorkingsHours = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' }); }

        var workingHours = [];
        workingHours = pharmacy.workingHours != null && pharmacy.workingHours.length > 0 ? await OpeningHours.find({ _id: { $in: pharmacy.workingHours } }) : workingHours;

        const daysOfWeek = [1,2,3,4,5,6,7];
        for (let index = 0; index < daysOfWeek.length; index++) {
            const element = daysOfWeek[index];
            if (workingHours.find(each => each.day === daysOfWeek[index])) {
                continue;
            }else{
                workingHours.push({
                    _id: 0,
                    day: daysOfWeek[index],
                    open: false,
                    opening: '08:00',
                    closing: '18:00'
                });
            }
        }
        workingHours.sort((a, b) => a.day - b.day);

        return res.status(200).json({'error':0, user: user, data: workingHours });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieLocation = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) { return res.status(400).json({ message: 'Missing required fields' }); }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let pharmacy = await Pharmacy.findById(id);
        if (!pharmacy) { return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' }); }

        if (!pharmacy.location) {}
        
        return res.status(200).json({'error':0, user: user, data: workingHours });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieActivities = async (req, res) => {
    try {
        const the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) && user.groups.length > 0
            ? user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code))
            : false;

        let { id, all, user_ } = req.body;

        if ((!id || (Array.isArray(id) && id.length === 0)) && !userInGroupAdmin) {
            id = user.pharmaciesManaged?.map(pharm => pharm._id) ?? null;
            if (!id || id.length === 0) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
        }

        const pharmacies = id
            ? await Pharmacy.find({ _id: Array.isArray(id) ? { $in: id } : id })
            : [];

        if ((!pharmacies || pharmacies.length === 0) && !userInGroupAdmin) {
            return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });
        }

        const query = {};
        if (user_ && typeof user_ === 'string') {
            query.author = user_;
        } else if (user_ && typeof user_.toString === 'function') {
            query.author = user_.toString();
        }

        if (pharmacies && pharmacies.length > 0) {
            query.id_object = { $in: pharmacies.map(c => c._id) };
        }

        const activities = all
            ? await Activity.find(query).sort({ created_at: -1 })
            : await Activity.find(query).sort({ created_at: -1 }).limit(10);

        const validAuthorIds = activities?.map(act => act.author).filter(id => mongoose.Types.ObjectId.isValid(id)) || [];

        const users = validAuthorIds.length > 0
            ? await Admin.find({ _id: { $in: validAuthorIds } }).lean()
            : [];

        const usersMap = {};
        users.forEach(each => {
            const photoURL = each.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(each.name || 'User')}&background=random&size=500`;

            if (each._id && mongoose.Types.ObjectId.isValid(each._id)) {
                usersMap[each._id] = {
                    name: each._id.toString() === user._id.toString() ? 'Vous' : `${each.name} ${each.surname ?? ''}`.trim(),
                    img: photoURL,
                };
            }
        });

        return res.status(200).json({ error: 0, usersMap, data: activities, user });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const AllPharmacieActivities = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        var user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) && user.groups.length > 0
            ? user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code))
            : false;

        let {  all, user_ } = req.body;
        const idPharmacies = user.pharmaciesManaged?.map( pharm => pharm._id );

        let pharmacies = idPharmacies ? await Pharmacy.find( {_id :  {$in : idPharmacies} }) : false;
        if (!pharmacies && !userInGroupAdmin) { 
            return res.status(404).json({ success: false, message: 'Vous n\'avez pas le droit d\'acceder a ces informations!' });
        }

        let query = {};
        let results = [];
        let ids = [];
    
        if (Array.isArray(pharmacies) && pharmacies.length) {
            const sections = ['categories','pharmacies','products'];
            for (const elmt of sections) {
                switch (elmt) {
                    case 'categories': results = await Category.find({ pharmaciesList: { $in: idPharmacies } });  break;
                    case 'products': results = await Product.find({ "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) }} );  break;
                    case 'pharmacies': results = pharmacies; break;
                    default:break;
                }
                results.forEach(p => {
                     if (!ids.includes(p._id)){ ids.push(p._id) }
                });
            }
            if (ids.length) { query.id_object = { $in: ids }; }
        }
        if (user_ && typeof user_ === 'string') {
            query.author = user_;
        } else if (user_ && typeof user_.toString === 'function') {
            query.author = user_.toString();
        }
        const activities = all ? await Activity.find(query).sort({ created_at: -1 }) : await Activity.find(query).sort({ created_at: -1 }).limit(10);
       
        const validAuthorIds = activities
            ? activities.map(act => act.author).filter(id => mongoose.Types.ObjectId.isValid(id))
            : [];
        const users = validAuthorIds.length > 0 ? await Admin.find({ _id: { $in: validAuthorIds } }).lean() : [];
        const usersMap = {};
        users.forEach(each => {
            each.photoURL = each.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(each.name || 'User')}&background=random&size=500`;
            if (each._id && mongoose.Types.ObjectId.isValid(each._id)) {
                usersMap[each._id] = {
                    'name' : each._id.toString() == user._id.toString() ? 'Vous' : each.name+' '+each.surname,
                    'img' : each.photoURL
                };
            }
        });
        return res.status(200).json({'error':0, ids, usersMap: usersMap, data: activities, user: user });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const pharmacyCategoriesList = async(req, res)=> {
    try {
        const { status, level, pharmaciesId, search } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
      
        if (level) { query.level = level; }
       
        if (search) {
            const cleanedSearch = search.replace(/\s+/g, '').replace(/^(\+33|0)/, '');
            const regex = new RegExp(cleanedSearch, 'i');
            query.$or = [
                { name: regex },
                { address: regex },
                { email: regex },
                { phoneNumber: { $regex: regex } },
                { licenseNumber: regex },
                { siret: regex },
            ];
        }
        const catPharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code)) ? user.pharmaciesManaged.map(pharm => pharm._id) : [];
        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code)) ? user.pharmaciesManaged.map(pharm => ({ value: pharm._id, label: pharm.name })) : [];

        if (pharmaciesId) {
            query.pharmaciesList = { $in: pharmaciesId };
        }else  if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query.pharmaciesList = { $in: catPharmaciesList };
        }else{
            return res.status(200).json({'error':0, putin:'he merde je suis ici', user: user, data: [], query: query });
        }

        query.status = { $nin : ['deleted'] };

        let categories = await Category.find(query)
                                .populate([
                                { path: 'imageUrl'},
                                { path: 'iconUrl'},
                                { path: 'parentCategory'},
                                { path: 'pharmaciesList', populate : [
                                        { path: 'location'},
                                        { path: 'country'},
                                        { path: 'workingHours'},
                                        {path: 'deliveryZone', populate: [
                                            { path: 'coordinates', populate: [
                                                {path: 'points'},
                                            ]},
                                        ]},
                                        { path: 'documents', populate: [
                                            { path: 'logo'},
                                            { path: 'license'},
                                            { path: 'idDocument'},
                                            { path: 'insurance'},
                                        ]},
                                    ],
                                },
                                { path: 'subcategories'}
                            ])
                            .lean();

        let catPerId = {};
        categories.map((category) => {
            catPerId[category._id] = category;
        });

        return res.status(200).json({'error':0, user: user, data: categories, catPerId:catPerId, pharmaciesList});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacyCategoriesCreate = async (req, res) => {
    try {
        const { name, description, slug, parentCategory, status, displayOrder, isVisible, metaTitle, metaDescription, keywords, requiresPrescription, restrictions, specialCategory, pharmaciesList} = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};

        if (!name || !slug || !status || !specialCategory || !pharmaciesList) {
            return res.status(200).json({  error:1, success:false, errorMessage: 'Certains champs sont obligatoires! Remplissez les tous', message: 'Certains champs sont obligatoires! Remplissez les tous' });
        }
      
        if (name) { query.name = name;}
        if (description) { query.description = description;}
        if (slug) { query.slug = slug; }
        if (parentCategory) { query.parentCategory = parentCategory;}
        if (displayOrder) { query.displayOrder = displayOrder;}
        if (isVisible) { query.isVisible = isVisible; }
        if (metaTitle) { query.metaTitle = metaTitle; }
        if (metaDescription) { query.metaDescription = metaDescription; }
        if (keywords) { query.keywords = {$in : keywords}; }
        if (requiresPrescription) { query.requiresPrescription = requiresPrescription; }
        if (restrictions) { query.restrictions = {$in:restrictions}; }
        if (specialCategory) { query.specialCategory = specialCategory; }
        if (pharmaciesList) { query.pharmaciesList = {$in: pharmaciesList}; }
        else{ query.pharmaciesList =  { $in: user.pharmaciesManaged.map(pharm => pharm._id) }}

        query.status = { $nin : ['deleted'] };

        let existingCategorie = await Category.find(query);
        if (existingCategorie.length) {
            return res.status(200).json({ error:1, success:false, errorMessage: 'Une categorie avec ces caracteristiques existe deja' , message: 'Une categorie avec ces caracteristiques existe deja' });
        }

        if (slug){
            let slugExist = await Category.findOne({ slug: slug, status: { $nin : ['deleted'] }, "pharmaciesList": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (slugExist){
                return res.status(200).json({ error:1, success:false, errorMessage: 'Une categorie avec ces caracteristiques existe deja', message: 'Le slug existe deja pour une autre categorie' });
            }
        }

        const newCategory = new Category({
            name,
            description,
            slug,
            status,
            displayOrder,
            isVisible,
            metaTitle,
            metaDescription,
            keywords,
            requiresPrescription,
            restrictions,
            specialCategory,
            pharmaciesList,
        });

        if (parentCategory) {
            let parentCategoryExist = await Category.findOne({ _id: parentCategory, status: { $nin : ['deleted'] } });
            if (!parentCategoryExist) {
                return res.status(200).json({ error:1, success:false, errorMessage: 'La categorie parent n\'existe pas', message: 'La categorie parent n\'existe pas'});
            }
            newCategory.level = parentCategoryExist.level + 1;
            newCategory.parentCategory = parentCategoryExist._id;
        }

        
        await newCategory.save();
        await newCategory
            .populate([
            { path: 'imageUrl'},
            { path: 'iconUrl'},
            { path: 'parentCategory'},
            { path: 'pharmaciesList', populate : [
                    { path: 'location'},
                    { path: 'country'},
                    { path: 'workingHours'},
                    {path: 'deliveryZone', populate: [
                        { path: 'coordinates', populate: [
                            {path: 'points'},
                        ]},
                    ]},
                    { path: 'documents', populate: [
                        { path: 'logo'},
                        { path: 'license'},
                        { path: 'idDocument'},
                        { path: 'insurance'},
                    ]},
                ],
            },
            { path: 'subcategories'}
        ]);
        await registerActivity('Categorie', newCategory._id, user._id,  "Categorie Ajoutee", "La categorie "+newCategory.name+" a ete ajoute!");

        return res.status(200).json({ error:0, success:true, message: 'La categorie a ete cree avec succes', data: newCategory });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const pharmacyCategoriesImport = async (req, res) => {
    try {
        const { categories } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        if (!categories || !Array.isArray(categories) || categories.length === 0) {
            return res.status(200).json({ 
                error: 1, 
                success: false, 
                errorMessage: 'Aucune catégorie à importer', 
                message: 'Aucune catégorie à importer' 
            });
        }

        let importResults = {
            total: categories.length,
            success: 0,
            errors: 0,
            errorDetails: []
        };

        let createdCategories = [];

        // Traitement séquentiel pour éviter les conflits
        for (let i = 0; i < categories.length; i++) {
            const categoryData = categories[i];
            
            try {
                // Validation des champs obligatoires
                if (!categoryData.name || !categoryData.slug || !categoryData.status || 
                    !categoryData.specialCategory || !categoryData.pharmaciesList) {
                    importResults.errors++;
                    importResults.errorDetails.push({
                        row: i + 1,
                        name: categoryData.name || 'Non défini',
                        error: 'Champs obligatoires manquants (name, slug, status, specialCategory, pharmaciesList)'
                    });
                    continue;
                }

                // Vérification de l'existence basée sur le nom et le slug
                let existingByName = await Category.findOne({ 
                    name: categoryData.name, 
                    status: { $nin: ['deleted'] } ,
                    pharmaciesList: { $in: user.pharmaciesManaged.map(pharm => pharm._id) }
                });

                let existingBySlug = await Category.findOne({ 
                    slug: categoryData.slug, 
                    status: { $nin: ['deleted'] },
                    pharmaciesList: { $in: user.pharmaciesManaged.map(pharm => pharm._id) }
                });

                if (existingByName) {
                    importResults.errors++;
                    importResults.errorDetails.push({
                        row: i + 1,
                        name: categoryData.name,
                        error: 'Une catégorie avec ce nom existe déjà'
                    });
                    continue;
                }

                if (existingBySlug) {
                    importResults.errors++;
                    importResults.errorDetails.push({
                        row: i + 1,
                        name: categoryData.name,
                        error: 'Une catégorie avec ce slug existe déjà'
                    });
                    continue;
                }

                // Création de la nouvelle catégorie
                const newCategory = new Category({
                    name: categoryData.name,
                    description: categoryData.description || '',
                    slug: categoryData.slug,
                    status: categoryData.status || 'active',
                    displayOrder: categoryData.displayOrder || 0,
                    isVisible: categoryData.isVisible !== undefined ? categoryData.isVisible : true,
                    metaTitle: categoryData.metaTitle || '',
                    metaDescription: categoryData.metaDescription || '',
                    keywords: categoryData.keywords || [],
                    requiresPrescription: categoryData.requiresPrescription || false,
                    restrictions: categoryData.restrictions || [],
                    specialCategory: categoryData.specialCategory,
                    pharmaciesList: categoryData.pharmaciesList ?? user.pharmaciesManaged.map(pharm => pharm._id),
                    level: 0 // Par défaut niveau 0
                });

                // Gestion de la catégorie parent
                if (categoryData.parentCategory) {
                    let parentCategoryExist = await Category.findOne({ 
                        _id: categoryData.parentCategory, 
                        status: { $nin: ['deleted'] } ,
                        pharmaciesList: { $in: user.pharmaciesManaged.map(pharm => pharm._id) }
                    });
                    
                    if (!parentCategoryExist) {
                        importResults.errors++;
                        importResults.errorDetails.push({
                            row: i + 1,
                            name: categoryData.name,
                            error: 'La catégorie parent spécifiée n\'existe pas'
                        });
                        continue;
                    }
                    
                    newCategory.level = parentCategoryExist.level + 1;
                    newCategory.parentCategory = parentCategoryExist._id;
                }

                // Sauvegarde
                await newCategory.save();
                
                // Population des données
                await newCategory.populate([
                    { path: 'imageUrl' },
                    { path: 'iconUrl' },
                    { path: 'parentCategory' },
                    { 
                        path: 'pharmaciesList', 
                        populate: [
                            { path: 'location' },
                            { path: 'country' },
                            { path: 'workingHours' },
                            {
                                path: 'deliveryZone', 
                                populate: [
                                    { 
                                        path: 'coordinates', 
                                        populate: [
                                            { path: 'points' }
                                        ]
                                    }
                                ]
                            },
                            { 
                                path: 'documents', 
                                populate: [
                                    { path: 'logo' },
                                    { path: 'license' },
                                    { path: 'idDocument' },
                                    { path: 'insurance' }
                                ]
                            }
                        ]
                    },
                    { path: 'subcategories' }
                ]);

                // Enregistrement de l'activité
                await registerActivity(
                    'Categorie', 
                    newCategory._id, 
                    user._id, 
                    "Categorie Importée", 
                    `La catégorie ${newCategory.name} a été importée avec succès!`
                );

                createdCategories.push(newCategory);
                importResults.success++;

            } catch (categoryError) {
                importResults.errors++;
                importResults.errorDetails.push({
                    row: i + 1,
                    name: categoryData.name || 'Non défini',
                    error: categoryError.message || 'Erreur inconnue lors de la création'
                });
            }
        }

        // Réponse finale
        const message = `Importation terminée: ${importResults.success} succès, ${importResults.errors} erreurs sur ${importResults.total} catégories`;
        
        return res.status(200).json({ 
            error: importResults.errors > 0 ? 1 : 0,
            success: importResults.success > 0,
            message: message,
            data: {
                results: importResults,
                createdCategories: createdCategories
            }
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const pharmacyCategoryDetail = async(req, res)=> {
    try {
        const { id } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (!id) {
            return res.status(200).json({ error: 1, success: false, message: 'Id de la categorie invalide !', messageError: 'Id de la categorie invalide !' });
        }

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
      
        const catPharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code)) ? user.pharmaciesManaged.map(pharm => pharm._id) : [];
        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code)) ? user.pharmaciesManaged.map(pharm => ({ value: pharm._id, label: pharm.name })) : [];

        if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query.pharmaciesList = { $in: catPharmaciesList };
        }else{
            return res.status(200).json({'error':0, putin:'he merde je suis ici', user: user, data: [], query: query });
        }

        query.status = { $nin : ['deleted'] };
        let categories = await Category.find(query).lean();

        let catPerId = {};
        categories.map((category) => {
            catPerId[category._id] = category;
        });

        const category = await Category.findOne({ _id : id, status: { $nin : ['deleted'] }}).
               populate([
                    { path: 'imageUrl'},
                    { path: 'iconUrl'},
                    { path: 'parentCategory'},
                    { path: 'pharmaciesList', populate : [
                            { path: 'location'},
                            { path: 'country'},
                            { path: 'workingHours'},
                            {path: 'deliveryZone', populate: [
                                { path: 'coordinates', populate: [
                                    {path: 'points'},
                                ]},
                            ]},
                            { path: 'documents', populate: [
                                { path: 'logo'},
                                { path: 'license'},
                                { path: 'idDocument'},
                                { path: 'insurance'},
                            ]},
                        ],
                    },
                    { path: 'subcategories'}
                ]);

        return res.status(200).json({'error':0, user: user, data: category, catPerId:catPerId, pharmaciesList});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const categoriesActivities = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        var user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) && user.groups.length > 0
            ? user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code))
            : false;

        let { id, prePage, user_, all } = req.body;
        if ( (!id || (Array.isArray(id) && id.length === 0)) && !userInGroupAdmin ) {
            id = user.pharmaciesManaged?.map( pharm => pharm._id );
            if (!id) {  return res.status(400).json({ message: 'Missing required fields'}); }
        }

        let query = {};
        if (user_ && typeof user_ === 'string') {
            query.author = user_;
        } else if (user_ && typeof user_.toString === 'function') {
            query.author = user_.toString();
        }

        let categories = id ? await Category.find( Array.isArray(id) ? {status: { $nin : ['deleted'] }, pharmaciesList : {$in : id} } : { _id : id, status: { $nin : ['deleted'] } }) : false;
        if (!categories && !userInGroupAdmin) { 
            return res.status(404).json({ success: false, message: 'Catégorie non trouvée' });
        }

        if (categories){
            query.id_object = { $in : categories.map(cat => cat._id)};
        }

        const activities = all ? await Activity.find(query).sort({ created_at: -1 }) : await Activity.find(query).sort({ created_at: -1 }).limit(parseInt(prePage) || 10);

            const validAuthorIds = activities
            ? activities.map(act => act.author).filter(id => mongoose.Types.ObjectId.isValid(id))
            : [];
        const users = validAuthorIds.length > 0 ? await Admin.find({ _id: { $in: validAuthorIds } }).lean() : [];
        const usersMap = {};
        users.forEach(each => {
            each.photoURL = each.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(each.name || 'User')}&background=random&size=500`;
            if (each._id && mongoose.Types.ObjectId.isValid(each._id)) {
                usersMap[each._id] = {
                    'name' : each._id.toString() == user._id.toString() ? 'Vous' : each.name+' '+each.surname,
                    'img' : each.photoURL
                };
            }
        });
        return res.status(200).json({'error':0, usersMap: usersMap, data: activities, user: user });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const categorieUpdate = async (req, res) => {
    try {
        let { 
            _id, type_, name, description, slug, parentCategory, subcategories, status, 
            displayOrder, isVisible, metaTitle, metaDescription, keywords, requiresPrescription, restrictions, specialCategory, pharmaciesList
        } = req.body;

        if (!type_ || !_id) {
            return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' });
        }

        let fieldsToCheck = [];

        switch (type_) {
            case 1:
                fieldsToCheck = [
                    'name', 'description', 'slug', 'parentCategory', 'status',
                    'displayOrder', 'isVisible', 'metaTitle', 'metaDescription', 'keywords',
                    'requiresPrescription', 'restrictions', 'specialCategory'
                ];
                if (!name || !slug) { return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' });}
                break;

            case 2:
                fieldsToCheck = ['pharmaciesList'];
                if (!pharmaciesList) { return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' }); }
                break;
            default: break;
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { 
            return res.status(404).json({ message: 'User not found' }); 
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const existingCategory = await Category.findOne({_id : _id, status: { $nin : ['deleted'] }});
        if (!existingCategory) {
            return res.status(200).json({ error: 1, success: false, message: 'Catégorie non trouvée', errorMessage: 'Catégorie non trouvée' });
        }

        // Check for duplicate category (excluding current)
        if (slug) {
            let slugExist = await Category.findOne({ _id: { $ne: _id }, slug: slug, status: { $nin : ['deleted'] }, "pharmaciesList": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (slugExist) {
                return res.status(200).json({ error: 1, success: false, errorMessage: 'Le slug existe deja pour une autre categorie', message: 'Le slug existe deja pour une autre categorie' });
            }
        }

        let level = 0;
        if (parentCategory) {
            let parentCategoryExist = await Category.findOne({ _id: parentCategory, status: { $nin : ['deleted'] }, "pharmacies": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (!parentCategoryExist) {
                return res.status(200).json({ error: 1, success: false, errorMessage: 'La categorie parent n\'existe pas', message: 'La categorie parent n\'existe pas' });
            }
            level = parentCategoryExist.level + 1;
            existingCategory.level = level;
        } else {
            existingCategory.level = 0;
        }

        let updates = [];
        fieldsToCheck.forEach(field => {
            if (typeof req.body[field] !== 'undefined') {
                if (Array.isArray(existingCategory[field]) || Array.isArray(req.body[field])) {
                    if (JSON.stringify(existingCategory[field] || []) !== JSON.stringify(req.body[field] || [])) {
                        updates.push(field);
                        existingCategory[field] = req.body[field];
                    }
                } else if (existingCategory[field] != req.body[field]) {
                    updates.push(field);
                    existingCategory[field] = field === 'keywords' ? (Array.isArray(req.body.keywords) ? req.body.keywords : typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map(k => k.trim()).filter(Boolean) : []) : req.body[field];
                }
            }
        });

        await existingCategory.save();
        await existingCategory.
            populate([
                { path: 'imageUrl'},
                { path: 'iconUrl'},
                { path: 'parentCategory'},
                { path: 'pharmaciesList', populate : [
                        { path: 'location'},
                        { path: 'country'},
                        { path: 'workingHours'},
                        {path: 'deliveryZone', populate: [
                            { path: 'coordinates', populate: [
                                {path: 'points'},
                            ]},
                        ]},
                        { path: 'documents', populate: [
                            { path: 'logo'},
                            { path: 'license'},
                            { path: 'idDocument'},
                            { path: 'insurance'},
                        ]},
                    ],
                },
                { path: 'subcategories'}
            ]);

        if (updates){
            await registerActivity('Categorie', existingCategory._id, user._id, "Mise a jour Categorie", `Certaines informations de la categorie ${existingCategory.name} ont été mises à jour : ${updates.join(' | ')} `);
        }

        return res.status(200).json({ error: 0, success: true, message: "Categorie mise a jour avec succès!", user: user, data: existingCategory });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de la categorie:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
const categorieDelete = async (req, res) => {
    try {
        let { _id} = req.body;

        if (!_id) {
            return res.status(200).json({ error: 1, success: false, message: 'La catégorie n\'a pu etre identifiée', errorMessage: 'La catégorie n\'a pu etre identifiée' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { 
            return res.status(404).json({ message: 'User not found' }); 
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const existingCategory = await Category.findOne({_id : _id, status: { $nin : ['deleted'] }});
        if (!existingCategory) {
            return res.status(200).json({ error: 1, success: false, message: 'Catégorie non trouvée', errorMessage: 'Catégorie non trouvée' });
        }

       existingCategory.status = 'deleted';

        await existingCategory.save();
        await registerActivity('Categorie', existingCategory._id, user._id, "Suppression Categorie", `La catégorie ${existingCategory.name} a été supprimer par ${user.name} `);
        
        return res.status(200).json({ error: 0, success: true, message: "Categorie supprimé avec success!", user: user });
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la categorie:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
const pharmacyProductsList = async (req, res) => {
    try {
        const { status, categoryId, pharmaciesId, search, requiresPrescription } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};

        // Filtres de base
        if (status) { 
            query.status = status; 
        }
        
        if (categoryId) { 
            query.categories = { $in: [categoryId] }; 
        }

        if (requiresPrescription !== undefined) {
            query.requiresPrescription = requiresPrescription === 'true' || requiresPrescription === true;
        }

        // Recherche textuelle
        if (search) {
            const cleanedSearch = search.replace(/\s+/g, '').trim();
            const regex = new RegExp(cleanedSearch, 'i');
            query.$or = [
                { name: regex },
                { description: regex },
                { shortDescription: regex },
                { sku: regex },
                { barcode: regex },
                { laboratoire: regex },
                { marque: regex },
                { cipCode: regex }
            ];
        }

        // Gestion des pharmacies selon les droits utilisateur
        const userPharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code)) 
            ? user.pharmaciesManaged.map(pharm => pharm._id) 
            : [];
        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code)) 
            ? user.pharmaciesManaged.map(pharm => ({ value: pharm._id, label: pharm.name })) 
            : [];

        if (pharmaciesId) {
            query['pharmacies.pharmacy'] = { $in: pharmaciesId };
        } else if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query['pharmacies.pharmacy'] = { $in: userPharmaciesList };
        } else {
            return res.status(200).json({ 'error': 0, data: [], query: query, user: user });
        }

        query.status = { $nin: ['deleted'] };

        let products = await Product.find(query)
            .populate([
                { path: 'categories', populate:[
                    { path: 'imageUrl'},
                    { path: 'iconUrl'},
                    { path: 'parentCategory'},
                    { path: 'pharmaciesList', populate : [
                            { path: 'location'},
                            { path: 'country'},
                            { path: 'workingHours'},
                            {path: 'deliveryZone', populate: [
                                { path: 'coordinates', populate: [
                                    {path: 'points'},
                                ]},
                            ]},
                            { path: 'documents', populate: [
                                { path: 'logo'},
                                { path: 'license'},
                                { path: 'idDocument'},
                                { path: 'insurance'},
                            ]},
                        ],
                    },
                    { path: 'subcategories'}
                ]},
                { path: 'mainImage' },
                { path: 'images' },
                {
                    path: 'pharmacies.pharmacy',
                    populate: [
                        { path: 'location' },
                        { path: 'country' },
                        { path: 'workingHours' },
                        {
                            path: 'deliveryZone',
                            populate: [
                                {
                                    path: 'coordinates',
                                    populate: [
                                        { path: 'points' }
                                    ]
                                }
                            ]
                        },
                        {
                            path: 'documents',
                            populate: [
                                { path: 'logo' },
                                { path: 'license' },
                                { path: 'idDocument' },
                                { path: 'insurance' }
                            ]
                        }
                    ]
                }
            ])
            .lean();

        return res.status(200).json({
            'error': 0,
            user: user,
            data: products,
            pharmaciesList
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const productsActivities = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        var user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) && user.groups.length > 0
            ? user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code))
            : false;

        let { id, prePage, user_, all } = req.body;
        if ((!id || (Array.isArray(id) && id.length === 0)) && !userInGroupAdmin) {
            id = user.pharmaciesManaged?.map(pharm => pharm._id);
            if (!id) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
        }

        let products = id ? await Product.find(
            Array.isArray(id)
                ? { status: { $nin: ['deleted'] }, 'pharmacies.pharmacy': { $in: id } }
                : { _id: id, status: { $nin: ['deleted'] } }
        ) : false;

        if (!products && !userInGroupAdmin) {
            return res.status(404).json({ success: false, message: 'Produit non trouvé' });
        }

        let query = {};
        if (user_) { query.author = user_.toString(); }
        if (products) { query.id_object = { $in: products.map(c => c._id)}; }
        const activities = all ? await Activity.find(query).sort({ created_at: -1 }) : await Activity.find(query).sort({ created_at: -1 }).limit(parseInt(prePage) || 10);

        const validAuthorIds = activities
            ? activities.map(act => act.author).filter(id => mongoose.Types.ObjectId.isValid(id))
            : [];
        const users = validAuthorIds.length > 0 ? await Admin.find({ _id: { $in: validAuthorIds } }).lean() : [];
        const usersMap = {};
        users.forEach(each => {
            each.photoURL = each.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(each.name || 'User')}&background=random&size=500`;
            if (each._id && mongoose.Types.ObjectId.isValid(each._id)) {
                usersMap[each._id] = {
                    'name': each._id.toString() == user._id.toString() ? 'Vous' : each.name + ' ' + each.surname,
                    'img': each.photoURL
                };
            }
        });
        return res.status(200).json({ 'error': 0, usersMap: usersMap, data: activities, user: user });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const productsAdvancedSearch = async (req, res) => {
    try {
        const {
            search, categories, minPrice, maxPrice, laboratoire, marque,
            requiresPrescription, drugForm, therapeuticClass, inStock,
            pharmaciesId, sortBy, sortOrder, page, limit
        } = req.body;

        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = { status: { $nin: ['deleted'] } };

        // Gestion des pharmacies selon les droits utilisateur
        const userPharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
            ? user.pharmaciesManaged.map(pharm => pharm._id)
            : [];

        if (pharmaciesId) {
            query['pharmacies.pharmacy'] = { $in: pharmaciesId };
        } else if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query['pharmacies.pharmacy'] = { $in: userPharmaciesList };
        }

        // Recherche textuelle
        if (search) {
            const regex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: regex },
                { description: regex },
                { shortDescription: regex },
                { sku: regex },
                { barcode: regex },
                { laboratoire: regex },
                { marque: regex }
            ];
        }

        // Filtres spécifiques
        if (categories && categories.length > 0) {
            query.categories = { $in: categories };
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            if (minPrice !== undefined) query.price.$gte = minPrice;
            if (maxPrice !== undefined) query.price.$lte = maxPrice;
        }

        if (laboratoire) {
            query.laboratoire = new RegExp(laboratoire.trim(), 'i');
        }

        if (marque) {
            query.marque = new RegExp(marque.trim(), 'i');
        }

        if (requiresPrescription !== undefined) {
            query.requiresPrescription = requiresPrescription;
        }

        if (drugForm) {
            query.drugForm = drugForm;
        }

        if (therapeuticClass) {
            query.therapeuticClass = new RegExp(therapeuticClass.trim(), 'i');
        }

        if (inStock !== undefined) {
            if (inStock) {
                query.status = { $nin: ['deleted', 'out_of_stock', 'discontinued'] };
            }
        }

        // Pagination
        const pageNumber = parseInt(page) || 1;
        const limitNumber = parseInt(limit) || 20;
        const skip = (pageNumber - 1) * limitNumber;

        // Tri
        let sort = {};
        if (sortBy) {
            sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1; // Par défaut, tri par date de création décroissante
        }

        const products = await Product.find(query)
            .populate([
                { path: 'categories', populate:[
                    { path: 'imageUrl'},
                    { path: 'iconUrl'},
                    { path: 'parentCategory'},
                    { path: 'pharmaciesList', populate : [
                            { path: 'location'},
                            { path: 'country'},
                            { path: 'workingHours'},
                            {path: 'deliveryZone', populate: [
                                { path: 'coordinates', populate: [
                                    {path: 'points'},
                                ]},
                            ]},
                            { path: 'documents', populate: [
                                { path: 'logo'},
                                { path: 'license'},
                                { path: 'idDocument'},
                                { path: 'insurance'},
                            ]},
                        ],
                    },
                    { path: 'subcategories'}
                ]},
                { path: 'mainImage' },
                { path: 'images' },
                {
                    path: 'pharmacies.pharmacy',
                    select: 'name location'
                }
            ])
            .sort(sort)
            .skip(skip)
            .limit(limitNumber)
            .lean();

        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limitNumber);

        return res.status(200).json({
            error: 0,
            user: user,
            data: products,
            pagination: {
                currentPage: pageNumber,
                totalPages: totalPages,
                totalProducts: totalProducts,
                limit: limitNumber,
                hasNext: pageNumber < totalPages,
                hasPrev: pageNumber > 1
            }
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const productsStats = async (req, res) => {
    try {
        const { pharmaciesId } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = { status: { $nin: ['deleted'] } };

        // Gestion des pharmacies selon les droits utilisateur
        const userPharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
            ? user.pharmaciesManaged.map(pharm => pharm._id)
            : [];

        if (pharmaciesId) {
            query['pharmacies.pharmacy'] = { $in: pharmaciesId };
        } else if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query['pharmacies.pharmacy'] = { $in: userPharmaciesList };
        }

        // Statistiques générales
        const totalProducts = await Product.countDocuments(query);
        const activeProducts = await Product.countDocuments({ ...query, status: 'active' });
        const inactiveProducts = await Product.countDocuments({ ...query, status: 'inactive' });
        const outOfStockProducts = await Product.countDocuments({ ...query, status: 'out_of_stock' });
        const prescriptionProducts = await Product.countDocuments({ ...query, requiresPrescription: true });
        const featuredProducts = await Product.countDocuments({ ...query, isFeatured: true });

        // Statistiques par catégorie
        const productsByCategory = await Product.aggregate([
            { $match: query },
            { $unwind: '$categories' },
            { $group: { _id: '$categories', count: { $sum: 1 } } },
            { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
            { $unwind: '$category' },
            { $project: { categoryName: '$category.name', count: 1 } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Statistiques par laboratoire
        const productsByLaboratoire = await Product.aggregate([
            { $match: { ...query, laboratoire: { $exists: true, $ne: '', $ne: null } } },
            { $group: { _id: '$laboratoire', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // Statistiques de prix
        const priceStats = await Product.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    avgPrice: { $avg: '$price' },
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ]);

        return res.status(200).json({
            error: 0,
            user: user,
            data: {
                general: {
                    total: totalProducts,
                    active: activeProducts,
                    inactive: inactiveProducts,
                    outOfStock: outOfStockProducts,
                    prescription: prescriptionProducts,
                    featured: featuredProducts
                },
                byCategory: productsByCategory,
                byLaboratoire: productsByLaboratoire,
                pricing: priceStats[0] || { avgPrice: 0, minPrice: 0, maxPrice: 0 }
            }
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacyProductsCreate = async (req, res) => {
    try {
        const { name, description, shortDescription, slug, categories, barcode, sku, cipCode, laboratoire, marque, price, originalPrice, cost, status, isVisible, isFeatured, isOnSale, requiresPrescription, prescriptionType, drugForm, dosage, packaging, activeIngredients, ageRestrictionMinAge, ageRestrictionMaxAge, contraindications, sideEffects, warnings, therapeuticClass, pharmacologicalClass, indicationsTherapeutiques, weight, metaTitle, metaDescription, keywords, instructions, storage, origin, pharmacies, isFragile, requiresColdChain} = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};

        if (!name || !slug || !sku || !price || !categories || !pharmacies) {
            return res.status(200).json({  error:1, success:false, errorMessage: 'Certains champs sont obligatoires! Remplissez les tous', message: 'Certains champs sont obligatoires! Remplissez les tous' });
        }
      
        if (name) { query.name = name;}
        if (description) { query.description = description;}
        if (slug) { query.slug = slug; }
        if (sku) { query.sku = sku; }
        if (categories) { query.categories = {$in : categories}; }
        if (status) { query.status = status;}
        if (isVisible) { query.isVisible = isVisible; }
        if (metaTitle) { query.metaTitle = metaTitle; }
        if (metaDescription) { query.metaDescription = metaDescription; }
        if (keywords) { query.keywords = {$in : keywords}; }
        if (requiresPrescription) { query.requiresPrescription = requiresPrescription; }
        if (pharmacies) { query['pharmacies.pharmacy'] = {$in: pharmacies}; }else{
            query['pharmacies.pharmacy'] = {$in: user.pharmaciesManaged.map(pharm => pharm._id)};
        }

        query.status = { $nin : ['deleted'] };

        let existingProduct = await Product.find(query);
        if (existingProduct.length) {
            return res.status(200).json({ error:1, success:false, errorMessage: 'Un produit avec ces caracteristiques existe deja' , message: 'Un produit avec ces caracteristiques existe deja' });
        }

        if (slug){
            let slugExist = await Product.findOne({ slug: slug, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) }});
            if (slugExist){
                return res.status(200).json({ error:1, success:false, errorMessage: 'Un produit avec ces caracteristiques existe deja', message: 'Le slug existe deja pour un autre produit' });
            }
        }

        if (sku){
            let skuExist = await Product.findOne({ sku: sku, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) }});
            if (skuExist){
                return res.status(200).json({ error:1, success:false, errorMessage: 'Un produit avec ce SKU existe deja', message: 'Le SKU existe deja pour un autre produit' });
            }
        }

        if (barcode){
            let barcodeExist = await Product.findOne({ barcode: barcode, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (barcodeExist){
                return res.status(200).json({ error:1, success:false, errorMessage: 'Un produit avec ce code-barres existe deja', message: 'Le code-barres existe deja pour un autre produit' });
            }
        }

        if (cipCode){
            let cipExist = await Product.findOne({ cipCode: cipCode, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (cipExist){
                return res.status(200).json({ error:1, success:false, errorMessage: 'Un produit avec ce code CIP existe deja', message: 'Le code CIP existe deja pour un autre produit' });
            }
        }

        const newProduct = new Product({
            name,
            description,
            shortDescription,
            slug,
            categories,
            barcode,
            sku,
            cipCode,
            laboratoire,
            marque,
            price,
            originalPrice,
            cost,
            status: status || 'active',
            isVisible: isVisible !== undefined ? isVisible : true,
            isFeatured: isFeatured || false,
            isOnSale: isOnSale || false,
            requiresPrescription: requiresPrescription || false,
            prescriptionType: prescriptionType || 'none',
            drugForm,
            dosage,
            packaging,
            activeIngredients: activeIngredients || [],
            ageRestriction: {
                minAge: ageRestrictionMinAge || null,
                maxAge: ageRestrictionMaxAge || null
            },
            contraindications: contraindications || [],
            sideEffects: sideEffects || [],
            warnings: warnings || [],
            therapeuticClass,
            pharmacologicalClass,
            indicationsTherapeutiques: indicationsTherapeutiques || [],
            weight,
            metaTitle,
            metaDescription,
            keywords: keywords || [],
            instructions,
            storage,
            origin,
            pharmacies: pharmacies.map(pharmId => ({
                pharmacy: pharmId,
                isAvailable: true
            })),
            deliveryInfo: {
                isFragile: isFragile || false,
                requiresColdChain: requiresColdChain || false
            }
        });

        await newProduct.save();
        
        // MISE À JOUR DU COMPTEUR DE PRODUITS DANS LES CATÉGORIES
        await updateCategoryProductCount(categories);
        
        await newProduct
            .populate([
            { path: 'categories'},
            { path: 'mainImage'},
            { path: 'images'},
            { path: 'pharmacies.pharmacy', populate : [
                    { path: 'location'},
                    { path: 'country'},
                    { path: 'workingHours'},
                    {path: 'deliveryZone', populate: [
                        { path: 'coordinates', populate: [
                            {path: 'points'},
                        ]},
                    ]},
                    { path: 'documents', populate: [
                        { path: 'logo'},
                        { path: 'license'},
                        { path: 'idDocument'},
                        { path: 'insurance'},
                    ]},
                ],
            },
            { path: 'relatedProducts'},
            { path: 'alternatives'}
        ]);
        await registerActivity('Product', newProduct._id, user._id,  "Produit Ajouté", "Le produit "+newProduct.name+" a ete ajoute!");

        return res.status(200).json({ error:0, success:true, message: 'Le produit a ete cree avec succes', data: newProduct });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const pharmacyProductsImport = async (req, res) => {
    try {
        const { products } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;


        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(200).json({ 
                error: 1, 
                success: false, 
                errorMessage: 'Aucun produit à importer', 
                message: 'Aucun produit à importer' 
            });
        }

        let importResults = {
            total: products.length,
            success: 0,
            errors: 0,
            errorDetails: []
        };

        let createdProducts = [];
        let affectedCategories = new Set(); // Pour stocker les catégories affectées

        // Traitement séquentiel pour éviter les conflits
        for (let i = 0; i < products.length; i++) {
            const productData = products[i];
            
            try {
                // Validation des champs obligatoires
                if (!productData.name || !productData.sku || !productData.price) {
                    importResults.errors++;
                    importResults.errorDetails.push({
                        row: i + 1,
                        name: productData.name || 'Non défini',
                        error: 'Champs obligatoires manquants (name, sku, price)'
                    });
                    continue;
                }

                // Vérification de l'existence basée sur le nom et le SKU
                let existingByName = await Product.findOne({ 
                    name: productData.name, 
                    status: { $nin: ['deleted'] } ,
                    "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) }
                });

                let existingBySku = await Product.findOne({ 
                    sku: productData.sku, 
                    status: { $nin: ['deleted'] } ,
                    "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) }
                });

                if (existingByName) {
                    const conflictingPharmacies = existingByName.pharmacies
                        .filter(p => user.pharmaciesManaged.some(managed => managed._id.toString() === p.pharmacy.toString()))
                        .map(p => p.pharmacy);

                    importResults.errors++;
                    importResults.errorDetails.push({
                        row: i + 1,
                        name: productData.name,
                        error: `Un produit avec ce nom existe déjà dans les pharmacies : ${conflictingPharmacies.join(', ')}`
                    });
                    continue;
                }

                if (existingBySku) {
                    const conflictingPharmacies = existingByName.pharmacies
                        .filter(p => user.pharmaciesManaged.some(managed => managed._id.toString() === p.pharmacy.toString()))
                        .map(p => p.pharmacy);

                    importResults.errors++;
                    importResults.errorDetails.push({
                        row: i + 1,
                        name: productData.name,
                        error: `Un produit avec ce SKU existe déjà dans les pharmacies : ${conflictingPharmacies.join(', ')}`
                    });
                    continue;
                }

                // Création du nouveau produit
                const newProduct = new Product({
                    name: productData.name,
                    description: productData.description || '',
                    shortDescription: productData.shortDescription || '',
                    slug: productData.slug || productData.name
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-')
                        .trim(),
                    categories: productData.categories || [],
                    sku: productData.sku,
                    barcode: productData.barcode || null,
                    cipCode: productData.cipCode || null,
                    laboratoire: productData.laboratoire || '',
                    marque: productData.marque || '',
                    price: productData.price,
                    originalPrice: productData.originalPrice || null,
                    cost: productData.cost || null,
                    status: productData.status || 'active',
                    isVisible: productData.isVisible !== undefined ? productData.isVisible : true,
                    isFeatured: productData.isFeatured || false,
                    isOnSale: productData.isOnSale || false,
                    requiresPrescription: productData.requiresPrescription || false,
                    prescriptionType: productData.requiresPrescription ? 'simple' : 'none',
                    drugForm: productData.drugForm || '',
                    dosage: productData.dosage || '',
                    packaging: productData.packaging || '',
                    activeIngredients: productData.activeIngredients || [],
                    ageRestriction: {
                        minAge: productData.ageRestrictionMinAge || null,
                        maxAge: productData.ageRestrictionMaxAge || null
                    },
                    contraindications: productData.contraindications || [],
                    sideEffects: productData.sideEffects || [],
                    warnings: productData.warnings || [],
                    therapeuticClass: productData.therapeuticClass || '',
                    pharmacologicalClass: productData.pharmacologicalClass || '',
                    indicationsTherapeutiques: productData.indicationsTherapeutiques || [],
                    weight: productData.weight || null,
                    metaTitle: productData.metaTitle || '',
                    metaDescription: productData.metaDescription || '',
                    keywords: productData.keywords || [],
                    instructions: productData.instructions || '',
                    storage: productData.storage || '',
                    origin: productData.origin || '',
                    pharmacies: productData.pharmacies ? productData.pharmacies.map(pharmId => ({
                        pharmacy: pharmId,
                        isAvailable: true
                    })) : [],
                    deliveryInfo: {
                        isFragile: productData.isFragile || false,
                        requiresColdChain: productData.requiresColdChain || false
                    }
                });

                // Sauvegarde
                await newProduct.save();
                
                // Ajouter les catégories à la liste des catégories affectées
                if (productData.categories && productData.categories.length > 0) {
                    productData.categories.forEach(catId => affectedCategories.add(catId));
                }
                
                // Population des données
                await newProduct.populate([
                    { path: 'categories', populate:[
                        { path: 'imageUrl'},
                        { path: 'iconUrl'},
                        { path: 'parentCategory'},
                        { path: 'pharmaciesList', populate : [
                                { path: 'location'},
                                { path: 'country'},
                                { path: 'workingHours'},
                                {path: 'deliveryZone', populate: [
                                    { path: 'coordinates', populate: [
                                        {path: 'points'},
                                    ]},
                                ]},
                                { path: 'documents', populate: [
                                    { path: 'logo'},
                                    { path: 'license'},
                                    { path: 'idDocument'},
                                    { path: 'insurance'},
                                ]},
                            ],
                        },
                        { path: 'subcategories'}
                    ]},
                    { path: 'mainImage' },
                    { path: 'images' },
                    { 
                        path: 'pharmacies.pharmacy', 
                        populate: [
                            { path: 'location' },
                            { path: 'country' },
                            { path: 'workingHours' },
                            {
                                path: 'deliveryZone', 
                                populate: [
                                    { 
                                        path: 'coordinates', 
                                        populate: [
                                            { path: 'points' }
                                        ]
                                    }
                                ]
                            },
                            { 
                                path: 'documents', 
                                populate: [
                                    { path: 'logo' },
                                    { path: 'license' },
                                    { path: 'idDocument' },
                                    { path: 'insurance' }
                                ]
                            }
                        ]
                    }
                ]);

                // Enregistrement de l'activité
                await registerActivity(
                    'Product', 
                    newProduct._id, 
                    user._id, 
                    "Produit Importé", 
                    `Le produit ${newProduct.name} a été importé avec succès!`
                );

                createdProducts.push(newProduct);
                importResults.success++;

            } catch (productError) {
                importResults.errors++;
                importResults.errorDetails.push({
                    row: i + 1,
                    name: productData.name || 'Non défini',
                    error: productError.message || 'Erreur inconnue lors de la création'
                });
            }
        }

        // MISE À JOUR DES COMPTEURS POUR TOUTES LES CATÉGORIES AFFECTÉES
        if (affectedCategories.size > 0) {
            await updateCategoryProductCount(Array.from(affectedCategories));
        }

        // Réponse finale
        const message = `Importation terminée: ${importResults.success} succès, ${importResults.errors} erreurs sur ${importResults.total} produits`;
        
        return res.status(200).json({ 
            error: importResults.errors > 0 ? 1 : 0,
            success: importResults.success > 0,
            message: message,
            data: {
                results: importResults,
                createdProducts: createdProducts
            }
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const updateCategoryProductCount = async (categoryIds) => {
    try {
        // S'assurer que categoryIds est un tableau
        const categories = Array.isArray(categoryIds) ? categoryIds : [categoryIds];
        
        for (const categoryId of categories) {
            // Compter les produits actifs dans cette catégorie
            const productCount = await Product.countDocuments({
                categories: categoryId,
                status: { $nin: ['deleted'] }
            });
            
            // Mettre à jour le compteur dans la catégorie
            await Category.findByIdAndUpdate(
                categoryId,
                { 
                    productCount: productCount,
                    updatedAt: new Date()
                },
                { new: true }
            );
            
            // Si cette catégorie a un parent, mettre à jour aussi le parent
            const category = await Category.findById(categoryId);
            if (category && category.parentCategory) {
                // Calculer le total pour la catégorie parent (ses propres produits + ceux des sous-catégories)
                const subcategories = await Category.find({ 
                    parentCategory: category.parentCategory,
                    status: { $nin: ['deleted'] }
                });
                
                const subcategoryIds = subcategories.map(sub => sub._id);
                subcategoryIds.push(category.parentCategory); // Inclure la catégorie parent elle-même
                
                const parentProductCount = await Product.countDocuments({
                    categories: { $in: subcategoryIds },
                    status: { $nin: ['deleted'] }
                });
                
                await Category.findByIdAndUpdate(
                    category.parentCategory,
                    { 
                        productCount: parentProductCount,
                        updatedAt: new Date()
                    },
                    { new: true }
                );
            }
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du compteur de produits:', error);
    }
};
const pharmacyProductDetail = async(req, res)=> {
    try {
        const { id } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (!id) {
            return res.status(200).json({ error: 1, success: false, message: 'Id du produit invalide !', messageError: 'Id du produit invalide !' });
        }

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
      
        const prodPharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code)) ? user.pharmaciesManaged.map(pharm => pharm._id) : [];
        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code)) ? user.pharmaciesManaged.map(pharm => ({ value: pharm._id, label: pharm.name })) : [];

        if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien','preparateur', 'caissier', 'consultant'].includes(g.code))) {
            query['pharmacies.pharmacy'] = { $in: prodPharmaciesList };
        }else{
            return res.status(200).json({'error':0, putin:'he merde je suis ici', user: user, data: [], query: query });
        }

        query.status = { $nin : ['deleted'] };
        let products = await Product.find(query).lean();

        let prodPerId = {};
        products.map((product) => {
            prodPerId[product._id] = product;
        });

        const product = await Product.findOne({ _id : id, status: { $nin : ['deleted'] }}).
               populate([
                    { path: 'categories', populate:[
                        { path: 'imageUrl'},
                        { path: 'iconUrl'},
                        { path: 'parentCategory'},
                        { path: 'pharmaciesList', populate : [
                                { path: 'location'},
                                { path: 'country'},
                                { path: 'workingHours'},
                                {path: 'deliveryZone', populate: [
                                    { path: 'coordinates', populate: [
                                        {path: 'points'},
                                    ]},
                                ]},
                                { path: 'documents', populate: [
                                    { path: 'logo'},
                                    { path: 'license'},
                                    { path: 'idDocument'},
                                    { path: 'insurance'},
                                ]},
                            ],
                        },
                        { path: 'subcategories'}
                    ]},
                    { path: 'mainImage'},
                    { path: 'images'},
                    { path: 'pharmacies.pharmacy', populate : [
                            { path: 'location'},
                            { path: 'country'},
                            { path: 'workingHours'},
                            {path: 'deliveryZone', populate: [
                                { path: 'coordinates', populate: [
                                    {path: 'points'},
                                ]},
                            ]},
                            { path: 'documents', populate: [
                                { path: 'logo'},
                                { path: 'license'},
                                { path: 'idDocument'},
                                { path: 'insurance'},
                            ]},
                        ],
                    },
                    { path: 'relatedProducts'},
                    { path: 'alternatives'}
                ]);

        return res.status(200).json({'error':0, user: user, data: product, prodPerId:prodPerId, pharmaciesList});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const productUpdate = async (req, res) => {
    try {
        let { 
            _id, type_, name, description, shortDescription, slug, categories, barcode, sku, cipCode,
            laboratoire, marque, price, originalPrice, cost, status, isVisible, isFeatured,
            isOnSale, requiresPrescription, prescriptionType, drugForm, dosage, packaging,
            activeIngredients, ageRestrictionMinAge, ageRestrictionMaxAge, contraindications, 
            sideEffects, warnings, therapeuticClass, pharmacologicalClass, indicationsTherapeutiques, 
            weight, metaTitle, metaDescription, keywords, instructions, storage, origin, pharmacies,
            isFragile, requiresColdChain
        } = req.body;

        if (!type_ || !_id) {
            return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { 
            return res.status(404).json({ message: 'User not found' }); 
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const existingProduct = await Product.findOne({_id : _id, status: { $nin : ['deleted'] }});
        if (!existingProduct) {
            return res.status(200).json({ error: 1, success: false, message: 'Produit non trouvé', errorMessage: 'Produit non trouvé' });
        }

         let fieldsToCheck = [];

        switch (type_) {
            case 1:
                fieldsToCheck = [
                    'name', 'description', 'shortDescription', 'slug', 'categories', 'status',
                    'isVisible', 'isFeatured', 'isOnSale', 'metaTitle', 'metaDescription', 'keywords'
                ];
                if (!name || !slug) { return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' });}
                break;

            case 2:
                fieldsToCheck = ['barcode', 'sku', 'cipCode', 'laboratoire', 'marque'];
                if (!sku) { return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' }); }
                break;

            case 3:
                fieldsToCheck = ['price', 'originalPrice', 'cost'];
                if (!price) { return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' }); }
                break;

            case 4:
                fieldsToCheck = [
                    'requiresPrescription', 'prescriptionType', 'drugForm', 'dosage', 'packaging',
                    'activeIngredients', 'therapeuticClass', 'pharmacologicalClass', 'indicationsTherapeutiques'
                ];
                break;

            case 5:
                fieldsToCheck = ['contraindications', 'sideEffects', 'warnings'];
                break;

            case 6:
                fieldsToCheck = ['weight', 'instructions', 'storage', 'origin'];
                break;

            case 7:
                fieldsToCheck = ['pharmacies'];
                if (!pharmacies) { return res.status(200).json({ error: 1, success: false, message: 'Tous les champs obligatoires doivent être renseignés', errorMessage: 'Tous les champs obligatoires doivent être renseignés' }); }
                break;
            default: break;
        }

        // Check for duplicate product (excluding current)
        if (slug) {
            let slugExist = await Product.findOne({ _id: { $ne: _id }, slug: slug, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (slugExist) {
                return res.status(200).json({ error: 1, success: false, errorMessage: 'Le slug existe deja pour un autre produit', message: 'Le slug existe deja pour un autre produit' });
            }
        }

        if (sku) {
            let skuExist = await Product.findOne({ _id: { $ne: _id }, sku: sku, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (skuExist) {
                return res.status(200).json({ error: 1, success: false, errorMessage: 'Le SKU existe deja pour un autre produit', message: 'Le SKU existe deja pour un autre produit' });
            }
        }

        if (barcode) {
            let barcodeExist = await Product.findOne({ _id: { $ne: _id }, barcode: barcode, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (barcodeExist) {
                return res.status(200).json({ error: 1, success: false, errorMessage: 'Le code-barres existe deja pour un autre produit', message: 'Le code-barres existe deja pour un autre produit' });
            }
        }

        if (cipCode) {
            let cipExist = await Product.findOne({ _id: { $ne: _id }, cipCode: cipCode, status: { $nin : ['deleted'] }, "pharmacies.pharmacy": { $in: user.pharmaciesManaged.map(pharm => pharm._id) } });
            if (cipExist) {
                return res.status(200).json({ error: 1, success: false, errorMessage: 'Le code CIP existe deja pour un autre produit', message: 'Le code CIP existe deja pour un autre produit' });
            }
        }

        let updates = [];
        fieldsToCheck.forEach(field => {
            if (typeof req.body[field] !== 'undefined') {
                if (Array.isArray(existingProduct[field]) || Array.isArray(req.body[field])) {
                    if (JSON.stringify(existingProduct[field] || []) !== JSON.stringify(req.body[field] || [])) {
                        updates.push(field);
                        existingProduct[field] = req.body[field];
                    }
                } else if (existingProduct[field] != req.body[field]) {
                    updates.push(field);
                    existingProduct[field] = field === 'keywords' ? (Array.isArray(req.body.keywords) ? req.body.keywords : typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map(k => k.trim()).filter(Boolean) : []) : req.body[field];
                }
            }
        });

        // Gestion spéciale pour ageRestriction
        if (type_ === 4 && (typeof ageRestrictionMinAge !== 'undefined' || typeof ageRestrictionMaxAge !== 'undefined')) {
            const newAgeRestriction = {
                minAge: ageRestrictionMinAge || existingProduct.ageRestriction?.minAge || null,
                maxAge: ageRestrictionMaxAge || existingProduct.ageRestriction?.maxAge || null
            };
            if (JSON.stringify(existingProduct.ageRestriction || {}) !== JSON.stringify(newAgeRestriction)) {
                updates.push('ageRestriction');
                existingProduct.ageRestriction = newAgeRestriction;
            }
        }

        // Gestion spéciale pour deliveryInfo
        if (type_ === 6 && (typeof isFragile !== 'undefined' || typeof requiresColdChain !== 'undefined')) {
            const newDeliveryInfo = {
                isFragile: isFragile !== undefined ? isFragile : existingProduct.deliveryInfo?.isFragile || false,
                requiresColdChain: requiresColdChain !== undefined ? requiresColdChain : existingProduct.deliveryInfo?.requiresColdChain || false
            };
            if (JSON.stringify(existingProduct.deliveryInfo || {}) !== JSON.stringify(newDeliveryInfo)) {
                updates.push('deliveryInfo');
                existingProduct.deliveryInfo = newDeliveryInfo;
            }
        }

        // Gestion spéciale pour pharmacies
        if (type_ === 7 && pharmacies) {
            const newPharmacies = pharmacies.map(pharmId => ({
                pharmacy: pharmId,
                isAvailable: true
            }));
            if (JSON.stringify(existingProduct.pharmacies || []) !== JSON.stringify(newPharmacies)) {
                updates.push('pharmacies');
                existingProduct.pharmacies = newPharmacies;
            }
        }

        await existingProduct.save();
        await existingProduct.
            populate([
                { path: 'categories', populate:[
                    { path: 'imageUrl'},
                    { path: 'iconUrl'},
                    { path: 'parentCategory'},
                    { path: 'pharmaciesList', populate : [
                            { path: 'location'},
                            { path: 'country'},
                            { path: 'workingHours'},
                            {path: 'deliveryZone', populate: [
                                { path: 'coordinates', populate: [
                                    {path: 'points'},
                                ]},
                            ]},
                            { path: 'documents', populate: [
                                { path: 'logo'},
                                { path: 'license'},
                                { path: 'idDocument'},
                                { path: 'insurance'},
                            ]},
                        ],
                    },
                    { path: 'subcategories'}
                ]},
                { path: 'mainImage'},
                { path: 'images'},
                { path: 'pharmacies.pharmacy', populate : [
                        { path: 'location'},
                        { path: 'country'},
                        { path: 'workingHours'},
                        {path: 'deliveryZone', populate: [
                            { path: 'coordinates', populate: [
                                {path: 'points'},
                            ]},
                        ]},
                        { path: 'documents', populate: [
                            { path: 'logo'},
                            { path: 'license'},
                            { path: 'idDocument'},
                            { path: 'insurance'},
                        ]},
                    ],
                },
                { path: 'relatedProducts'},
                { path: 'alternatives'}
            ]);

        if (updates){
            if (updates.includes('categories')) {
                updateCategoryProductCount(categories);
            }
            await registerActivity('Product', existingProduct._id, user._id, "Mise a jour Produit", `Certaines informations du produit ${existingProduct.name} ont été mises à jour : ${updates.join(' | ')} `);
        }

        return res.status(200).json({ error: 0, success: true, message: "Produit mis a jour avec succès!", user: user, data: existingProduct });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du produit:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
const uploadProductImages = async (req, res) => {
    try {
        const { type_, productId, uid, updateImage } = req.body;
        const file = req.file;

        const missingFields = [];
        if (!file) missingFields.push('file');
        if (!type_ || ('mainImage' != type_ && !type_.startsWith('images_'))) missingFields.push('type_');
        if (!productId) missingFields.push('categoryId');
        if (!uid) missingFields.push('uid');

        if (missingFields.length > 0) {
            return res.status(400).json({ message: 'Missing required fields', missingFields });
        }
        req.body.type = "admin"

        const the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) return res.status(404).json({ message: 'User not found' });
        const user = the_admin.the_user;

        const product = await Product.findOne({ _id: productId, status: { $nin: ['deleted'] } });
        if (!product) {
            return res.status(200).json({ error: 1, success: false, message: 'Produit non trouvé', errorMessage: 'Produit non trouvé'
            });
        }
        if (!req.file) {
            return res.status(200).json({ error: 1, success: false, message: 'Aucun fichier uploadé', errorMessage: 'Aucun fichier uploadé'});
        }


        const thetime = Date.now().toString();
        const extension = file.originalname ? file.originalname.split('.').pop() : 'png';

        const existant = (type_ == 'mainImage' || updateImage) ? await File.find({
            fileType: type_,
            'linkedTo.model': 'Product',
            'linkedTo.objectId': product._id
        }) : [];
        if (existant.length > 0 && (type_ == 'mainImage' || updateImage) ) {
            const params = {
                fileType: type_,
                'linkedTo.model': 'Product',
                'linkedTo.objectId': product._id
            };
            if (updateImage) {
                params._id = updateImage;
            }
            await File.deleteMany(params);
            for (const f of existant) {
                if (f.url && fs.existsSync(f.url)) {
                    try { fs.unlinkSync(f.url); } catch (e) {}
                }
            }
        }

        const uploadDir = path.join(__dirname, '../../uploads', productId, type_);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const newFilePath = file.path.replace('uploads/',`uploads/${productId}/${type_}/` );
        fs.renameSync(file.path, newFilePath);
        file.path = newFilePath;
        const file_ = new File({
            originalName: file.originalname ?? ("new_file_" + thetime),
            fileName: `${product.name}_${type_}_${thetime}.${extension}`,
            fileType: type_,
            fileSize: file.size,
            url: file.path,
            extension: extension,
            uploadedBy: user._id,
            linkedTo: { model: "Product", objectId: product._id, },
            tags: [],
            isPrivate: true,
            meta: {
                width: file.width ?? 200,
                height: file.height ?? 200,
                pages: file.page ?? 1
            }
        });
        await file_.save();

        if (type_ === 'mainImage') {
            product.mainImage = file_._id;
        } else if (type_.startsWith('images_')) {
            if (!product.images) { product.images = []; }
            product.images.push(file_._id);
        }

        await product.save();
        await registerActivity('Product', product._id, user._id, "Image Ajoutée", `Une image a été ajoutée au produit ${product.name}`);

        return res.status(200).json({
            error: 0,
            success: true,
            message: 'Image uploadée avec succès',
            data: { fileId: file_._id, file: file_ }
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const productDelete = async (req, res) => {
    try {
        let { id } = req.body;

        if (!id) {
            return res.status(200).json({ 
                error: 1, 
                success: false, 
                message: 'Le produit n\'a pu être identifié', 
                errorMessage: 'Le produit n\'a pu être identifié' 
            });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { 
            return res.status(404).json({ message: 'User not found' }); 
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const existingProduct = await Product.findOne({ _id: id, status: { $nin: ['deleted'] } });
        if (!existingProduct) {
            return res.status(200).json({ 
                error: 1, 
                success: false, 
                message: 'Produit non trouvé', 
                errorMessage: 'Produit non trouvé' 
            });
        }

        existingProduct.status = 'deleted';

        await existingProduct.save();
        await registerActivity('Product', existingProduct._id, user._id, "Suppression Produit", `Le produit ${existingProduct.name} a été supprimé par ${user.name} `);
        
        return res.status(200).json({ 
            error: 0, 
            success: true, 
            message: "Produit supprimé avec succès!", 
            user: user 
        });
    } catch (error) {
        console.error('Erreur lors de la suppression du produit:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
const loadAllActivitiesAndSendMailAdmins = async (updatedPharmacy, updates, user, extra = '', notEmail = false) => {
    let messageToSendToAdmin = `
    <div style="font-family: Arial, sans-serif; color: #222;">
        <p>
            Certains éléments de la pharmacie <b style="color:#007bff;">${updatedPharmacy.name}</b> ont été mis à jour.
        </p>
        <br>
        <b>Détails des modifications :</b>
        <table style="border-collapse: collapse; margin-top: 10px;">
            <tbody>
                ${updates.includes('location') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Emplacement</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('city') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Ville</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('address') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Adresse</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('country') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Pays</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('phoneNumber') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Téléphone</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('email') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Email</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('licenseNumber') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Numéro de licence</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('siret') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">SIRET</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('workingsHours') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Horaires</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('deliveryZone') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Zone de livraison</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('document') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Document '+extra+' Upload</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
                ${updates.includes('deliveryServices') ? '<tr><td style="padding:6px 12px;border:1px solid #e0e0e0;">Services de livraisons</td><td style="padding:6px 12px;border:1px solid #e0e0e0;color:#28a745;">Mis à jour</td></tr>' : ''}
            </tbody>
        </table>
    </div>
    `;

    if (updates.includes('location')) {
        await registerActivity('Location', updatedPharmacy._id, user._id, "Emplacement Mis à jour", `L'emplacement de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('city')) {
        await registerActivity('Ville', updatedPharmacy._id, user._id, "Ville Mise à jour", `La ville de la pharmacie ${updatedPharmacy.name} a été mise à jour`);
    }
    if (updates.includes('address')) {
        await registerActivity('Adresse', updatedPharmacy._id, user._id, "Adresse Mise à jour", `L'adresse de la pharmacie ${updatedPharmacy.name} a été mise à jour`);
    }
    if (updates.includes('country')) {
        await registerActivity('Pays', updatedPharmacy._id, user._id, "Pays Mis à jour", `Le pays de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('phoneNumber')) {
        await registerActivity('Téléphone', updatedPharmacy._id, user._id, "Téléphone Mis à jour", `Le numéro de téléphone de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('email')) {
        await registerActivity('Email', updatedPharmacy._id, user._id, "Email Mis à jour", `L'email de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('licenseNumber')) {
        await registerActivity('Numéro de licence', updatedPharmacy._id, user._id, "Numéro de licence Mis à jour", `Le numéro de licence de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('siret')) {
        await registerActivity('SIRET', updatedPharmacy._id, user._id, "SIRET Mis à jour", `Le SIRET de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('workingsHours')) {
        await registerActivity('Horaires', updatedPharmacy._id, user._id, "Horaires Mis à jour", `Les horaires d'ouverture de la pharmacie ${updatedPharmacy.name} ont été mis à jour`);
    }
    if (updates.includes('deliveryZone')) {
        await registerActivity('Zone de livraison', updatedPharmacy._id, user._id, "Zone de livraison", `La Zone de livraison de la pharmacie ${updatedPharmacy.name} a été mis à jour`);
    }
    if (updates.includes('document')) {
        await registerActivity('Pharmacie', updatedPharmacy._id, user._id, "Document Upload", `Document ${extra} pour la pharmacie ${updatedPharmacy.name} uploadé avec succès par ${user.name}`);
    }
    if (updatedPharmacy.status == "pending") {
        await registerActivity('Pharmacie', updatedPharmacy._id, user._id, "Pharmacie Mise à jour", `La pharmacie ${updatedPharmacy.name} a été mise à jour et son statut est maintenant inactif`);
    }
    if (updates.includes('user.edit.name')) {
        await registerActivity('Utilisateur', updatedPharmacy._id, user._id, "Nom Mis à jour", `Le nom de l'utilisateur ${updatedPharmacy.name} a été mis à jour en ${updatedPharmacy.name}`);
    }
    if (updates.includes('user.edit.surname')) {
        await registerActivity('Utilisateur', updatedPharmacy._id, user._id, "Prenom Mis à jour", `Le prenom de l'utilisateur ${updatedPharmacy.name} a été mis à jour en ${updatedPharmacy.surname}`);
    }
    if (updates.includes('user.edit.address')) {
        await registerActivity('Utilisateur', updatedPharmacy._id, user._id, "Adresse Mis à jour", `L'adresse de l'utilisateur ${updatedPharmacy.name} a été mis à jour en ${updatedPharmacy.address}`);
    }
    if (updates.includes('user.edit.city')) {
        await registerActivity('Utilisateur', updatedPharmacy._id, user._id, "Ville Mis à jour", `La ville de l'utilisateur ${updatedPharmacy.name} a été mis à jour en ${updatedPharmacy.city}`);
    }
    if (updates.includes('user.edit.phone')) {
        await registerActivity('Utilisateur', updatedPharmacy._id, user._id, "Telephone Mis à jour", `Le numero de téléphone de l'utilisateur ${updatedPharmacy.name} a été mis à jour en ${updatedPharmacy.phone.dial_code} ${updatedPharmacy.phone.digits}`);
    }
    if (notEmail) { return; }

    let EmailTo = [];
    if (process.env.environment === 'development') {
        EmailTo = ['damienzipadonou@gmail.com'];
    }else{
        const groups = await Group.find({ code: { $in: ['manager_admin', 'support_admin'] }, isActive: true });
        const admins = groups.length > 0 ? await Admin.find({ group: { $in: groups.map(g => g._id) }, isActive: true }) : [];
        EmailTo = admins.length > 0 ? admins.map(admin => admin.email).filter(email => !!email) : ['damienzipadonou@gmail.com'];
    }

    for (const email_admin of EmailTo) {
        await transporter.sendMail({
            from: `"Support CTMPHARMA" <${process.env.MAIL_USER}>`,
            to: email_admin,
            subject: 'Les informations d\'une pharmacie ont été modifiées',
            html: messageToSendToAdmin + ((updatedPharmacy.status == "pending") ? '<br><b>Suite à la modification de certains éléments, vous ou un administrateur devez procéder à la vérification des éléments modifiés et approuver la pharmacie pour qu\'elle puisse à nouveau apparaître chez nos clients !</b>' : ''),
        });
    }
}
const loadHistoricMiniChat = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        var user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let { pharmacyId, iD } = req.body;

        const pharmacy = pharmacyId ? await Pharmacy.findOne({_id: pharmacyId}) : ( iD ? await Pharmacy.findOne({_id: iD}) : false);

        if (!pharmacy) {
            return res.status(200).json({ 'error':0, message:'La pharmacie n\'existe pas!' });
        }

        const messages = await MiniChatMessage.find({for: pharmacy._id}).populate('attachments');
        
        return res.status(200).json({'error':0, data:messages});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const pharmacyUsersList = async (req, res) => {
    try {
        const { page = 1, limit = 10,search,status,role,pharmacy,sortBy = 'createdAt',sortOrder = 'desc',pharmaciesId,email,name,surname } = req.body;

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];;
        if (pharmacy && pharmaciesManaged.includes(pharmacy)) {
            pharmaciesManaged = [pharmacy];
        } else if (pharmaciesId) {
            pharmaciesManaged = (Array.isArray(pharmaciesId) ? pharmaciesId : [pharmaciesId]).map(phamr => pharmaciesManaged.includes(phamr) ? phamr : null).filter(Boolean);
        } 
        // else {
        //     const canManageAllPharmacies = user?.groups?.some(g => ['manager_pharmacy'].includes(g.code));
        //     if (canManageAllPharmacies) {
        //         pharmaciesManaged = null;
        //     }         

        if (pharmaciesManaged && pharmaciesManaged.length > 0) {
            query.pharmaciesManaged = { $in: pharmaciesManaged };
        } else if (pharmaciesManaged !== null && pharmaciesManaged?.length === 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }

        // Status filter
        if (status) {
            switch (status) {
                case 'active': query.disabled = false; query.isActivated = true; break;
                case 'disabled': query.disabled = true; break;
                case 'not_activated': query.isActivated = false; break;
                case 'locked': query.accountLockedUntil = { $gte: new Date() }; break;
                default: query.isActivated = { $nin: [false] }; break;
            }
        } else {
            query.isActivated = { $nin: [false] };
        }

        if (role) {
            const roleGroup = await Group.findOne({ code: role });
            if (roleGroup) {
                query.groups = { $in: [roleGroup._id] };
            }
        }

        if (search) {
            const cleanedSearch = search.replace(/\s+/g, '').trim();
            const regex = new RegExp(cleanedSearch, 'i');
            query.$or = [
                { name: regex },
                { surname: regex },
                { email: regex },
                { address: regex },
            ];
        }

        if (email) { query.email = new RegExp(email, 'i'); }
        if (name) { query.name = new RegExp(name, 'i'); }
        if (surname) { query.surname = new RegExp(surname, 'i');}

        let sortObject = {};
        const validSortFields = ['name', 'surname', 'email', 'createdAt', 'updatedAt', 'lastLogin'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        sortObject[sortField] = sortDirection;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const totalUsers = await Admin.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limitNum);

        let users = await Admin.find(query)
            .populate([
                {  path: 'country', select: 'name code dialCode flag' },
                { 
                    path: 'city',
                    select: 'name postalCode',
                    populate: { path: 'country', select: 'name code' }
                },
                { 
                    path: 'pharmaciesManaged',
                    select: 'name address phoneNumber email licenseNumber isActive',
                    populate: [ { path: 'city', select: 'name' }, { path: 'country', select: 'name' } ]
                },
                { path: 'phone', },
                { 
                    path: 'mobils',
                    select: 'number isVerified type isPrimary',
                    populate: { path: 'country', select: 'name dialCode' }
                },
                { 
                    path: 'setups',
                    select: 'theme language timezone dateFormat currency notifications'
                },
                { 
                    path: 'groups', 
                    select: 'name code description isActive',
                    populate: { path: 'permissions', select: 'name code description' }
                }
            ])
            .sort(sortObject)
            .skip(skip)
            .limit(limitNum)
            .lean();

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            users = users.filter(user => {
                return user.name?.match(searchRegex) ||
                       user.surname?.match(searchRegex) ||
                       user.email?.match(searchRegex) ||
                       user.address?.match(searchRegex) ||
                       user.city?.name?.match(searchRegex) ||
                       user.country?.name?.match(searchRegex) ||
                       user.pharmaciesManaged?.some(p => p.name?.match(searchRegex));
            });
        }

        users = users.map(usss => ({
            ...usss,
            photoURL: usss.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(usss.name || 'User')}&background=random&size=500`,
            isActive: !usss.disabled && usss.isActivated,
            isAccountLocked: usss.accountLockedUntil && new Date(usss.accountLockedUntil) > new Date(),
            fullName: [usss.name, usss.surname].filter(Boolean).join(' ') || usss.email || 'Utilisateur sans nom'
        }));

        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code)) 
            ? user.pharmaciesManaged.map(pharm => ({ 
                value: pharm._id, 
                label: pharm.name 
              })) 
            : [];

        let pharmsFullInfos = [];
        if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))) {
            const pharmacyIds = user.pharmaciesManaged?.map(pharm => pharm._id) || [];

            pharmsFullInfos = await Pharmacy.find({ _id: { $in: pharmacyIds } }).populate([
                { path: 'location' },
                { path: 'country' },
                { path: 'workingHours' },
                {
                    path: 'deliveryZone',
                    populate: {
                        path: 'coordinates',
                        populate: { path: 'points' },
                    },
                },
                {
                    path: 'documents',
                    populate: [
                        { path: 'logo' },
                        { path: 'license' },
                        { path: 'idDocument' },
                        { path: 'insurance' },
                    ],
                },
            ]);
        }

        const groups = await Group.find({ 
            code: { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] },
            isActive: true
        })
        .populate('permissions')
        .select('name code description isActive permissions plateform')
        .lean();

        return res.status(200).json({  'error': 0,  success: true, user: user,  data: {
                users: users,
                total: totalUsers,
                page: pageNum,
                limit: limitNum,
                totalPages: totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            },pharmaciesList,pharmsFullInfos,groups,filters: { status, role, pharmacy, search },sorting: { sortBy: sortField, sortOrder
            }
        });

    } catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
};
const pharmacyUsersDetail = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(200).json({  error: 1, success: false, message: 'Erreur de paramètres', errorMessage: 'Invalid Id' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];;

        if (pharmaciesManaged && pharmaciesManaged.length > 0) {
            query.pharmaciesManaged = { $in: pharmaciesManaged };
        } else if (pharmaciesManaged !== null && pharmaciesManaged?.length === 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }

        query._id = userId;

        let users = await Admin.findOne(query)
            .populate([
                {  path: 'country', select: 'name code dialCode flag' },
                {  path: 'pharmaciesManaged',},
                { path: 'phone', },
                {  path: 'mobils'},
                {  path: 'setups', },
                { 
                    path: 'groups', 
                    populate: { path: 'permissions' }
                }
            ]);

        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code)) 
            ? user.pharmaciesManaged.map(pharm => ({ 
                value: pharm._id, 
                label: pharm.name 
              })) 
            : [];

        let pharmsFullInfos = [];
        if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))) {
            const pharmacyIds = user.pharmaciesManaged?.map(pharm => pharm._id) || [];

            pharmsFullInfos = await Pharmacy.find({ _id: { $in: pharmacyIds } }).populate([
                { path: 'location' },
                { path: 'country' },
                { path: 'workingHours' },
                {
                    path: 'deliveryZone',
                    populate: {
                        path: 'coordinates',
                        populate: { path: 'points' },
                    },
                },
                {
                    path: 'documents',
                    populate: [
                        { path: 'logo' },
                        { path: 'license' },
                        { path: 'idDocument' },
                        { path: 'insurance' },
                    ],
                },
            ]);
        }

        let permissionIds = user?.groups.flatMap(group => 
            Array.isArray(group.permissions)
                ? group.permissions.map(p => p._id)
                : [group.permissions?._id]
        );

        permissionIds = [...new Set(permissionIds.map(id => id.toString()))];

        const permissions = await Permission.find({ 
            plateform: 'Pharmacy', 
            _id: { $in: permissionIds } 
        }).lean();

        return res.status(200).json({  'error': 0,  success: true, user: user,  data: {
                user: users,
                permissions,
                countries: await Country.find(),
            },
            pharmaciesList, pharmsFullInfos
        });

    } catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
};
const pharmacyUsersEditProfile = async (req, res) => {
    try {
        const { userId,name, surname, email, phone, country, city, address, isActivated} = req.body;

        if (!userId) {
            return res.status(200).json({  error: 1, success: false, message: 'Erreur de paramètres', errorMessage: 'Invalid Id' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (pharmaciesManaged && pharmaciesManaged.length > 0) {
            query.pharmaciesManaged = { $in: pharmaciesManaged };
        } else if (pharmaciesManaged !== null && pharmaciesManaged?.length === 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }

        let theUser = await Admin.findOne({_id:userId})
        if (!theUser) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Utilisateur non trouvé !', 
                errorMessage: 'Utilisateur non trouvé !',
            });
        }

        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('utilisateurs.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        var toUpdate = [];
        query._id = { $nin : userId};
        if (name) { 
            query.name = name;
            theUser.name = name;
            if (user.name !== name) {
                toUpdate.push('user.edit.name');
            }
         }
        if (surname) { 
            query.surname = surname;
            theUser.surname = surname;
            if (user.surname !== surname) {
                toUpdate.push('user.edit.surname');
            }
        }
        // if (email) { 
        //     query.email = email;
        //     theUser.email = email;
        // }
        // if (phone) { query.phone = phone; }
        let theNewCountry = null;
        if (country) { 
            theNewCountry = await Country.findOne({ _id: country });
            if (theNewCountry) {
                query.country = country;
                theUser.country = country;
                if (user.country !== country) {
                    toUpdate.push('user.edit.country');
                }
            }
            query.country = country;
        }
        if (city) { 
            query.city = city;
            theUser.city = city;
            if (user.city !== city) {
                toUpdate.push('user.edit.city');
            }
        }
        if (address) { 
            query.address = address; 
            theUser.address = address;
            if (user.address !== address) {
                toUpdate.push('user.edit.address');
            }
        }
        if (isActivated) { 
            query.isActivated = isActivated;
            theUser.isActivated = isActivated;
            if (user.isActivated !== isActivated) {
                toUpdate.push('user.edit.isActivated');
            }
        }

        let userToCheck = await Admin.findOne(query)
        query._id = userId;

        if (userToCheck) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Un utilisateur avec ces informations existe déja !', 
                errorMessage: 'Un utilisateur avec ces informations existe déja !',
            });
        }

        await theUser.save();
        theUser.populate([
                {  path: 'country', select: 'name code dialCode flag' },
                {  path: 'pharmaciesManaged',},
                { path: 'phone', },
                {  path: 'mobils'},
                {  path: 'setups', },
                { 
                    path: 'groups', 
                    populate: { path: 'permissions' }
                }
            ]);
        if (toUpdate.length) { await loadAllActivitiesAndSendMailAdmins (theUser, toUpdate, user, '', true); }
        const pharmaciesList = user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code)) 
            ? user.pharmaciesManaged.map(pharm => ({ 
                value: pharm._id, 
                label: pharm.name 
              })) 
            : [];

        let pharmsFullInfos = [];
        if (user?.groups?.some(g => ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))) {
            const pharmacyIds = user.pharmaciesManaged?.map(pharm => pharm._id) || [];

            pharmsFullInfos = await Pharmacy.find({ _id: { $in: pharmacyIds } }).populate([
                { path: 'location' },
                { path: 'country' },
                { path: 'workingHours' },
                {
                    path: 'deliveryZone',
                    populate: {
                        path: 'coordinates',
                        populate: { path: 'points' },
                    },
                },
                {
                    path: 'documents',
                    populate: [
                        { path: 'logo' },
                        { path: 'license' },
                        { path: 'idDocument' },
                        { path: 'insurance' },
                    ],
                },
            ]);
        }

        let permissionIds = user?.groups.flatMap(group => 
            Array.isArray(group.permissions)
                ? group.permissions.map(p => p._id)
                : [group.permissions?._id]
        );

        permissionIds = [...new Set(permissionIds.map(id => id.toString()))];

        const permissions = await Permission.find({ 
            plateform: 'Pharmacy', 
            _id: { $in: permissionIds } 
        }).lean();

        return res.status(200).json({  'error': 0,  success: true, user: user,  data: {
                user: theUser,
                permissions,
                countries: await Country.find(),
            },
            pharmaciesList, pharmsFullInfos
        });

    } catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
};
const usersActivities = async (req, res) => {
    try {
        const the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) &&
            user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code));

        let { id, prePage, user_: user_, all } = req.body;

        if ((!id || (Array.isArray(id) && id.length === 0)) && !userInGroupAdmin) {
            id = user.pharmaciesManaged?.map(pharm => pharm._id);
            if (!id || id.length === 0) {
                return res.status(400).json({ message: 'Missing required fields' });
            }
        }

        let _users = false;
        if (id) {
            _users = await Admin.find(
                Array.isArray(id)
                    ? { pharmaciesManaged: { $in: id } }
                    : { _id: id }
            );
        }

        if (!_users && !userInGroupAdmin) {
            return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
        }

        const query = {};
        if (user_) {
            query.author = user_.toString();
        }
        if (_users) {
            query.id_object = { $in: _users.map(c => c._id) };
        }

        const limit = parseInt(prePage) || 10;
        const activities = all
            ? await Activity.find(query).sort({ created_at: -1 })
            : await Activity.find(query).sort({ created_at: -1 }).limit(limit);

        const validAuthorIds = activities
            ? activities
                  .map(act => act.author)
                  .filter(id => mongoose.Types.ObjectId.isValid(id))
            : [];

        const users = validAuthorIds.length > 0
            ? await Admin.find({ _id: { $in: validAuthorIds } }).lean()
            : [];

        const usersMap = {};
        users.forEach(each => {
            each.photoURL = each.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(each.name || 'User')}&background=random&size=500`;

            if (each._id && mongoose.Types.ObjectId.isValid(each._id)) {
                usersMap[each._id] = {
                    name: each._id.toString() === user._id.toString() ? 'Vous' : `${each.name} ${each.surname}`,
                    img: each.photoURL
                };
            }
        });

        return res.status(200).json({
            error: 0,
            usersMap,
            data: activities,
            user
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacyUsersCreate = async (req, res) => {
    try {

        const { name, surname, email, phone, address, groups, pharmaciesManaged, sendWelcomeEmail = true, isActivated = true } = req.body;
        if (!name || !surname || !email || !pharmaciesManaged || !groups) {
            return res.status(200).json({
                error: 1,
                success: false,
                message: 'Certains paramètres sont manquants',
                errorMessage: 'Certains paramètres sont manquants'
            });
        }

        const the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        // Liste des pharmacies que le user a le droit de gérer
        let userPharmacyIds = user?.groups?.some(g =>
            ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code)
        ) ? user?.pharmaciesManaged?.map(pharm => pharm._id.toString()) || [] : [];

        // Vérification et filtrage des pharmacies demandées
        let pharmaciesManagedFiltered = [];
        if (pharmaciesManaged) {
            const requestedPharmacies = Array.isArray(pharmaciesManaged)
                ? pharmaciesManaged
                : [pharmaciesManaged];

            pharmaciesManagedFiltered = requestedPharmacies.filter(pharmId =>
                userPharmacyIds.includes(pharmId)
            );
        }

        // Vérification finale : si aucune pharmacie autorisée
        if (!pharmaciesManagedFiltered.length) {
            return res.status(200).json({
                error: 1,
                success: false,
                message: 'Vous n\'avez aucune pharmacie !',
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        let query = {};
        query.pharmaciesManaged = pharmaciesManagedFiltered;

        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('utilisateurs.create')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        query.email = email.replace(/\s+/g, '').trim();
        query.name = name.replace(/\s+/g, '').trim();; 
        query.surname = surname.replace(/\s+/g, '').trim();;

        // Check if email already exists
        const existingUser = await Admin.find(query);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 1, success: false, message: 'Un utilisateur avec ces informations existe deja !', errorMessage: 'Un utilisateur avec ces informations existe deja !'});
        }

        // Validate groups
        const validGroups = await Group.find({
            _id: { $in: groups },
            code: { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] }
        });

        if (validGroups.length !== groups.length) {
            return res.status(400).json({ error: 1, success: false, message: 'Groupes invalides', errorMessage: 'Un ou plusieurs groupes sélectionnés sont invalides' });
        }
        query.groups = validGroups.map(g => g._id);
        let uuidObj = null;

        let firebaseRezult = await getUserInfoByEmail(email, req.body.type);
        if (firebaseRezult.status === 200 && firebaseRezult.user) { 
            const existUid = await Uid({ uid: firebaseRezult.user.uid });
            if (existUid) {
                return res.status(200).json({ error: 0, success: false, errorMessage: 'L\'email du propriétaire du compte n\'est pas associé à un compte existant.' });
            }
        }
        if (firebaseRezult.status == 200 && firebaseRezult.user) { 
            uuidObj = new Uid({ uid: firebaseRezult.user.uid });
        }
        if (firebaseRezult.status !== 200){
            const resultCreatedUser = await createUserAndSendEmailLink(email, req.body.type, process.env.FRONT_BASE_LINK+'/login');
            if (resultCreatedUser.status != 200) {
                return res.status(200).json({ error: 1, message: resultCreatedUser.error ?? 'Erreur lors de la création du compte.', errorMessage: resultCreatedUser.error ?? 'Erreur lors de la création du compte.' });
            }
            firebaseRezult = await getUserInfoByEmail(email, req.body.type,);
            if (firebaseRezult.status !== 200) {
                return res.status(200).json({ error: 1, success: false, continue: false, errorMessage: 'Erreur lors de la création du compte. Veuillez réessayer.'});
            }
            uuidObj = new Uid({ uid: firebaseRezult.user.uid });
        }

        if (uuidObj !== null) { await uuidObj.save(); }
        else{
            return res.status(200).json({ error: 1, success: false, message: 'Erreur creation de compte flutter!', errorMessage: 'Erreur creation de compte flutter!'});
        }
        query.uids = [uuidObj._id];

        if (address) { query.address = address;}

        const phoneNumber = phone ? parsePhoneNumberFromString(phone) : false;
        if (phoneNumber){
            country = await Country.findOne({ code: phoneNumber.country });
            if (country){
                query.country = country._id;
               const userPhone = new Mobil({
                    digits: phoneNumber.nationalNumber,
                    indicatif: country.dial_code,
                    title: phoneNumber.nationalNumber,
                });
                await userPhone.save();
                query.phone = userPhone._id;
                query.mobils = [userPhone._id];
            }
        }
        const setups_base = new SetupBase({
            font_family: 'Poppins',
            font_size: 14,
            theme: 'light',
            isCollapse_menu: true,
        });
        await setups_base.save();
        setups_base.id = setups_base._id;
        await setups_base.save();
        query.setups =setups_base._id;

        // Create new user
        query.isActivated = isActivated ?? false;
        const newUser = new Admin(query);
        await newUser.save();

        const populatedUser = await Admin.findById(newUser._id)
            .populate([
                {  path: 'country', select: 'name code dialCode flag' },
                { 
                    path: 'pharmaciesManaged',
                    select: 'name address phoneNumber email licenseNumber isActive',
                    populate: [ { path: 'city', select: 'name' }, { path: 'country', select: 'name' } ]
                },
                { path: 'phone', },
                { 
                    path: 'mobils',
                    select: 'number isVerified type isPrimary',
                    populate: { path: 'country', select: 'name dialCode' }
                },
                { 
                    path: 'setups',
                    select: 'theme language timezone dateFormat currency notifications'
                },
                { 
                    path: 'groups', 
                    select: 'name code description isActive',
                    populate: { path: 'permissions', select: 'name code description' }
                }
            ])
        await registerActivity('Nouvel utilisateur', newUser._id, user._id, "Un nouvel utilisateur a ete ajoute", `L'utlisateur : ${newUser.name}  ${newUser.name} a etee ajoute par ${user.name} ${user.name}`);
        await registerActivity('Genaral Settings', setups_base._id, user._id,  "Nouveau parametres generals ajoute", "Des parametres generaux de utilisateur ont ete crees");

        if (sendWelcomeEmail) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Bienvenue sur <span style="color:#1976d2;">CTMPHARMA</span> !</h2>
                    <p>Bonjour ${newUser.name || ''} ${newUser.surname || ''},</p>
                    <p>Nous sommes ravis de vous compter parmi nous.</p>
                    <p>Vous pouvez dès à présent accéder à votre espace personnel pour gérer vos activités.</p>
                    <p>Si vous avez des questions, n’hésitez pas à nous contacter à <a href="mailto:${process.env.MAIL_USER}">${process.env.MAIL_USER}</a>.</p>
                    <br>
                    <p>À très bientôt,</p>
                    <p>L’équipe CTMPHARMA</p>
                </div>
            `;

            await transporter.sendMail({
                from: `"Support CTMPHARMA" <${process.env.MAIL_USER}>`,
                to: email,
                subject: 'Bienvenue sur CTMPHARMA',
                html: htmlContent,
            });
            await registerActivity('Envoie Email', newUser._id, user._id,  "Un email de bienvenue a ete envoyé", `Un email de bienvenue a ete envoyé au nouvel utilisateur : ${newUser.name}  ${newUser.name}!`);
        }

        return res.status(201).json({ error: 0, success: true, message: 'Utilisateur créé avec succès', data: populatedUser});

    } catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
};
const pharmacyPermissionsList = async (req, res) => {
    try{

        const { page = 1, limit = 10,search,status,role,pharmacy,sortBy = 'createdAt',sortOrder = 'desc',pharmaciesId,email,name,surname } = req.body;

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const permissions = await Permission.find({plateform:'Pharmacy'});

        return res.status(200).json({  'error': 0,  success: true, user: user,  permissions: permissions,});

    } catch (error) {
        console.error('Error in pharmacyPermissionsList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message});
    }
}
const pharmacyGroupsList = async (req, res) => {
    try{
        const { page = 1, limit = 10,search,isActive,name,pharmacy,sortBy = 'createdAt',sortOrder = 'desc',pharmaciesId, code, description, idUser } = req.body;

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        let query = {};
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];
        if (pharmacy && pharmaciesManaged.includes(pharmacy)) {
            pharmaciesManaged = [pharmacy];
        } else if (pharmaciesId) {
            pharmaciesManaged = (Array.isArray(pharmaciesId) ? pharmaciesId : [pharmaciesId]).map(phamr => pharmaciesManaged.includes(phamr) ? phamr : null).filter(Boolean);
        }     

        if (pharmaciesManaged && pharmaciesManaged.length > 0) {
            query.pharmaciesManaged = { $in: pharmaciesManaged };
        } else if (pharmaciesManaged !== null && pharmaciesManaged?.length === 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }

        if (idUser) {
            const theFilteredUser = await Admin.findOne({ _id: idUser });
            // if (!theFilteredUser || !theFilteredUser.pharmaciesManaged || !theFilteredUser.pharmaciesManaged.length || ! pharmaciesManaged.some(pharmacy =>theFilteredUser.pharmaciesManaged.includes(pharmacy) ) ){
            //     return res.status(404).json({ error: 1, success: false, message: 'L\'utilisateur n\'appartient pas a la pharmacie selectionnée ou a votre groupe de pharmacies' });
            // }
            query._id = {$in :  theFilteredUser.groups};
        }

        // Status filter
        if (isActive) {
            query.isActivated = isActive;
        } 

        if (search) {
            const cleanedSearch = search.replace(/\s+/g, '').trim();
            const regex = new RegExp(cleanedSearch, 'i');
            query.$or = [
                { name: regex },
                { code: regex },
                { description: regex },
            ];
        }

        if (name) { query.name = new RegExp(name, 'i'); }
        if (code) { 
            query.code = [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(code) ? new RegExp(code, 'i') : { $in : []} ; 
        }else{
            query.code= { $in : [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant']};
        }
        if (description) { query.description = new RegExp(description, 'i'); }

        let sortObject = {};
        const validSortFields = ['code', 'name', 'description', 'createdAt', 'updatedAt'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        sortObject[sortField] = sortDirection;

        const groups = await Group.find(query).sort(sortObject).skip((page - 1) * limit).limit(limit);
        // let users = await Admin.find(query)
        return  res.status(200).json({  'error': 0,  success: true, user: user,  data: groups,});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsJoin = async (req, res) => {
    try{
        const { id } = req.body;

        if (!id) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid grouop id', errorMessage: 'Le groupe n\'existe pas !' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        query._id = id;
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = await Group.find(query);
        if (!group) {
            return res.status(404).json({ error: 1, success: false, message: 'Le groupe n\'existe pas !', errorMessage: 'Le groupe n\'existe pas !' });
        }
        if (!user.groups?.some(grouppp => grouppp._id.toString() == group[0]._id.toString()) ) {
            const toSave = await Admin.findById(user._id);
            toSave.groups.push(group[0]._id);
            await toSave.save();
        }else{
            return res.status(200).json({ error: 1, success: false, message: 'Vous avez déjà rejoins ce groupe !', errorMessage: 'Vous avez déjà rejoins ce groupe !' });
        }
        await registerActivity('Groupes', group[0]._id, user._id,  "L'utilisateur a ete rejoint le groupe "+group[0].name+" : "+user.name );

        return res.status(200).json({  'error': 0,  success: true, user: user, message: 'Vous avez rejoint le groupe !', errorMessage: 'Vous avez rejoint le groupe !'});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsLeave = async (req, res) => {
    try{
        const { id } = req.body;

        if (!id) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid grouop id', errorMessage: 'Le groupe n\'existe pas !' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        query._id = id;
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = await Group.find(query);
        if (!group) {
            return res.status(404).json({ error: 1, success: false, message: 'Le groupe n\'existe pas !', errorMessage: 'Le groupe n\'existe pas !' });
        }
        if (user.groups?.some(grouppp => grouppp._id.toString() == group[0]._id.toString()) ) {
            const toSave = await Admin.findById(user._id);
            toSave.groups.pull(group[0]._id);
            await toSave.save();
        }else{
            return res.status(200).json({ error: 1, success: false, test: user.groups.map(g => g._id), tosearch: group[0]._id,  message: 'Vous n\'etes pas membre de ce groupe !', errorMessage: 'Vous n\'etes pas membre de ce groupe !' });
        }
        await registerActivity('Groupes', group[0]._id, user._id,  "L'utilisateur a ete quitte le groupe "+group[0].name+" : "+user.name );

        return res.status(200).json({  'error': 0,  success: true, user: user, message: 'Vous avez quitte le groupe avec succes !', errorMessage: 'Vous avez quitte le groupe avec succes !'});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsgetMembers = async (req, res) => {
    try{
        const { id } = req.body;

        if (!id) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid group id', errorMessage: 'Le groupe n\'existe pas !' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        query._id = id;
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = await Group.find(query);
        if (!group) {
            return res.status(404).json({ error: 1, success: false, message: 'Le groupe n\'existe pas !', errorMessage: 'Le groupe n\'existe pas !' });
        }
        const members = await Admin.find({ 
                groups: { $in : [group[0]._id] }, 
                pharmaciesManaged: { $in: pharmaciesManaged } 
            }).populate([
                { path: 'country' },
                { path: 'phone' },
                { path: 'mobils' },
                { path: 'setups' },
                {path: 'pharmaciesManaged'},
                { path: 'groups', populate: [
                    { path: 'permissions' }
                ]}
            ]);
        
        return res.status(200).json({'error': 0, members: members, success: true, user: user});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsgetAvailableUsers = async (req, res) => {
    try{
        const { groupId } = req.body;
        if (!groupId) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid group id', errorMessage: 'Le groupe n\'existe pas !' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        query._id = groupId;
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = await Group.find(query);
        if (!group) {
            return res.status(404).json({ error: 1, success: false, message: 'Le groupe n\'existe pas !', errorMessage: 'Le groupe n\'existe pas !' });
        }
        const members = await Admin.find({ 
                groups: { $nin : [group[0]._id] }, 
                pharmaciesManaged: { $in: pharmaciesManaged } 
            }).populate([
                { path: 'country' },
                { path: 'phone' },
                { path: 'mobils' },
                { path: 'setups' },
                {path: 'pharmaciesManaged'},
                { path: 'groups', populate: [
                    { path: 'permissions' }
                ]}
            ]);
        
        return res.status(200).json({'error': 0, members: members, success: true, user: user});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsaddMembers = async (req, res) => {
    try{
        let { groupId, userIds } = req.body;

        if (!groupId || !userIds) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid group id', errorMessage: 'Le groupe n\'existe pas !' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        query._id = groupId;
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = await Group.find(query);
        if (!group) {
            return res.status(404).json({ error: 1, success: false, message: 'Le groupe n\'existe pas !', errorMessage: 'Le groupe n\'existe pas !' });
        }
        userIds = Array.isArray(userIds) ? userIds : [userIds];
        userIds = userIds.map(userId => userId.trim());

        const members = await Admin.find({ 
                _id: {$in : userIds},
                groups: { $nin : [group[0]._id] }, 
                pharmaciesManaged: { $in: pharmaciesManaged } 
            }).populate([
                { path: 'country' },
                { path: 'phone' },
                { path: 'mobils' },
                { path: 'setups' },
                {path: 'pharmaciesManaged'},
                { path: 'groups', populate: [
                    { path: 'permissions' }
                ]}
            ]);

        members.forEach(member => {
            member.groups.push(group[0]);
            member.save();
        });
        await registerActivity('Groupes', group[0]._id, user._id,  (members.length > 1 ? "les utilisateurs suivant ont ete ajoutes au groupe "+group[0].name : "l'utilisateur a ete ajoute au groupe "+group[0].name)+" : "+(members.map(m => m.name).join(', ')));

        return res.status(200).json({'error': 0, user: user});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsremoveMember = async (req, res) => {
    try{
        let { groupId, userId } = req.body;

        if (!groupId || !userId) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid group id', errorMessage: 'Le groupe n\'existe pas !' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        query._id = groupId;
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = await Group.find(query);
        if (!group) {
            return res.status(404).json({ error: 1, query,success: false, message: 'Le groupe n\'existe pas !', errorMessage: 'Le groupe n\'existe pas !' });
        }
        userId = Array.isArray(userId) ? userId : [userId];
        userId = userId.map(uss => uss.trim());

        const members = await Admin.find({ 
                _id: {$in : userId},
                groups: { $in : [group[0]._id] }, 
                pharmaciesManaged: { $in: pharmaciesManaged } 
            }).populate([
                { path: 'country' },
                { path: 'phone' },
                { path: 'mobils' },
                { path: 'setups' },
                {path: 'pharmaciesManaged'},
                { path: 'groups', populate: [
                    { path: 'permissions' }
                ]}
            ]);

        members.forEach(member => {
            member.groups.pop(group[0]);
            member.save();
        });
        await registerActivity('Groupes', group[0]._id, user._id,  (members.length > 1 ? "les utilisateurs suivant ont ete retires du groupe "+group[0].name : "l'utilisateur a ete retire du groupe "+group[0].name)+" : "+(members.map(m => m.name).join(', ')));

        return res.status(200).json({'error': 0, user: user});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const pharmacyGroupsManage = async (req, res) => {
    try{
        let { addGroups, removeGroups, addPermissions, removePermissions, userId } = req.body;

        if (!userId) {
            return res.status(404).json({ error: 1, success: false, message: 'Invalid id', errorMessage: 'Invalid Id' });
        }

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
                    ? user.pharmaciesManaged.map(pharm => pharm._id)
                    : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }
        const userPermissions = await loadAllPermissions(user, req, res);
        if (!userPermissions.permissions?.includes('groups.edit')) {
            return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        }

        let query = {};
        addGroups = Array.isArray(addGroups) ? addGroups : [addGroups];
        removeGroups = Array.isArray(removeGroups) ? removeGroups : [removeGroups];

        const allGroups = [...addGroups, ...removeGroups];

        query._id = { $in :allGroups };
        query.code = { $in: ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'] };

        const group = allGroups ? await Group.find(query) : [];
        if (group) {
            userId = Array.isArray(userId) ? userId : [userId];
            userId = userId.map(uss => uss.trim());

            const members = await Admin.find({ _id: {$in : userId},groups: { $in : [group[0]._id] }, pharmaciesManaged: { $in: pharmaciesManaged } })
                                            .populate([
                                                { path: 'country' },
                                                { path: 'phone' },
                                                { path: 'mobils' },
                                                { path: 'setups' },
                                                {path: 'pharmaciesManaged'},
                                                { path: 'groups', populate: [
                                                    { path: 'permissions' }
                                                ]}
                                            ]);
            
            members.forEach(member => {
                let the_finals_groups = member.groups;
                if (removeGroups.length > 0) {
                    the_finals_groups = the_finals_groups.filter(g => !removeGroups.includes(g._id));
                }
                if (addGroups.length > 0) {
                    the_finals_groups.push(...addGroups);
                }
                member.groups = the_finals_groups;
                member.save();
            });
            await registerActivity('Groupes', group[0]._id, user._id,  (members.length > 1 ? "les utilisateurs suivant ont ete retires ou ajoutes aux groupes "+group.map( g => g.name ).join(', ') : "l'utilisateur a ete retire ou ajoute au groupes "+group.map( g => g.name ).join(', ')+" : "+(members.map(m => m.name).join(', '))));
        }
        return res.status(200).json({'error': 0, group, user: user});
    }catch (error) {
        console.error('Error in pharmacyUsersList:', error);
        return res.status(500).json({  error: 1, success: false, message: 'Erreur serveur', errorMessage: error.message
        });
    }
}
const loadConversations = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        const { limit = 10 } = req.body;

        var user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
        // const userPermissions = await loadAllPermissions(user, req, res);
        // if (!userPermissions.permissions?.includes('inbox.edit')) {
        //     return res.status(200).json({ error: 1, success: false, message: 'Vous n\'avez pas les permissions nécessaires', errorMessage: 'Vous n\'avez pas les permissions nécessaires' });
        // }

        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
            ? user.pharmaciesManaged.map(pharm => pharm._id)
            : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            return res.status(200).json({ 
                'error': 1, 
                success: false, 
                message: 'Vous n\'avez aucune pharmacie !', 
                errorMessage: 'Vous n\'avez aucune pharmacie !',
            });
        }

        const allUsers = await Admin.find({ pharmaciesManaged: { $in: pharmaciesManaged } });
        const activities = await Activity.find({author: {$in: allUsers.map(u => u._id)}}).sort({ updatedAt: -1 }) .limit(5);

        const query = {
            participants: { $in: [user._id] },
        };

        let conversations = await Conversation.find(query).
        populate(
            {
                path: 'participants',
                populate: [
                    { path: 'country' },
                    { path: 'phone' },
                    { path: 'mobils' },
                    { path: 'setups' },
                    { path: 'groups' },
                    { path: 'pharmaciesManaged' },
                ]
            }
        )
        .sort({ updatedAt: -1 })   // tri décroissant par date de modif
        .limit(limit ? parseInt(limit) : 10);

        const mesQuery = { conversation: { $in: conversations.map(c => c._id) } };

        const messages = conversations.length ? await MiniChatMessage.find(mesQuery).populate('attachments') : [];
        const formattedConversations = conversations.map(conv => {
            const convMessages = messages
                .filter(msg => msg.conversation?.toString() === conv._id.toString())
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            const lastMessage = convMessages.length ? convMessages[0] : null;

            // Calcul des messages non lus pour l'utilisateur
            const unreadCount = convMessages.filter(msg =>
                !msg.seen && msg.senderId !== user._id.toString()
            ).length;

            return {
                _id: conv._id,
                participants: conv.participants.map(p => new Admin(p)),
                lastMessage: lastMessage ? new MiniChatMessage(lastMessage) : undefined,
                unreadCount: unreadCount,
                isGroup: conv.isGroup || false,
                groupName: conv.groupName || null,
                createdAt: conv.createdAt,
                updatedAt: conv.updatedAt
            };
        });
        return res.status(200).json({ error: 0, success: true, activities, data: formattedConversations});

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
const createConversation = async (req, res) => {
  try {
    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) return res.status(404).json({ message: 'User not found' });

    const user = the_admin.the_user;
    const { participants, isGroup, groupName } = req.body;

    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants manquants' });
    }

    const allParticipants = [...new Set([...participants, user._id.toString()])];

    // Vérifie si une conversation identique existe déjà (non groupée)
    let existingConversation = await Conversation.findOne({
      isGroup: false,
      participants: { $all: allParticipants, $size: allParticipants.length }
    });

    if (!isGroup && existingConversation) {
      return res.status(200).json({ success: true, data: existingConversation });
    }

    const conversation = new Conversation({
      participants: allParticipants,
      isGroup,
      groupName: isGroup ? groupName : null
    });

    await conversation.save();

    return res.status(200).json({ success: true, data: conversation });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
const loadMessages = async (req, res) => {
  try {
    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) return res.status(404).json({ message: 'User not found' });

    const user = the_admin.the_user;
    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId requis' });
    }

    // Vérifie que le user fait bien partie de la conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.participants.includes(user._id)) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    const messages = await MiniChatMessage.find({
      conversation: conversationId,
      isDeleted: false
    }).populate('attachments');

    return res.status(200).json({
      success: true,
      data: messages
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
const generateTicketNumber = async () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  let counter = 1;
  let ticketNumber;
  
  do {
    const counterStr = String(counter).padStart(4, '0');
    ticketNumber = `TK${year}${month}${day}${counterStr}`;
    
    const existing = await Ticket.findOne({ ticketNumber });
    if (!existing) break;
    
    counter++;
  } while (counter <= 9999);
  
  return ticketNumber;
};

// Fonction utilitaire pour calculer les statistiques
const calculateTicketStats = async (userPharmacies) => {
  try {
    const query = { pharmacy: { $in: userPharmacies } };
    
    const [
      total,
      open,
      inProgress,
      resolved,
      closed,
      pending,
      priorityStats,
      categoryStats,
      unreadMessages
    ] = await Promise.all([
      Ticket.countDocuments(query),
      Ticket.countDocuments({ ...query, status: 'open' }),
      Ticket.countDocuments({ ...query, status: 'in_progress' }),
      Ticket.countDocuments({ ...query, status: 'resolved' }),
      Ticket.countDocuments({ ...query, status: 'closed' }),
      Ticket.countDocuments({ ...query, status: 'pending' }),
      
      // Stats par priorité
      Ticket.aggregate([
        { $match: query },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      
      // Stats par catégorie
      Ticket.aggregate([
        { $match: query },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      
      // Messages non lus
      TicketMessage.aggregate([
        {
          $lookup: {
            from: 'tickets',
            localField: '_id',
            foreignField: 'messages',
            as: 'ticket'
          }
        },
        {
          $match: {
            seen: false,
            'ticket.pharmacy': { $in: userPharmacies }
          }
        },
        { $count: 'total' }
      ])
    ]);

    // Formatage des résultats
    const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };
    priorityStats.forEach(stat => {
      byPriority[stat._id] = stat.count;
    });

    const byCategory = { technical: 0, billing: 0, account: 0, feature_request: 0, bug_report: 0, general: 0 };
    categoryStats.forEach(stat => {
      byCategory[stat._id] = stat.count;
    });

    // Temps moyen de résolution (à implémenter selon vos besoins)
    const resolvedTickets = await Ticket.find({ 
      ...query, 
      status: 'resolved', 
      resolvedAt: { $exists: true } 
    }).select('createdAt resolvedAt');
    
    let averageResolutionTime = 0;
    if (resolvedTickets.length > 0) {
      const totalTime = resolvedTickets.reduce((acc, ticket) => {
        return acc + (new Date(ticket.resolvedAt) - new Date(ticket.createdAt));
      }, 0);
      averageResolutionTime = Math.round(totalTime / resolvedTickets.length / (1000 * 60 * 60)); // en heures
    }

    return {
      total,
      open,
      inProgress,
      resolved,
      closed,
      pending,
      byPriority,
      byCategory,
      averageResolutionTime,
      totalUnread: unreadMessages[0]?.total || 0
    };

  } catch (error) {
    console.error('❌ Erreur calcul stats:', error);
    throw error;
  }
};

// Liste des tickets avec pagination et filtres
const getTicketsList = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category, assignedTo, pharmacy, search, dateFrom, dateTo } = req.body;

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) { return res.status(404).json({ message: 'User not found' }); }
        
        const user = the_admin.the_user;
        user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
        
    // Vérification des permissions
    const hasTicketPermission = user?.groups?.some(g => 
      ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant', 'admin'].includes(g.code)
    );

    if (!hasTicketPermission) {
      return res.status(403).json({ 
        error: 1, 
        success: false, 
        message: 'Vous n\'avez pas les permissions pour accéder aux tickets' 
      });
    }

    // Construction de la query
    let query = {};

    // Filtrage par pharmacies gérées
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);
    if (pharmacy && userPharmacies.includes(pharmacy)) {
      query.pharmacy = pharmacy;
    } else {
      query.pharmacy = { $in: userPharmacies };
    }

    // Application des filtres
    if (status) {
      const statusArray = Array.isArray(status) ? status : status.split(',');
      query.status = { $in: statusArray };
    }

    if (priority) {
      const priorityArray = Array.isArray(priority) ? priority : priority.split(',');
      query.priority = { $in: priorityArray };
    }

    if (category) {
      const categoryArray = Array.isArray(category) ? category : category.split(',');
      query.category = { $in: categoryArray };
    }

    if (assignedTo) {
      query['assignedTo._id'] = assignedTo;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { ticketNumber: { $regex: search, $options: 'i' } }
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Exécution de la requête
    const [tickets, total] = await Promise.all([
      Ticket.find(query)
        .populate([
          { path: 'createdBy', select: 'name surname email photoURL' },
          { path: 'pharmacy', select: 'name address' },
          { path: 'assignedTo._id', select: 'name surname email photoURL' },
          { path: 'attachments' },
          { path: 'messages', populate: { path: 'author', select: 'name surname' } }
        ])
        .sort({ lastActivity: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Ticket.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
      error: 0,
      success: true,
      data: {
        tickets,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages
      },
      user
    });

  } catch (error) {
    console.error('❌ Erreur getTicketsList:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Récupérer un ticket spécifique
const getTicketById = async (req, res) => {
  try {
    const { ticketId, uid } = req.body;

    if (!ticketId) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'ID du ticket requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    const ticket = await Ticket.findOne({
      _id: ticketId,
      pharmacy: { $in: userPharmacies }
    })
    .populate([
      { path: 'createdBy'},
      { path: 'pharmacy'},
      { path: 'assignedTo._id'},
      { path: 'attachments' },
      { 
        path: 'messages', 
        populate: ([
            { path: 'author'},
            { path: 'attachments' },

        ]),
        options: { sort: { createdAt: 1 } }
      }
    ]);

    if (!ticket) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé' 
      });
    }
    ticket.createdBy.photoURL = ticket.createdBy.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.createdBy.name || 'User')}&background=random&size=500`;
    if (ticket.assignedTo && ticket.assignedTo._id) {
      ticket.assignedTo._id.photoURL = ticket.assignedTo._id.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.assignedTo._id.name || 'User')}&background=random&size=500`;
    }

    const allAtachements = ticket.attachments || [];
    if (Array.isArray(ticket.messages)) {
      ticket.messages = ticket.messages.map(message => {
        if (message && message.author) {
          message.author.photoURL = message.author.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(message.author.name || 'User')}&background=random&size=500`;
          allAtachements.push(...(message.attachments || []));
        }
        return message;
      });
    }

    return res.status(200).json({
      error: 0,
      success: true,
      data: ticket,
      user,
      allAtachements
    });

  } catch (error) {
    console.error('❌ Erreur getTicketById:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Créer un nouveau ticket
const createTicket = async (req, res) => {
  try {
    const { title, description, category = 'general', priority = 'medium', pharmacy, tags = [], uid } = req.body;

    if (!title || !pharmacy || !uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Titre, pharmacie et utilisateur sont requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id.toString());

    // Vérification que la pharmacie est gérée par l'utilisateur
    if (!userPharmacies.includes(pharmacy.toString())) {
      return res.status(403).json({ 
        error: 1, 
        success: false, 
        message: 'Vous n\'avez pas accès à cette pharmacie' 
      });
    }

    // Génération du numéro de ticket
    const ticketNumber = await generateTicketNumber();

    // Création du ticket
    const newTicket = new Ticket({
      ticketNumber,
      title: title.trim(),
      description: description?.trim(),
      category,
      priority,
      status: 'open',
      createdBy: user._id,
      pharmacy,
      tags: Array.isArray(tags) ? tags : [],
      messages: [],
      lastActivity: new Date()
    });

    await newTicket.save();
    await newTicket.populate([
      { path: 'createdBy', select: 'name surname email photoURL' },
      { path: 'pharmacy', select: 'name address email phone' }
    ]);

    // Enregistrer l'activité
    await registerActivity('Ticket', newTicket._id, user._id, "Création Ticket", `Nouveau ticket créé : ${newTicket.title}`);

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Ticket créé avec succès',
      data: newTicket,
      user
    });

  } catch (error) {
    console.error('❌ Erreur createTicket:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Mettre à jour un ticket
const updateTicket = async (req, res) => {
  try {
    const { ticketId, uid, updates } = req.body;

    if (!ticketId || !uid || !updates) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'ID du ticket, utilisateur et mises à jour requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    const ticket = await Ticket.findOne({
      _id: ticketId,
      pharmacy: { $in: userPharmacies }
    });

    if (!ticket) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé' 
      });
    }

    // Champs autorisés à la mise à jour
    const allowedFields = ['title', 'description', 'category', 'priority', 'status', 'assignedTo', 'tags', 'estimatedResolution'];
    const updateFields = [];

    // Application des mises à jour
    for (const [field, value] of Object.entries(updates)) {
      if (allowedFields.includes(field) && value !== undefined) {
        if (field === 'status' && value === 'resolved' && !ticket.resolvedAt) {
          ticket.resolvedAt = new Date();
        }
        if (field === 'status' && value === 'closed' && !ticket.closedAt) {
          ticket.closedAt = new Date();
        }
        
        ticket[field] = value;
        updateFields.push(field);
      }
    }

    ticket.lastActivity = new Date();
    await ticket.save();

    await ticket.populate([
      { path: 'createdBy'},
      { path: 'pharmacy'},
      { path: 'assignedTo._id'},
      { path: 'attachments' },
      { 
        path: 'messages', 
        populate: { 
          path: 'author', 
        },
        options: { sort: { createdAt: 1 } }
      }
    ]);

    ticket.createdBy.photoURL = ticket.createdBy.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.createdBy.name || 'User')}&background=random&size=500`;
    if (ticket.assignedTo && ticket.assignedTo._id) {
      ticket.assignedTo._id.photoURL = ticket.assignedTo._id.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.assignedTo._id.name || 'User')}&background=random&size=500`;
    }

    if (Array.isArray(ticket.messages)) {
      ticket.messages = ticket.messages.map(message => {
        if (message && message.author) {
          message.author.photoURL = message.author.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(message.author.name || 'User')}&background=random&size=500`;
        }
        return message;
      });
    }


    // Enregistrer l'activité
    if (updateFields.length > 0) {
      await registerActivity('Ticket', ticket._id, user._id, "Mise à jour Ticket", `Ticket mis à jour : ${updateFields.join(', ')}`);
    }

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Ticket mis à jour avec succès',
      data: ticket,
      user
    });

  } catch (error) {
    console.error('❌ Erreur updateTicket:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Supprimer un ticket
const deleteTicket = async (req, res) => {
  try {
    const { ticketId, uid } = req.body;

    if (!ticketId || !uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'ID du ticket et utilisateur requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    const ticket = await Ticket.findOne({
      _id: ticketId,
      pharmacy: { $in: userPharmacies }
    });

    if (!ticket) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé' 
      });
    }

    // Suppression des messages associés
    await TicketMessage.deleteMany({ _id: { $in: ticket.messages } });

    // Suppression du ticket
    await Ticket.findByIdAndDelete(ticketId);

    // Enregistrer l'activité
    await registerActivity('Ticket', ticketId, user._id, "Suppression Ticket", `Ticket supprimé : ${ticket.title}`);

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Ticket supprimé avec succès',
      user
    });

  } catch (error) {
    console.error('❌ Erreur deleteTicket:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Envoyer un message dans un ticket
const sendMessage = async (req, res) => {
  try {
    const { ticketId, content, attachments = [], isInternal = false } = req.body;

    if (!ticketId || !content) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'ID du ticket, contenu et auteur requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    let ticket = await Ticket.findOne({
      _id: ticketId,
      pharmacy: { $in: userPharmacies }
    });

    if (!ticket) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé' 
      });
    }

    // Création du message
    const newMessage = new TicketMessage({
      content: content.trim(),
      author: user._id,
      attachments: Array.isArray(attachments) ? attachments : [],
      isInternal,
      seen: false
    });

    await newMessage.save();
    // await newMessage.populate([
    //   { path: 'author' },
    //   { path: 'attachments' }
    // ]);
    // Mise à jour du ticket
    ticket.messages.push(newMessage._id);
    ticket.lastActivity = new Date();
    await ticket.save();

    await ticket.populate([
      { path: 'createdBy'},
      { path: 'pharmacy'},
      { path: 'assignedTo._id'},
      { path: 'attachments' },
      { 
        path: 'messages', 
        populate: { 
          path: 'author', 
        },
        options: { sort: { createdAt: 1 } }
      }
    ]);

    ticket.createdBy.photoURL = ticket.createdBy.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.createdBy.name || 'User')}&background=random&size=500`;
    if (ticket.assignedTo && ticket.assignedTo._id) {
      ticket.assignedTo._id.photoURL = ticket.assignedTo._id.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.assignedTo._id.name || 'User')}&background=random&size=500`;
    }

    if (Array.isArray(ticket.messages)) {
      ticket.messages = ticket.messages.map(message => {
        if (message && message.author) {
          message.author.photoURL = message.author.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(message.author.name || 'User')}&background=random&size=500`;
        }
        return message;
      });
    }

    // Enregistrer l'activité
    await registerActivity('Ticket', ticket._id, user._id, "Nouveau Message", `Message ajouté au ticket ${ticket.ticketNumber}`);

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Message envoyé avec succès',
      data: newMessage,
      user
    });

  } catch (error) {
    console.error('❌ Erreur sendMessage:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Marquer un message comme lu
const markMessageAsRead = async (req, res) => {
  try {
    const { ticketId, messageId, uid } = req.body;

    if (!ticketId || !messageId || !uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'ID du ticket, message et utilisateur requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    // Vérifier l'accès au ticket
    const ticket = await Ticket.findOne({
      _id: ticketId,
      pharmacy: { $in: userPharmacies }
    });

    if (!ticket) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé' 
      });
    }

    // Marquer le message comme lu
    const message = await TicketMessage.findById(messageId);
    if (message && !message.seen) {
      message.seen = true;
      message.seenAt = new Date();
      await message.save();
    }

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Message marqué comme lu',
      user
    });

  } catch (error) {
    console.error('❌ Erreur markMessageAsRead:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Récupérer les templates de tickets
const getTicketTemplates = async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Utilisateur requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;

    const templates = await TicketTemplate.find({ 
      isActive: true 
    })
    .populate('createdBy', 'name surname')
    .sort({ name: 1 });

    return res.status(200).json({
      error: 0,
      success: true,
      data: templates,
      user
    });

  } catch (error) {
    console.error('❌ Erreur getTicketTemplates:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Récupérer les statistiques des tickets
const getTicketStats = async (req, res) => {
  try {
    const { uid } = req.body;

    if (!uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Utilisateur requis' 
      });
    }

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    const stats = await calculateTicketStats(userPharmacies);

    return res.status(200).json({
      error: 0,
      success: true,
      data: stats,
      user
    });

  } catch (error) {
    console.error('❌ Erreur getTicketStats:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Upload d'attachements pour tickets
const uploadTicketAttachment = async (req, res) => {
  try { //damien
    const { ticketId, uid, type_ = 'ticket_attachment' } = req.body;
    const file = req.file;

    if (!file || !ticketId || !uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Fichier, ID du ticket et utilisateur requis' 
      });
    }
    req.body.type = "admin"

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    // Vérifier l'accès au ticket
    const ticket = await Ticket.findOne({
      _id: ticketId,
      pharmacy: { $in: userPharmacies }
    });

    if (!ticket) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé' 
      });
    }

    const thetime = Date.now().toString();
    const extension = file.originalname ? file.originalname.split('.').pop() : 'png';

    // Créer le répertoire s'il n'existe pas
    const uploadDir = path.join(__dirname, '../../uploads', ticketId, type_);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Déplacer le fichier
    const newFilePath = file.path.replace('uploads/', `uploads/${ticketId}/${type_}/`);
    fs.renameSync(file.path, newFilePath);

    // Créer l'enregistrement File
    const fileRecord = new File({
      originalName: file.originalname ?? `ticket_attachment_${thetime}`,
      fileName: `${ticket.ticketNumber}_${type_}_${thetime}.${extension}`,
      fileType: type_,
      fileSize: file.size,
      url: newFilePath,
      extension: extension,
      uploadedBy: user._id,
      linkedTo: { model: "Ticket", objectId: ticket._id },
      tags: ['ticket_attachment'],
      isPrivate: true
    });

    await fileRecord.save();

    // Ajouter le fichier au ticket
    ticket.attachments.push(fileRecord._id);
    await ticket.save();

    // Enregistrer l'activité
    await registerActivity('Ticket', ticket._id, user._id, "Fichier Ajouté", `Fichier ajouté au ticket ${ticket.ticketNumber}`);

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Fichier uploadé avec succès',
      fileId: fileRecord._id,
      data: fileRecord,
      user
    });

  } catch (error) {
    console.error('❌ Erreur uploadTicketAttachment:', error);
    return res.status(500).json({ error: error.message });
  }
};
const uploadTicketMessageAttachment = async (req, res) => {
  try {

    const { ticketMessageId, uid, type_ = 'ticket_attachment' } = req.body;
    const file = req.file;

    if (!file || !ticketMessageId || !uid) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Fichier, ID du ticket et utilisateur requis' 
      });
    }
    req.body.type = "admin"

    const the_admin = await getTheCurrentUserOrFailed(req, res);
    if (the_admin.error) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = the_admin.the_user;
    const userPharmacies = user.pharmaciesManaged.map(pharm => pharm._id);

    // Vérifier l'accès au ticket
    const ticketmessage = await TicketMessage.findOne({
      _id: ticketMessageId,
    });

    if (!ticketmessage) {
      return res.status(200).json({ 
        error: 1, 
        success: false, 
        message: 'Ticket non trouvé ou accès refusé hehe' 
      });
    }

    const thetime = Date.now().toString();
    const extension = file.originalname ? file.originalname.split('.').pop() : 'png';

    // Créer le répertoire s'il n'existe pas
    const uploadDir = path.join(__dirname, '../../uploads', ticketMessageId, type_);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Déplacer le fichier
    const newFilePath = file.path.replace('uploads/', `uploads/${ticketMessageId}/${type_}/`);
    fs.renameSync(file.path, newFilePath);

    // Créer l'enregistrement File
    const fileRecord = new File({
      originalName: file.originalname ?? `ticket_message_attachment_${thetime}`,
      fileName: `${ticketmessage.ticketNumber}_${type_}_${thetime}.${extension}`,
      fileType: type_,
      fileSize: file.size,
      url: newFilePath,
      extension: extension,
      uploadedBy: user._id,
      linkedTo: { model: "Ticket", objectId: ticketmessage._id },
      tags: ['ticket_message_attachment_'],
      isPrivate: true
    });

    await fileRecord.save();

    // Ajouter le fichier au ticket
    ticketmessage.attachments.push(fileRecord._id);
    await ticketmessage.save();

    // Enregistrer l'activité
    await registerActivity('Ticket', ticketmessage._id, user._id, "Fichier Ajouté", `Fichier ajouté au message du ticket`);

    return res.status(200).json({
      error: 0,
      success: true,
      message: 'Fichier uploadé avec succès',
      fileId: fileRecord._id,
      data: fileRecord,
      user
    });

  } catch (error) {
    console.error('❌ Erreur uploadTicketMessageAttachment:', error);
    return res.status(500).json({ error: error.message });
  }
};
// Bulk actions endpoint
const bulkUserActions = async (req, res) => {
    try {
        const {
            action,
            userIds = [],
            newStatus,
            newGroups = [],
            newPharmacy
        } = req.body;

        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentUser = the_admin.the_user;

        // Check permissions
        const canBulkEdit = currentUser?.groups?.some(g => ['manager_pharmacy'].includes(g.code)) ||
                           currentUser.hasPermission?.('users.bulk');

        if (!canBulkEdit) {
            return res.status(403).json({
                error: 1,
                success: false,
                message: 'Permissions insuffisantes',
                errorMessage: 'Vous n\'avez pas les permissions pour les actions en lot'
            });
        }

        if (!userIds.length) {
            return res.status(400).json({
                error: 1,
                success: false,
                message: 'Aucun utilisateur sélectionné',
                errorMessage: 'Veuillez sélectionner au moins un utilisateur'
            });
        }

        let updateObject = {};
        let result;

        switch (action) {
            case 'activate':
                updateObject = { disabled: false, isActivated: true };
                break;
            case 'deactivate':
                updateObject = { disabled: true };
                break;
            case 'change_status':
                if (newStatus === 'active') {
                    updateObject = { disabled: false, isActivated: true };
                } else if (newStatus === 'disabled') {
                    updateObject = { disabled: true };
                }
                break;
            case 'assign_groups':
                if (newGroups.length) {
                    updateObject = { groups: newGroups };
                }
                break;
            case 'assign_pharmacy':
                if (newPharmacy) {
                    updateObject = { $addToSet: { pharmaciesManaged: newPharmacy } };
                }
                break;
            default:
                return res.status(400).json({
                    error: 1,
                    success: false,
                    message: 'Action invalide',
                    errorMessage: 'L\'action spécifiée n\'est pas supportée'
                });
        }

        result = await Admin.updateMany(
            { _id: { $in: userIds } },
            updateObject
        );

        return res.status(200).json({
            error: 0,
            success: true,
            message: `Action exécutée sur ${result.modifiedCount} utilisateur(s)`,
            data: {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                action
            }
        });

    } catch (error) {
        console.error('Error in bulkUserActions:', error);
        return res.status(500).json({
            error: 1,
            success: false,
            message: 'Erreur serveur',
            errorMessage: error.message
        });
    }
};
module.exports = { authentificateUser,
    setProfilInfo,
    loadGeneralsInfo,
    loadAllActivities,
    setSettingsFont,
    pharmacieList,
    pharmacieDetails,
    pharmacieNew,
    pharmacieEdit,
    pharmacieDelete,
    pharmacieApprove,
    pharmacieSuspend,
    pharmacieActive,
    pharmacieReject,
    pharmacieDocuments,
    pharmacieDocumentsDownload,
    pharmacieUpdate,
    pharmacieDocumentsUpload,
    pharmacieWorkingsHours,
    pharmacieActivities,
    loadHistoricMiniChat,
    pharmacyCategoriesList,
    pharmacieCategorieImagesUpload,
    pharmacyCategoriesCreate,
    pharmacyCategoryDetail,
    categoriesActivities,
    categorieUpdate,
    categorieDelete,
    pharmacyCategoriesImport,
    pharmacyProductsList,
    pharmacyProductsCreate,
    productsActivities,
    uploadProductImages,
    productsAdvancedSearch,
    productsStats,
    productDelete,
    pharmacyProductsImport,
    pharmacyProductDetail,
    productUpdate,
    AllPharmacieActivities,
    pharmacyUsersList,
    pharmacyPermissionsList,
    pharmacyGroupsList,
    pharmacyGroupsJoin,
    pharmacyGroupsLeave,
    pharmacyGroupsgetMembers,
    pharmacyGroupsgetAvailableUsers,
    pharmacyGroupsaddMembers,
    pharmacyGroupsremoveMember,
    pharmacyGroupsManage,
    pharmacyUsersCreate,
    pharmacyUsersDetail,
    pharmacyUsersEditProfile,
    usersActivities,
    loadConversations,
    createConversation,
    loadMessages,
    getTicketsList,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket,
    sendMessage,
    markMessageAsRead,
    getTicketTemplates,
    getTicketStats,
    uploadTicketAttachment,
    uploadTicketMessageAttachment

};

require('module-alias/register');
require('dotenv').config();

const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse,registerActivity } = require('@tools/flutter_tools');
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
const Group = require('@models/Group');
const MiniChatMessage = require('@models/MiniChatMessage');

const { model } = require('mongoose');
const fs = require('fs');
const { error, group } = require('console');

const nodemailer = require('nodemailer');

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
        user = the_admin.the_user;
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
        const { status, region, search, thisPeriod } = req.body;
        var the_admin = await getTheCurrentUserOrFailed(req, res);

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const recentActivities = await Activity.find({})
            .sort({ "created_at.date": -1 })
            .limit(thisPeriod  ? parseInt(thisPeriod) :  50);

        data = {
            recent_activities: recentActivities,
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
        const { status, region, search } = req.body;
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
        return res.status(200).json({'error':0, user: user, data: pharmacies, onlyShowListPharm : the_admin.onlyShowListPharm });
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
const pharmacieDocumentsUpload = async (req, res) => {
    try {
        const { type_, pharmacyId, uid } = req.body;
        const file = req.file;

        const missingFields = [];
        if (!file) missingFields.push('file');
        if (!type_ || !['logo', 'license', 'idDocument', 'insurance'].includes(type_)) missingFields.push('type_');
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

        const pharmacy = await Pharmacy.findById(pharmacyId);
        if (!pharmacy) return res.status(404).json({ error: 1, success: false, message: 'Pharmacie non trouvée' });

        const thetime = Date.now().toString();
        const extension = file.originalname ? file.originalname.split('.').pop() : 'png';

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

        const file_ = new File({
            originalName: file.originalname ?? ("new_file_" + thetime),
            fileName: `${pharmacy.name}_${type_}_${thetime}.${extension}`,
            fileType: type_,
            fileSize: file.size,
            url: file.path,
            extension: extension,
            uploadedBy: user._id,
            linkedTo: { model: "Pharmacies", objectId: pharmacy._id, },
            tags: [],
            isPrivate: type_ === 'logo',
            meta: {
                width: file.width ?? 200,
                height: file.height ?? 200,
                pages: file.page ?? 1
            }
        });

        await file_.save();

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

        res.json({ error: 0, success: true, user: user, data: pharmacy, message: `Document ${type_} pour la pharmacie ${pharmacy.name} uploadé avec succès sur le serveur` });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const pharmacieUpdate = async (req, res) => {
    try {
        let { 
            id, name, address, phoneNumber, email, licenseNumber, siret, 
            location, workingHours, suspensionDate, suspensionReason, comentaire, country, city, deliveryZone 
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
            deliveryZone: newDeliveryZone
        };

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
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        if (the_admin.error ) { return res.status(404).json({ message: 'User not found' }); }

        var user = the_admin.the_user;
        user.photoURL =  user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;

        const userInGroupAdmin = Array.isArray(user.groups) && user.groups.length > 0
            ? user.groups.some(g => ['superadmin', 'manager_admin', 'admin_technique'].includes(g.code))
            : false;

        let { id, prePage } = req.body;
        if ( (!id || (Array.isArray(id) && id.length === 0)) && !userInGroupAdmin ) {
            id = user.pharmaciesManaged?.map( pharm => pharm._id );
            if (!id) {  return res.status(400).json({ message: 'Missing required fields'}); }
        }

        let pharmacies = id ? await Pharmacy.find( {_id : Array.isArray(id) ? {$in : id} : id }) : false;
        if (!pharmacies && !userInGroupAdmin) { 
            return res.status(404).json({ success: false, message: 'Pharmacie non trouvée' });
        }

        const activities = pharmacies
            ? await Activity.find({ id_object: pharmacies.map(pharm => pharm._id) }).sort({ created_at: -1 }).limit(parseInt(prePage) || 10)
            : await Activity.find().sort({ created_at: -1 }).limit(parseInt(prePage) || 10);

        const mongoose = require('mongoose');
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

const loadAllActivitiesAndSendMailAdmins = async (updatedPharmacy, updates, user, extra = '') => {
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

        const { pharmacyId } = req.body;

        const pharmacy = pharmacyId ? await Pharmacy.findOne({_id: pharmacyId}) : false;

        if (!pharmacy) {
            res.status(200).json({ 'error':0, message:'La pharmacie n\'existe pas!' });
        }

        const messages = await MiniChatMessage.find({for: pharmacy._id}).populate('attachments');
        
        return res.status(200).json({'error':0, data:messages});
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { authentificateUser, setProfilInfo, loadGeneralsInfo, loadAllActivities, setSettingsFont, pharmacieList, pharmacieDetails, pharmacieNew, pharmacieEdit, pharmacieDelete, pharmacieApprove, pharmacieSuspend, pharmacieActive, pharmacieReject, pharmacieDocuments, pharmacieDocumentsDownload, pharmacieUpdate, pharmacieDocumentsUpload, pharmacieWorkingsHours, pharmacieActivities, loadHistoricMiniChat };

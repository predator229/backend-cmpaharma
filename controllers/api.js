const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse} = require('../tools/flutter_tools');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const User = require('../models/User');
const Uid = require('../models/Uid');
const Country = require('../models/Country');
const Mobil = require('../models/Mobil');

// const stripe = require('stripe')('your-stripe-secret-key');
// const axios = require('axios');

const authentificateUser = async (req, res) => {
    try {
        var the_user = await getTheCurrentUserOrFailed(req, res);
        if (!the_user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userResponse = await generateUserResponse(the_user);
        res.status(200).json({user: userResponse, message: the_user.new_user ? 'Bienvenu !' : 'Bon retour !' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getDefaultParams = async (req, res) => {
    try {
        var the_user = await getTheCurrentUserOrFailed(req, res);
        if (!the_user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userResponse = await generateUserResponse(the_user);

        res.status(200).json({ user: userResponse, message: the_user.new_user ? 'Bienvenu !' : 'Bon retour !' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const addMobil = async (req, res) => {
    try {
        const { uid, mobil } = req.body;
        var the_user = await getTheCurrentUserOrFailed(req, res);
        if (!the_user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (mobil){
            const mobil_ = new  Mobil();
            mobil_.digits = mobil.digits;
            mobil_.indicatif = mobil.indicatif;
            mobil_.title = mobil.title;
            await mobil_.save();

            the_user.mobils.push(mobil_._id);
            await the_user.save();

            the_user = await User.findOne({_id: the_user._id}) 
                .populate('phone')
                .populate('country')
//                .populate('selectedPayementMethod')
//                .populate('cards')
                .populate('mobils');
        }
        const userResponse = await generateUserResponse(the_user);

        res.status(200).json({ user: userResponse, message: 'User found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const addCard = async (req, res) => {
    try {
        const { uid, card } = req.body;

        var the_user = await getTheCurrentUserOrFailed(req, res);
        if (!the_user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (card){
            const card_ = new  Card();
            card_.digits = card.digits;
            card_.expiration = card.expiration;
            card_.title = card.title;
            card_.cvv = card.cvv;
            await card_.save();

            the_user.cards.push(card_._id);
            await the_user.save();

            the_user = await User.findOne({_id: the_user._id}) 
                .populate('phone')
                .populate('country')
//                .populate('selectedPayementMethod')
//                .populate('cards')
                .populate('mobils');
        }
        const userResponse = await generateUserResponse(the_user);

        res.status(200).json({ user: userResponse, message: 'User found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const removeMobil = async (req, res) => {
    try {
        const { uid, mobil } = req.body;

        var the_user = await getTheCurrentUserOrFailed(req, res);
        if (!the_user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (mobil){
            const mobil_ = await Mobil.findOne({ _id: mobil.id });
            if (mobil_){
                the_user.mobils = the_user.mobils.filter((k, v) => k != mobil.id);
//                if (the_user.selectedPayementMethod && the_user.selectedPayementMethod.mobil == mobil.id){
//                    var theSelectedPayementMethod = await SelectedPayement.findOne({ _id: the_user.selectedPayementMethod });
//                    await SelectedPayement.deleteOne(theSelectedPayementMethod);
//                    the_user.selectedPayementMethod = null;
//                }
                await the_user.save();
                await Mobil.deleteOne(mobil_);
            }

            the_user = await User.findOne({_id: the_user._id}) 
                .populate('country')
//                .populate('selectedPayementMethod')
                .populate('mobils')
                .populate('phone')
//                .populate('cards');
        }
        const userResponse = await generateUserResponse(the_user);

        res.status(200).json({ user: userResponse, message: 'User found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
//const removeCard = async (req, res) => {
//    try {
//        const { uid, card } = req.body;
//
//        var the_user = await getTheCurrentUserOrFailed(req, res);
//        if (!the_user) {
//            return res.status(404).json({ message: 'User not found' });
//        }
//
//        if (card){
//            const card_ = await Card.findOne({ _id: card.id });
////            if (card_){
////                the_user.cards = the_user.cards.filter((k, v) => k != card.id);
////                if (the_user.selectedPayementMethod && the_user.selectedPayementMethod.card == card.id){
////                    var theSelectedPayementMethod = await SelectedPayement.findOne({ _id: the_user.selectedPayementMethod });
////                    await SelectedPayement.deleteOne(theSelectedPayementMethod);
////                    the_user.selectedPayementMethod = null;
////                }
////
////                await the_user.save();
////                await Card.deleteOne(card_);
////            }
//
//            the_user = await User.findOne({_id: the_user._id})
//                .populate('phone')
//                .populate('country')
//                .populate('selectedPayementMethod')
//                .populate('mobils')
//                .populate('cards');
//        }
//        const userResponse = await generateUserResponse(the_user);
//
//        res.status(200).json({ user: userResponse, message: 'User found' });
//    } catch (error) {
//        res.status(500).json({ error: error.message });
//    }
//};
const refreshUser = async (req, res) => {
    const { authkey, uid } = req.body;
    
    if (authkey !== "awebifu abwiofebu 4gt1p9p891ht bw45iugt9w") {
        return res.status(403).json({ message: 'Not authorized!' });
    }
    
    try {
        var uidObj = await Uid.findOne({ uid: uid });

        var the_user = uidObj ? await User.findOne({ uids: uidObj }) 
            .populate('country')
            .populate('phone')
//            .populate('selectedPayementMethod')
//            .populate('cards')
            .populate('mobils') : false;

        var isNewUser = !the_user;

        var result = await getUserInfoByUUID(uid);

        if (result.status !== 200) {
            return res.status(404).json({ message: 'User not found' });
        }

        the_user = result.user.phoneNumber ? await User.findOne({ 
            $or: [
            // { phone: result.user.phoneNumber.trim() },
            { phone: result.user.phoneNumber.replace(/\s+/g, '').trim() }
            ]
        })
        .populate('country')
        .populate('phone')
//        .populate('selectedPayementMethod')
//        .populate('cards')
        .populate('mobils') : false;
        
        if (!the_user && result.user.email) {
            the_user = await User.findOne({ email: result.user.email })
                                                .populate('country')
                                                .populate('phone')
//                                                .populate('selectedPayementMethod')
//                                                .populate('cards')
                                                .populate('mobils')
        }

        if(the_user) { isNewUser = false;}

        if (isNewUser) { the_user = new User(); }
        const phoneNumber = result.user.phoneNumber ? parsePhoneNumberFromString(result.user.phoneNumber) : false;
    
        if (phoneNumber) {
            const country = await Country.findOne({ code: phoneNumber.country });
            if (country) {
                let mobil = new Mobil();
                mobil.indicatif = country.dial_code;
                mobil.digits = phoneNumber.nationalNumber;
                await mobil.save();

                the_user.country = country._id;
                the_user.phone = mobil._id;
                await the_user.save();
            }
        }

        if (!uidObj){
            uidObj = new Uid({ uid: uid });
            await uidObj.save();
        }
        the_user.uids = the_user.uids ? the_user.uids.concat(uidObj._id) : [uidObj._id];
        // res.json(result);

        ['email', 'name', 'photoURL', 'disabled'].forEach(element => {
            the_user[element] = result.user[element];
        });
        if (result.user.displayName) { 
            let name = result.user.displayName.split(' ');
            the_user.name = name[0] ?? '';
            the_user.surname = name.filter((k, v) => v != 0).toString() ?? '';
        }
//        the_user.role = 'user';
        the_user.coins = 0;
        // the_user.role = 'seller';
        // the_user.role = 'admin';

        if (!isNewUser) { the_user.updatedAt = Date.now(); }

        await the_user.save();

        res.status(200).json({ user: the_user, message: 'User refreshed with updated data!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
//const selectPaymentMethod = async (req, res) => {
//    try {
//        const { uid, selectedPayement } = req.body;
//
//        var the_user = await getTheCurrentUserOrFailed(req, res);
//        if (!the_user) {
//            return res.status(404).json({ message: 'User not found' });
//        }
//
//        if (selectedPayement){
//            const selectedPayement_ = new  SelectedPayement();
//            // selectedPayement_.mobil = selectedPayement.mobil;
//
//            if (selectedPayement.mobil && selectedPayement.mobil.id){
//                var mobil = await Mobil.findOne({ _id: selectedPayement.mobil.id });
//                if (mobil){
//                    selectedPayement_.mobil = mobil._id;
//                }
//            }else if (selectedPayement.card && selectedPayement.card.id){
//                var card = await Card.findOne({ _id: selectedPayement.card.id });
//                if (card){
//                    selectedPayement_.card = card._id;
//                }
//            }
//            if (selectedPayement_.mobil || selectedPayement_.card){
//                await selectedPayement_.save();
//
//                if (the_user.selectedPayementMethod){
//                    var oldOne = await SelectedPayement.findOne({ _id: the_user.selectedPayementMethod });
//                    if (oldOne){
//                        await SelectedPayement.deleteOne(oldOne);
//                    }
//                }
//                the_user.selectedPayementMethod = selectedPayement_._id;
//                await the_user.save();
//            }
//
//            the_user = await User.findOne({_id: the_user._id})
//                .populate('phone')
//                .populate('country')
//                .populate('selectedPayementMethod')
//                .populate('cards')
//                .populate('mobils');
//        }
//        const userResponse = await generateUserResponse(the_user);
//
//        res.status(200).json({ user: userResponse, message: 'User found' });
//    } catch (error) {
//        res.status(500).json({ error: error.message });
//    }
//};
//add coins function
//const addCoins = async (req, res) => {
//    try {
//        const { uid, coins } = req.body;
//
//        var the_user = await getTheCurrentUserOrFailed(req, res);
//        if (!the_user) {
//            return res.status(404).json({ message: 'User not found' });
//        }
//        if (!coins || coins <= 0){
//            const userResponse = await generateUserResponse(the_user);
//            return res.status(200).json({ message: 'Invalid coins', user: userResponse, error: 1 });
//        }
//
//        if (!the_user.selectedPayementMethod || (!the_user.selectedPayementMethod.mobil && !the_user.selectedPayementMethod.card)){
//        // if (true){
//            const userResponse = await generateUserResponse(the_user);
//            return res.status(200).json({ message: 'No payment method selected', user: userResponse, error: 1 });
//        }
//        var selectedPayement_ = await the_user.selectedPayementMethod.mobil ?  Mobil.findOne({ _id: the_user.selectedPayementMethod.mobil._id }) : Card.findOne({ _id: the_user.selectedPayementMethod.card._id });
//        if (!selectedPayement_){
//            const userResponse = await generateUserResponse(the_user);
//            return res.status(200).json({ message: 'No payment method selected. Contact the support', user: userResponse, error: 1 });
//        }
//
//        // Example payment process for card using Stripe
//
//        // if (selectedPayement_.card) {
//        //     try {
//        //         const paymentIntent = await stripe.paymentIntents.create({
//        //             amount: coins * 100, // amount in cents
//        //             currency: 'xof',
//        //             payment_method: selectedPayement_.card,
//        //             confirm: true,
//        //         });
//
//        //         if (paymentIntent.status !== 'succeeded') {
//        //             return res.status(200).json({ message: 'Payment failed', user: userResponse, error: 1 });
//        //         }
//        //     } catch (error) {
//        //         return res.status(200).json({ message: 'Payment failed', user: userResponse, error: 1 });
//        //     }
//        // } else if (selectedPayement_.mobile_money) {
//        //     try {
//        //         const paymentProvider = "CinetPay"; // Remplace par "PayDunya" ou "Flutterwave" selon l'API utilisée
//
//        //         const paymentData = {
//        //             apikey: process.env.CINETPAY_API_KEY, // Remplace par ta clé API
//        //             site_id: process.env.CINETPAY_SITE_ID, // ID de ton site sur CinetPay
//        //             transaction_id: `TXN_${Date.now()}`,
//        //             amount: coins * 100, // Montant en francs CFA
//        //             currency: "XOF",
//        //             description: "Achat de crédits",
//        //             customer_name: userResponse.name,
//        //             customer_email: userResponse.email,
//        //             customer_phone: selectedPayement_.mobile_money.phone,
//        //             payment_method: selectedPayement_.mobile_money.operator, // "mtn" ou "moov"
//        //             notify_url: "https://ton-site.com/webhook",
//        //             return_url: "https://ton-site.com/success",
//        //             cancel_url: "https://ton-site.com/cancel"
//        //         };
//
//        //         const response = await axios.post("https://api.cinetpay.com/v1/payment", paymentData, {
//        //             headers: { "Content-Type": "application/json" }
//        //         });
//
//        //         if (response.data.code !== "00") {
//        //             return res.status(200).json({ message: "Mobile Money payment failed", user: userResponse, error: 1 });
//        //         }
//
//        //         return res.status(200).json({ message: "Payment initiated", transaction_id: paymentData.transaction_id, user: userResponse, error: 0 });
//
//        //     } catch (error) {
//        //         return res.status(200).json({ message: "Mobile Money payment failed", user: userResponse, error: 1 });
//        //     }
//        // } else {
//        //     return res.status(400).json({ message: "Invalid payment method", error: 1 });
//        // }
//
//        the_user.coins =  parseFloat(the_user.coins ? the_user.coins : 0) + parseFloat(coins);
//        await the_user.save();
//
//        the_user = await User.findOne({_id: the_user._id})
//            .populate('country')
//            .populate('phone')
//            .populate('selectedPayementMethod')
//            .populate('cards')
//            .populate('mobils');
//
//        const userResponse = await generateUserResponse(the_user);
//
//        res.status(200).json({ user: userResponse, message: 'Vos coins ont été ajoutés', error: 0 });
//    } catch (error) {
//        res.status(500).json({ error: error.message });
//    }
//};
//edit profil
const editProfil = async (req, res) => {
    try {
        const { uid, name, surname, email, thephone, country } = req.body;

        var the_user = await getTheCurrentUserOrFailed(req, res);
        var theUserPhone = null;
        if (!the_user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (!thephone || !country || !name){
            const userResponse = await generateUserResponse(the_user);
            return res.status(200).json({ message: 'Certains parametres sont manquants !', user: userResponse, error: 1 });
        }

        thephone.replace(/\s+/g, '').trim();

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
            const userResponse = await generateUserResponse(the_user);
            return res.status(200).json({ message: 'Email invalide !', user: userResponse, error: 1 });
            }
        }

        var existUserWithEmailOrPhone = the_user.email === email ? null : await User.findOne({ email: email });
        if (existUserWithEmailOrPhone == null) {
            if (the_user.phone){
                theUserPhone = await Mobil.findOne({id: the_user.phone._id});
            }
            if (theUserPhone && theUserPhone.digits !== thephone && theUserPhone.indicatif !== country){
                const phones = await Mobil.find({ digits: thephone });
                for (const phone of phones) {
                    const userWithPhone = await User.findOne({ phone: phone._id });
                    if (userWithPhone && userWithPhone._id !== the_user._id) {
                        existUserWithEmailOrPhone = userWithPhone;
                        break;
                    }
                }    
            }
        }

        if (existUserWithEmailOrPhone != null  && existUserWithEmailOrPhone._id != the_user._id) {
            const userResponse = await generateUserResponse(the_user);
            return res.status(200).json({ message: `Un utilisateur avec ce numero de telephone ou l\'email existe deja ! ${existUserWithEmailOrPhone._id}`, error: 1, user: userResponse });
        }

        const countryObj = await Country.findOne({ dial_code: country });
        if (!countryObj) {
            const userResponse = await generateUserResponse(the_user);
            return res.status(200).json({ message: 'Le pays selectionne n\'existe pas !', user: userResponse, error: 1 });
        }

        let phone_ = the_user.phone != null ? await Mobil.findOne({_id: the_user.phone}) : new Mobil();
        if (!theUserPhone || (theUserPhone && theUserPhone.digits !== thephone && theUserPhone.indicatif !== country)){
            phone_.indicatif = countryObj.dial_code;
            phone_.digits = thephone;
            phone_.title = thephone;
            await phone_.save();

            the_user.country = countryObj._id;
        }

        the_user.name = name;
        the_user.phone = phone_._id;
        if (!the_user.email){the_user.email = email; }

        await the_user.save();

        the_user = await User.findOne({_id: the_user._id}) 
            .populate('country')
            .populate('phone')
            .populate('mobils');
                
        const userResponse = await generateUserResponse(the_user);

        res.status(200).json({ user: userResponse, message: 'Modifications effectuees avec success !', error: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

//const getPosts = async (req, res) => {
//    try {
//        const { refresh, without } = req.body;
//
//        var the_user = await getTheCurrentUserOrFailed(req, res);
//        var excludedIds = [];
//        if (!the_user) {
//            return res.status(404).json({ message: 'User not found' });
//        }
//
//        the_user = await User.findOne({_id: the_user._id})
//            .populate('country')
//            .populate('phone')
////            .populate('selectedPayementMethod')
////            .populate('cards')
//            .populate('mobils');
//
//        const userResponse = await generateUserResponse(the_user);
////        if (without && Array.isArray(without)) { excludedIds = without.map(id => id.toString()); }
////        let posts = await ApartmentCard.find({ _id: { $nin: excludedIds }})
////                                    .populate({
////                                        path: 'caracteristiques',
////                                        populate: [
////                                            {
////                                                path: 'rooms',
////                                                populate: [
////                                                    {
////                                                        path: 'type',
////                                                        select: '-__v' ,
////                                                    }
////                                                ],
////                                                select: '-__v'
////                                            },
////                                            { path: 'equipements', populate: [
////                                                {
////                                                    path: 'type',
////                                                    select: '-__v' ,
////                                                }
////                                            ],select: '-__v' },
////                                            { path: 'services', select: '-__v' }
////                                        ]
////                                    })
////                                    .populate({ path: 'typeApartment', select: '-__v' })
////                                    .limit(10);
//
//        // if (posts && posts.length > 0) {
//        //     for (let i = 0; i < posts.length; i++) {
//        //     const post = posts[i];
//        //     if (post.caracteristiques && post.caracteristiques._id) {
//        //         const carcts = await ApartmentCaracteristique.findById({ _id: post.caracteristiques._id })
//        //         .populate("rooms")
//        //         .populate("equipements")
//        //         .populate("services");
//        //         if (carcts) {
//        //         post.caracteristiques = carcts;
//        //         }
//        //     }
//        //     }
//        // }
//
////        const typesApartments = await TypeApartment.find({});
//        res.status(200).json({ typesApartments: [], user: userResponse, posts: [], message: '', error: 0 });
//
//    } catch (error) {
//        res.status(500).json({ error: error.message });
//    }
//};

//exports
module.exports = { authentificateUser, refreshUser, addMobil, addCard, removeMobil, editProfil, getDefaultParams };

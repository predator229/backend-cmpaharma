require('module-alias/register');
const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, getUserInfoByEmail, signUpUserWithEmailAndPassword} = require('@tools/flutter_tools');

const { parsePhoneNumberFromString } = require('libphonenumber-js');
const Uid = require('@models/Uid');
const Country = require('@models/Country');
const Mobil = require('@models/Mobil');
const Deliver = require('@models/Deliver');
const Admin = require('@models/Admin');
const SetupBase = require('../../models/SetupBase');
const Pharmacy = require('@models/Pharmacy');
const Activity = require('@models/Activity');
const { query } = require('express');

const checkPharmacyInfo = async (req, res) => {
    try {
        const { name, address, phone, email } = req.body;
        let query = {};
        if (email) {
            query = { email: email };
            var pharmaciesCount = await Pharmacy.countDocuments(query);
            if (pharmaciesCount) { return res.status(200).json({'error':0, exist: pharmaciesCount != 0, errorMessage:'L\'email est deja enregistrer aveec un autre partenaire' }); }
        }
        if (phone) { query.phaneNumber = phone; }
        if (name) { query.name = name; }
        if (address) { query.address = address; }
        var pharmaciesCount = await Pharmacy.countDocuments(query);
        return res.status(200).json({'error':0, exist: pharmaciesCount != 0, errorMessage: pharmaciesCount != 0 ? 'Un partenaire avec les informations entrees existe deja !' : '' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const checkPharmacyOwnerInfo = async (req, res) => {
    try {
        var { type_account, email} = req.body;
        
        if (!type_account || !email) {  return res.status(200).json({'error':0, continue: false, errorMessage: 'Veuillez remplir toutes les informations necessaires'}); }

        type_account = parseInt(type_account);

        var firebaseRezult = await getUserInfoByEmail(email, req.body.type);

        if (type_account == 1) {
            if (firebaseRezult.status !== 200 ) {
                return res.status(200).json({'error':0, continue: false, errorMessage:'L\'email du proprietaire du compte n\'est pas asscocier a un compte existant'});
            }

            var admin = await Admin.findOne({ email: email });
            if (admin && (admin.role == 'admin' || admin.role =='manager')) {
                return res.status(200).json({'error':0, continue: false, errorMessage:'Le compte indique ne peut pas etre utiliser pour etre associer a une nouvelle pharmacie !'});
            }
            if (!admin) {
                const result = firebaseRezult.user;
                let country = null;
                let thetelephone = null;
                let the_user = null;
            
                if (!the_user && result.email) {
                    the_user = await Admin.findOne({ email: result.email })
                                        .populate('country')
                                        .populate('phone')
                                        .populate('mobils')
                                        .populate('setups').populate('pharmaciesManaged');
        
                    if (thetelephone){ the_user.phone = thetelephone._id; }
                    else if (phoneNumber && country){
                        const userPhone = new Mobil({
                            digits: phoneNumber.nationalNumber,
                            indicatif: country.dial_code,
                            title: phoneNumber.nationalNumber,
                        });
                        await userPhone.save();
                        the_user.phone = userPhone._id;
                    }
                }
                uidObj = new Uid({ uid: result.uid });
                await uidObj.save();
        
                    const setups_base = new SetupBase({
                        font_family: 'Poppins',
                        font_size: 14,
                        theme: 'light',
                        isCollapse_menu: true,
                    });
                    await setups_base.save();
                    setups_base.id = setups_base._id;
                    await setups_base.save();
    
                    the_user = new Admin({
                        uids: [uidObj._id],
                        email: result.email ?? email,
                        name: result.displayName?.split(' ')[0] ?? '',
                        surname: result.displayName?.split(' ').slice(1).join(' ') ?? '',
                        address: '',
                        country: infos.country?._id ?? (country ? country._id : null),
                        photoURL: result.photoURL,
                        disabled: result.disabled,
                        role: 'pharmacist-owner',
                        permissions : ['read', 'write'] ,
                        isActivated: true,
                        lastLogin: Date(),
                        setups: setups_base._id,
                        pharmaciesManaged: [],
                        coins: 0,
                    });
                    
                    // if (thetelephone){ the_user.phone = thetelephone._id; }
                    // else if (phoneNumber && country){
                    //     const userPhone = new Mobil({
                    //         digits: phoneNumber.nationalNumber,
                    //         indicatif: country.dial_code,
                    //         title: phoneNumber.nationalNumber,
                    //     });
                    //     type == 'deliver' ? await User.save(the_user) : await Admin.save(the_user);
                    //     the_user.phone = userPhone._id;
                    // }
                    imnewuser = 1;
                    await the_user.save();
                // } else {
                //     if ( uidObj && !the_user.uids.includes(uidObj._id)) {
                //         the_user.uids.push(uidObj._id);
                //         await the_user.save();
                //     }
                // }
             }
             return res.json({ error: 0, continue: true, message: 'User created successfully', uid: uidObj.uid });
        }
        if (type_account == 2){
            if (firebaseRezult.status === 200 ) {
                return res.status(200).json({'error':0, exist: false, errorMessage:'L\'email est deja utilise par un autre compte'});
            }
            var admin = await Admin.findOne({ email: email });
            if (admin) {
                return res.status(200).json({'error':0, exist: false, errorMessage:'Le compte indique ne peut pas etre utiliser pour etre associer a une nouvelle pharmacie !'});
            }
            return res.json({ error: 0, continue: true, message: 'User created successfully' });
        }
        return res.json({ error: 0, continue: false, errorMessage: 'Erreur de com avec le server' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
const newPharmacie = async (req, res) => {
    try {
        const { pharmacy_name, pharmacy_address, pharmacy_phone, pharmacy_email, owner_full_name,owner_email, owner_phone, function_phone, uid  } = req.body;
        
        if ( !pharmacy_name || !pharmacy_address || !pharmacy_phone || !pharmacy_email || !owner_full_name ||!owner_email || !owner_phone || !function_phone || !uid)   {  return res.status(200).json({'error':0, continue: false, errorMessage: 'Veuillez remplir toutes les informations necessaires'}); }

        type_account = parseInt(type_account);

        var firebaseRezult = await getUserInfoByUUID(uid, req.body.type);

        if (firebaseRezult.status !== 200 ) {
            return res.status(200).json({'error':0, continue: false, errorMessage:'L\'email n\'est pas asscocier a un compte partenair'});
        }

        var the_user = await the_user.findOne({ email: email });
        if (the_user && (the_user.role == 'admin' || admin.role =='manager')) {
            return res.status(200).json({'error':0, continue: false, errorMessage:'Le compte indique ne peut pas etre utiliser pour etre associer a une nouvelle pharmacie !'});
        }

        if (!the_user) {
            const result = firebaseRezult.user;
            let country = null;
            let thetelephone = null;
            let the_user = null;
        
            if (!the_user && result.email) {
                the_user = await Admin.findOne({ email: result.email })
                                    .populate('country')
                                    .populate('phone')
                                    .populate('mobils')
                                    .populate('setups').populate('pharmaciesManaged');
    
                if (thetelephone){ the_user.phone = thetelephone._id; }
                else if (phoneNumber && country){
                    const userPhone = new Mobil({
                        digits: phoneNumber.nationalNumber,
                        indicatif: country.dial_code,
                        title: phoneNumber.nationalNumber,
                    });
                    await userPhone.save();
                    the_user.phone = userPhone._id;
                }
            }
            uidObj = new Uid({ uid: result.uid });
            await uidObj.save();
    
            const setups_base = new SetupBase({
                font_family: 'Poppins',
                font_size: 14,
                theme: 'light',
                isCollapse_menu: true,
            });
            await setups_base.save();
            setups_base.id = setups_base._id;
            await setups_base.save();

            the_user = new Admin({
                uids: [uidObj._id],
                email: result.email ?? email,
                name:  owner_full_name.displayName?.split(' ')[0] ?? (result.displayName?.split(' ')[0] ?? ''),
                surname: owner_full_name.displayName?.split(' ').slice(1).join(' ')  ?? (result.displayName?.split(' ').slice(1).join(' ') ?? ''),
                address: '',
                country: infos.country?._id ?? (country ? country._id : null),
                photoURL: result.photoURL,
                disabled: result.disabled,
                role: 'pharmacist-owner',
                permissions : ['read', 'write'] ,
                isActivated: true,
                lastLogin: Date(),
                setups: setups_base._id,
                pharmaciesManaged: [],
                coins: 0,
            });
                    
            imnewuser = 1;
            await the_user.save();
        }

        query = { email: pharmacy_email };
        var pharmaciesCount = await Pharmacy.countDocuments(query);
        if (pharmaciesCount) { return res.status(200).json({'error':0, exist: pharmaciesCount != 0, errorMessage:'L\'email est deja enregistrer aveec un autre partenaire' }); }

        if (pharmacy_name) { query.name = pharmacy_name; }
        if (pharmacy_address) { query.address = pharmacy_address; }
        if (pharmacy_phone) { query.phoneNumber = pharmacy_phone; }

        var pharmaciesCount = await Pharmacy.countDocuments(query);
        if (pharmaciesCount) { return res.status(200).json({'error':0, exist: pharmaciesCount != 0, errorMessage:'Les informatioons entrees existent deja enregistrer avec un autre partenaire'}); }

        var pharmacie = new Pharmacy();
        pharmacie.name = pharmacy_name;
        pharmacie.address = pharmacy_address;
        pharmacie.phoneNumber = pharmacy_phone;
        pharmacie.email = pharmacy_email;
        pharmacie.phoneNumber = pharmacy_phone;
       
        await pharmacie.save();
            
        return res.json({ error: 0, message:'Les details de la pharmacie ont ete enregistres avec success! Vous pouvez egalememnt vous connecter en utilisant les informations de connection que vous avez entrer!' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { checkPharmacyInfo, checkPharmacyOwnerInfo, newPharmacie };

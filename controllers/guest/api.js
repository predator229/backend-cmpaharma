require('module-alias/register');
const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, getUserInfoByEmail, signUpUserWithEmailAndPassword,createUserAndSendEmailLink,deleteUserByEmail} = require('@tools/flutter_tools');

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
        let {
            type_account,
            pharmacy_name,
            pharmacy_address,
            pharmacy_phone,
            pharmacy_email,
            owner_full_name,
            owner_email,
            owner_phone
        } = req.body;

        if (!pharmacy_name || !pharmacy_address || !pharmacy_phone || !pharmacy_email || !owner_email) {
            return res.status(200).json({ error: 0, continue: false, errorMessage: 'Veuillez remplir toutes les informations nécessaires.' });
        }

        type_account = parseInt(type_account);

        let firebaseRezult = await getUserInfoByEmail(owner_email, req.body.type);
        let the_user = null;

        // Vérifie si l’email de la pharmacie existe déjà
        let query = { email: pharmacy_email };
        let pharmaciesCount = await Pharmacy.countDocuments(query);
        if (pharmaciesCount) {
            return res.status(200).json({
                error: 0,
                continue: false,
                exist: true,
                errorMessage: 'L\'email est déjà enregistré avec un autre partenaire.'
            });
        }

        // Vérifie si d'autres infos similaires existent déjà
        if (pharmacy_name) query.name = pharmacy_name;
        if (pharmacy_address) query.address = pharmacy_address;
        if (pharmacy_phone) query.phoneNumber = pharmacy_phone;

        pharmaciesCount = await Pharmacy.countDocuments(query);
        if (pharmaciesCount) {
            return res.status(200).json({
                error: 0,
                exist: true,
                continue: false,
                errorMessage: 'Les informations entrées sont déjà associées à une autre pharmacie.'
            });
        }

        // Création de la pharmacie
        const pharmacie = new Pharmacy({
            name: pharmacy_name,
            address: pharmacy_address,
            phoneNumber: pharmacy_phone,
            email: pharmacy_email
        });

        // Cas 1 : le propriétaire a déjà un compte
        if (type_account === 1) {
            if (firebaseRezult.status !== 200) {
                return res.status(200).json({
                    error: 0,
                    continue: false,
                    errorMessage: 'L\'email du propriétaire du compte n\'est pas associé à un compte existant.'
                });
            }

            the_user = await Admin.findOne({ email: owner_email });
            if (the_user && (the_user.role === 'admin' || the_user.role === 'manager')) {
                return res.status(200).json({
                    error: 0,
                    continue: false,
                    errorMessage: 'Ce compte ne peut pas être associé à une nouvelle pharmacie.'
                });
            }
        }

        // Cas 2 : créer un nouveau compte pour le propriétaire
        if (type_account === 2) {
            if (firebaseRezult.status === 200) {
                return res.status(200).json({
                    error: 0,
                    exist: false,
                    errorMessage: 'L\'email est déjà utilisé par un autre compte.'
                });
            }

            the_user = await Admin.findOne({ email: owner_email });
            if (the_user) {
                return res.status(200).json({
                    error: 0,
                    exist: false,
                    errorMessage: 'Ce compte ne peut pas être associé à une nouvelle pharmacie.'
                });
            }

            const resultCreatedUser = await createUserAndSendEmailLink(owner_email, req.body.type, 'http://localhost:4200/login');
            // if (resultCreatedUser.status !== 200) {
            //     return res.status(200).json({
            //         error: 0,
            //         exist: false,
            //         continue: false,
            //         errorMessage: 'Erreur lors de la création du compte after flutter .'
            //     });
            // }

            firebaseRezult = await getUserInfoByEmail(owner_email, req.body.type,);
            if (firebaseRezult.status !== 200) {
                return res.status(200).json({
                    error: 0,
                    exist: false,
                    continue: false,
                    errorMessage: 'Erreur lors de la création du compte after after flutter.'
                });
            }

            const result = firebaseRezult.user;
            let country = null;

            const phoneNumber = owner_phone ? parsePhoneNumberFromString(owner_phone) : null;
            if (phoneNumber) {
                country = await Country.findOne({ code: phoneNumber.country });
            }

            if (country) {
                const userPhone = new Mobil({
                    digits: phoneNumber.nationalNumber,
                    indicatif: country.dial_code,
                    title: phoneNumber.nationalNumber
                });
                await userPhone.save();
                the_user = { phone: userPhone._id };
            } else {
                the_user = {};
            }

            const uidObj = new Uid({ uid: result.uid });
            await uidObj.save();

            const setups_base = new SetupBase({
                font_family: 'Poppins',
                font_size: 14,
                theme: 'light',
                isCollapse_menu: true
            });
            await setups_base.save();

            the_user = new Admin({
                uids: [uidObj._id],
                email: result.email ?? owner_email,
                name: owner_full_name?.split(' ')[0] ?? result.displayName?.split(' ')[0] ?? '',
                surname: owner_full_name?.split(' ').slice(1).join(' ') ?? result.displayName?.split(' ').slice(1).join(' ') ?? '',
                address: '',
                phone: the_user.phone ?? null,
                country: country ?? null,
                photoURL: result.photoURL,
                disabled: false,
                role: 'pharmacist-owner',
                permissions: ['read', 'write'],
                isActivated: true,
                lastLogin: new Date(),
                setups: setups_base._id,
                pharmaciesManaged: [],
                coins: 0
            });

            await the_user.save();
        }

        if (the_user) {
            await pharmacie.save();
            the_user.pharmaciesManaged.push(pharmacie._id);
            await the_user.save();
            return res.json({ error: 0, continue: true, message: 'Pharmacie et propriétaire validés avec succès.' });
        }else{
            return res.status(200).json({
                error: 0,
                continue: false,
                errorMessage: 'Tout est ok mais le compte ne s\'est pas creer normalement!'
            });
        }

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

module.exports = { checkPharmacyInfo, checkPharmacyOwnerInfo };

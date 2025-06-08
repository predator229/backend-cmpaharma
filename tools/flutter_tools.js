require('dotenv').config();
const nodemailer = require('nodemailer');
const { getFirebaseApp } = require('@config/firebase');

const Uid = require('@models/Uid');
const Country = require('@models/Country');
const Mobil = require('@models/Mobil');
const Group = require('@models/Group');

const { parsePhoneNumberFromString } = require('libphonenumber-js');
const Deliver = require('@models/Deliver');
const Admin = require('@models/Admin');
const SetupBase = require('@models/SetupBase');
const Order = require('@models/Order');
const Activity = require('@models/Activity');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', 
    port: 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER, 
        pass: process.env.MAIL_PASS,
    },
});
const getUserInfoByEmail = async (email, type) => {
    const firebaseApp = getFirebaseApp(type);

    if (!firebaseApp) {
        throw new Error(`Firebase app not initialized for type: ${type}`);
    }

    try {
        const userRecord = await firebaseApp.auth().getUserByEmail(email);
        return {
            status: 200,
            user: userRecord,
        };
    } catch (error) { return { status: 404, message: 'User not found in Firebase', error: error.message };
    }
};
const deleteUserByEmail = async (emailOrUid, type, iamEmail) => {
    const firebaseApp = getFirebaseApp(type);
    if (!firebaseApp) { throw new Error(`Firebase app not initialized for type: ${type}`);}
    try {
        const userRecord = await iamEmail ? firebaseApp.auth().getUserByEmail(emailOrUid) : firebaseApp.auth().deleteUser(emailOrUid);
        await firebaseApp.auth().deleteUser(userRecord.uid);
        return { status: 200, message: `User with email ${email} successfully deleted.`, };
    } catch (error) {
        return { status: 404, message: 'Error deleting user from Firebase', error: error.message};
    }
};
const createUserAndSendEmailLink = async (email, type, actionUrl) => {
    const firebaseApp = getFirebaseApp(type);
    if (!firebaseApp) { throw new Error(`Firebase app not initialized for type: ${type}`);}
    try {
        const userRecord = await firebaseApp.auth().createUser({ email, emailVerified: false });
        const link = await firebaseApp.auth().generatePasswordResetLink(email, {
            url: actionUrl,
            handleCodeInApp: true,
        });

        await transporter.sendMail({
            from: `"Support CTMPHARMA" <${process.env.MAIL_USER}>`,
            to: email,
            subject: 'Activez votre compte CTMPHARMA',
            html: `
                <p>Bonjour,</p>
                <p>Un compte vient d’être créé pour vous sur <b>CTMPHARMA</b>.</p>
                <p>Veuillez cliquer sur le bouton ci-dessous pour définir votre mot de passe :</p>
                <p><a href="${link}" style="background-color:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Créer mon mot de passe</a></p>
                <p>Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.</p>
                <p>L’équipe CTMPHARMA</p>
            `,
        });
        return {status: 200, message: `User created and email sent to ${email}`, resetLink: link};
    } catch (error) {
        return { status: 400, message: 'Error creating user or sending email', error: error.message, actionUrl: actionUrl };
    }
};

const signUpUserWithEmailAndPassword = async (email, password, type) => {
  const firebaseApp = getFirebaseApp(type);

  if (!firebaseApp) {
    throw new Error(`Firebase app not initialized for type: ${type}`);
  }

  try {
    const userRecord = await firebaseApp.auth().createUser({
      email,
      password,
      emailVerified: false,
      disabled: false,
    });

    return {
      status: 201, message: 'User successfully created',
      user: {
        uid: userRecord.uid,
        email: userRecord.email
      }
    };
  } catch (error) {
    return { status: 400, message: 'Error creating user', error: error.message };
  }
};

const getUserInfoByUUID = async (uuid, type) => {
    const firebaseApp = getFirebaseApp(type);

    if (!firebaseApp) {
        throw new Error(`Firebase app not initialized for type: ${type}`);
    }

    try {
        const userRecord = await firebaseApp.auth().getUser(uuid);
        return { status: 200, user: userRecord };
    } catch (error) {
        return { status: 404, message: 'User not found firebase probleme', error: error.message };
    }
};

const getTheCurrentUserOrFailed = async (req, res) => {
    const { uid, infos = {}, type = "deliver" } = req.body;
    let uidObj = await Uid.findOne({ uid: uid });

    let the_user = uidObj != null  ? (type == 'deliver' ? await Deliver.findOne({ uids: uidObj._id, disabled: false }) 
        .populate('country')
        .populate('phone')
        .populate('mobils') : 
        await Admin.findOne({ uids: uidObj._id }) 
        .populate([
            { path: 'country' },
            { path: 'pharmaciesManaged' },
            { path: 'phone' },
            { path: 'mobils' },
            { path: 'setups' },
            { path: 'groups', populate: [
                { path: 'permissions' }
            ]}
        ])
     ): false;

    if (the_user.groups && the_user.groups.map(p => registerActivity.code).includes('pharmacist-owner') && the_user.pharmaciesManaged && the_user.pharmaciesManaged.length > 0) {
       if (typeof the_user.pharmaciesManaged[0] === 'object' && the_user.pharmaciesManaged[0].workingHours !== undefined) {
            the_user.pharmaciesManaged = the_user.pharmaciesManaged.map(async function (pharmacy) { 
                pharmacy.orders = await Order.find({ pharmacy_id: pharmacy._id, status: 'pending' })
                                            .populate('deliver_id')
                                            .populate('customer_id')
                                            .populate('products');
                pharmacy.orders30days = await Order.find({ pharmacy_id: pharmacy._id, createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
                                            .populate('deliver_id')
                                            .populate('customer_id')
                                            .populate('products');
                pharmacy.revenue30days  = pharmacy.orders30days.reduce((total, order) => total + order.totalAmount, 0);
                return pharmacy;
            });
       }
    }

     //to use after to save new user
    if (!the_user && false) { //process.env.NODE_ENV == 'development') 
        const result = await getUserInfoByUUID(uid, type);
        if (result.status !== 200) {
            return {error:1};
        }

        let country = null;
        let thetelephone = null;
        const phoneNumber = result.user.phoneNumber ? parsePhoneNumberFromString(result.user.phoneNumber) : false;

        if (phoneNumber){
            country = await Country.findOne({ code: phoneNumber.country });
            if (country){
                const phones = await Mobil.find({ digits: phoneNumber.nationalNumber, indicatif: country.dial_code });
                if (phones) {
                    for (const phone of phones) {
                        const userWithPhone = type == 'deliver' ?  await Deliver.findOne({ phone: phone._id })
                            .populate('country').populate('phone').populate('mobils') :  await Admin.findOne({ phone: phone._id })
                            populate([
                            { path: 'country' },
                            { path: 'pharmaciesManaged' },
                            { path: 'phone' },
                            { path: 'mobils' },
                            { path: 'setups' },
                            { path: 'groups', populate: [
                                { path: 'permissions' }
                            ]}
                        ])
                            ;
                        if (userWithPhone) {
                            the_user = userWithPhone;
                            thetelephone = phone;
                            break;
                        }
                    }    
                }
            }
        }

        if (!the_user && result.user.email) {
            the_user = type == 'deliver' ? await Deliver.findOne({ email: result.user.email })
                                .populate('country')
                                .populate('phone')
                                .populate('mobils') : 
                                await Admin.findOne({ email: result.user.email })
                                .populate([
                                    { path: 'country' },
                                    { path: 'pharmaciesManaged' },
                                    { path: 'phone' },
                                    { path: 'mobils' },
                                    { path: 'setups' },
                                    { path: 'groups', populate: [
                                        { path: 'permissions' }
                                    ]}
                                ]);

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

        if (!uidObj){
            uidObj = new Uid({ uid: uid });
            await uidObj.save();
        }

        if (!the_user) {
            if (type != 'deliver'){
                const setups_base = new SetupBase({
                    font_family: 'Poppins',
                    font_size: 14,
                    theme: 'light',
                    isCollapse_menu: true,
                });
                await setups_base.save();
                setups_base.id = setups_base._id;
                await setups_base.save();

                var groups = await Group.find({code:'superadmin', plateform: "Admin" });
                the_user = new Admin({
                    uids: [uidObj._id],
                    email: result.user.email ?? infos.email,
                    name: infos.name ?? (result.user.displayName?.split(' ')[0] ?? ''),
                    surname: infos.surname ?? (result.user.displayName?.split(' ').slice(1).join(' ') ?? ''),
                    address: infos.address,
                    country: infos.country?._id ?? (country ? country._id : null),
                    photoURL: result.user.photoURL,
                    disabled: result.user.disabled,
                    groups: groups.map(group => group._id),
                    isActivated: true,
                    lastLogin: Date(),
                    setups: setups_base._id,
                    pharmaciesManaged: [],
                    coins: 0,
                });
            }else{
                the_user = new Deliver({
                    uids: [uidObj._id],
                    email: result.user.email ?? infos.email,
                    name: infos.name ?? (result.user.displayName?.split(' ')[0] ?? ''),
                    surname: infos.surname ?? (result.user.displayName?.split(' ').slice(1).join(' ') ?? ''),
                    address: infos.address,
                    country: infos.country?._id ?? (country ? country._id : null),
                    photoURL: result.user.photoURL,
                    disabled: result.user.disabled,
                    coins: 0,
                    vehicleType: infos.vehicleType,
                    marqueVehicule: infos.marqueVehicule,
                    modelVehicule: infos.modelVehicule,
                    anneeVehicule: infos.anneeVehicule,
                    nrEssieux: infos.nrEssieux,
                    capaciteCharge: infos.capaciteCharge,
                    nrImmatriculation: infos.nrImmatriculation,
                    nrAssurance: infos.nrAssurance,
                    nrChassis: infos.nrChassis,
                    nrPermis: infos.nrPermis,
                    nrVisiteTechnique: infos.nrVisiteTechnique,
                    nrCarteGrise: infos.nrCarteGrise,
                    nrContrat: infos.nrContrat,
                });
            }
            

            if (thetelephone){ the_user.phone = thetelephone._id; }
            else if (phoneNumber && country){
                const userPhone = new Mobil({
                    digits: phoneNumber.nationalNumber,
                    indicatif: country.dial_code,
                    title: phoneNumber.nationalNumber,
                });
                type == 'deliver' ? await User.save(the_user) : await Admin.save(the_user);
                the_user.phone = userPhone._id;
            }
            imnewuser = 1;
            await the_user.save();
            if (type != 'deliver') {
            await the_user.populate([
                    { path: 'country' },
                    { path: 'phone' },
                    { path: 'mobils' },
                    { path: 'setups' },
                    { path: 'groups', populate: [
                        { path: 'permissions',  }
                    ] }
                ]);
            }
            await registerActivity( type == 'deliver' ? "Deliver" : (the_user.role == 'pharmacist-owner' ? 'Pharmacist Owner' : 'Administrateur'), the_user._id, "New user registed", "");
        } else {
            if ( uidObj && !the_user.uids.includes(uidObj._id)) {
                the_user.uids.push(uidObj._id);
                await the_user.save();
            }
        }
        if (type =='deliver' && the_user && infos) {
            const updatableFields = [
                'address', 'vehicleType', 'marqueVehicule', 'modelVehicule', 'anneeVehicule', 'nrEssieux',
                'capaciteCharge', 'nrImmatriculation', 'nrAssurance', 'nrChassis', 'nrPermis',
                'nrVisiteTechnique', 'nrCarteGrise', 'nrContrat'
            ];
            for (const field of updatableFields) {
                if (infos[field]) the_user[field] = infos[field];
            }    
            await the_user.save();
        }
    }
    return {error : the_user ? 0 : 1, the_user:the_user, status:200};
};
const registerActivity = async (type, id, title, description) => {
    const activity = new Activity({
        type: type,
        id_object: id,
        title: title,
        description: description,
    });
    await activity.save();
    return activity;
}
const generateUserResponse = async (user) => {
    user.fullName = [user.name ?? '', user.surname ?? ''].filter(Boolean).join(' ');
    user.defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'User')}&background=random&size=500`;

    return {
      _id: user._id,
      email: user.email ?? '',
      country: user.country && user.country.code ? {
        code: user.country.code,
        name: user.country.name
      } : null,
      phone: user.phone ?? null,
      name: user.name ?? '',
      surname: user.surname ?? '',
      imgPath: user.photoURL || user.defaultAvatar,
      coins: user.coins ?? 0,
      mobils: user.mobils ?? [],
      new_user: user.new_user ?? 0,
  
      vehicleType: user.vehicleType ?? null,
      marqueVehicule: user.marqueVehicule ?? null,
      modelVehicule: user.modelVehicule ?? null,
      anneeVehicule: user.anneeVehicule ?? null,
      nrImmatriculation: user.nrImmatriculation ?? null,
      nrPermis: user.nrPermis ?? null,
      nrAssurance: user.nrAssurance ?? null,
    };
  };
  
module.exports = { getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, getUserInfoByEmail, signUpUserWithEmailAndPassword, createUserAndSendEmailLink,deleteUserByEmail, registerActivity };

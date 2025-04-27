const { getFirebaseApp } = require('@config/firebase');

const Uid = require('@models/Uid');
const Country = require('@models/Country');
const Mobil = require('@models/Mobil');

const { parsePhoneNumberFromString } = require('libphonenumber-js');
const Deliver = require('@models/Deliver');
const Admin = require('@models/Admin');

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

    let the_user = uidObj != null  ? (type == 'deliver' ? await Deliver.findOne({ uids: uidObj._id }) 
        .populate('country')
        .populate('phone')
        .populate('mobils') : 
        await Admin.findOne({ uids: uidObj._id }) 
        .populate('country')
        .populate('phone')
        .populate('mobils')
     ): false;

    if (!the_user) {
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
                            .populate('country').populate('phone').populate('mobils');
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
                                .populate('country')
                                .populate('phone')
                                .populate('mobils');

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

        let imnewuser = 0;
        if (!the_user) {
            the_user = type == 'deliver' ? new Deliver({
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
            }) : new Admin({
                uids: [uidObj._id],
                email: result.user.email ?? infos.email,
                name: infos.name ?? (result.user.displayName?.split(' ')[0] ?? ''),
                surname: infos.surname ?? (result.user.displayName?.split(' ').slice(1).join(' ') ?? ''),
                address: infos.address,
                country: infos.country?._id ?? (country ? country._id : null),
                photoURL: result.user.photoURL,
                disabled: result.user.disabled,
                role: 'manager',
                permissions : ['read'] ,
                isActivated: false,
                lastLogin: Date(),
            });

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
        } else {
            // return {user : the_user};
            if (!the_user.uids.includes(uidObj._id)) {
                the_user.uids.push(uidObj._id);
            }
            const updatableFields = [
                'address', 'vehicleType', 'marqueVehicule', 'modelVehicule', 'anneeVehicule', 'nrEssieux',
                'capaciteCharge', 'nrImmatriculation', 'nrAssurance', 'nrChassis', 'nrPermis',
                'nrVisiteTechnique', 'nrCarteGrise', 'nrContrat'
            ];
            if (type =='deliver'){
                for (const field of updatableFields) {
                    if (infos[field]) the_user[field] = infos[field];
                }    
            }
        }

        await the_user.save();

        the_user = type == 'deliver' 
        ?  await Deliver.findOne({ uids: uidObj }) 
            .populate('country')
            .populate('uids')
            .populate('phone')
            .populate('mobils') 
        :  await Admin.findOne({ uids: uidObj }) 
            .populate('country')
            .populate('uids')
            .populate('phone')
            .populate('mobils') 
            ;

        the_user.new_user = imnewuser;
    }

    return {error : 0, the_user:the_user, status:200};
};
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
  
module.exports = { getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse};

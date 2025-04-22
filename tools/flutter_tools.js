const admin = require('../config/firebase');

const User = require('../models/User');
const Uid = require('../models/Uid');
const Country = require('../models/Country');
const Mobil = require('../models/Mobil');
//const Card = require('../models/Card');

const { parsePhoneNumberFromString } = require('libphonenumber-js');

const getUserInfoByUUID = async (uuid) => {
    try {
        const userRecord = await admin.auth().getUser(uuid);
        return { status: 200, user: userRecord };
    } catch (error) {
        return { status: 404, message: 'User not found', error: error.message };
    }
};

const getTheCurrentUserOrFailed = async (req, res) => {
    const { uid } = req.body;
    var uidObj = await Uid.findOne({ uid: uid });

    let the_user = uidObj != null  ? await User.findOne({ uids: uidObj._id }) 
        .populate('country')
        .populate('phone')
//        .populate('selectedPayementMethod')
//        .populate('cards')
        .populate('mobils') : false;

    if (!the_user) {
        const result = await getUserInfoByUUID(uid);
        if (result.status !== 200) {
            return res.status(404).json({ message: 'User not found' });
        }
        var country = null;
        var thetelephone = null;
        const phoneNumber = result.user.phoneNumber ? parsePhoneNumberFromString(result.user.phoneNumber) : false;

        if (phoneNumber){
            country = await Country.findOne({ code: phoneNumber.country });
            if (country){
                const phones = await Mobil.find({ digits: phoneNumber.nationalNumber, indicatif: country.dial_code  });
                if (phones) {
                    for (const phone of phones) {
                        const userWithPhone = await User.findOne({ phone: phone._id }).populate('country')
                        .populate('phone')
//                        .populate('selectedPayementMethod')
//                        .populate('cards')
                        .populate('mobils');
                        if (userWithPhone) {
                            the_user = userWithPhone;
                            thetelephone = phone;
                            break;
                        }
                    }    
                }
            }

            // if (country) {
            //     the_user.country = country._id;
            //     the_user.phone = phoneNumber.nationalNumber;
            // }
        }

        if (!the_user && result.user.email) {
            the_user = await User.findOne({ email: result.user.email })
                                .populate('country')
                                .populate('phone')
//                                .populate('selectedPayementMethod')
//                                .populate('cards')
                                .populate('mobils');

            if (thetelephone){ the_user.phone = thetelephone._id; }
            else if (phoneNumber && country){
                var userPhone = new Mobil();
                userPhone.digits =phoneNumber.nationalNumber;
                userPhone.indicatif =country.dial_code;
                userPhone.title =phoneNumber.nationalNumber;
                await userPhone.save();
                the_user.phone = userPhone._id;
            }
        }

        if (!uidObj){
            uidObj = new Uid({ uid: uid });
            await uidObj.save();
        }
        var imnewuser = 0;
        if (!the_user) {
            the_user = new User();
            the_user.uids = [uidObj._id];
            the_user.email = result.user.email;
            if (result.user.displayName) { 
                let name = result.user.displayName.split(' ');
                the_user.name = name[0] ?? '';
                the_user.surname = name.filter((k, v) => v != 0).toString() ?? '';
            }
            if (thetelephone){ the_user.phone = thetelephone._id; }
            else if (phoneNumber && country){
                var userPhone = new Mobil();
                userPhone.digits =phoneNumber.nationalNumber;
                userPhone.indicatif =country.dial_code;
                userPhone.title =phoneNumber.nationalNumber;
                await userPhone.save();
                the_user.phone = userPhone._id;
            }
            the_user.country = country ? country._id : null;
            the_user.photoURL = result.user.photoURL;
            the_user.disabled = result.user.disabled;
            the_user.coins = 1000;
            imnewuser = 1;
        }
        else{
            the_user.uids.push(uidObj._id);
        }
        await the_user.save();

        the_user = await User.findOne({ uids: uidObj }) 
            .populate('country')
            .populate('uids')
            .populate('phone')
//            .populate('selectedPayementMethod')
//            .populate('cards')
            .populate('mobils');
            the_user.new_user =  imnewuser;
    }

    return the_user;
}
const generateUserResponse = async (user) => {
//    if (user.selectedPayementMethod) {
//        const result = await SelectedPayement.findOne({ _id: user.selectedPayementMethod._id })
//            .populate('mobil')
//            .populate('card');
//
//        if (result.mobil == null) { delete result.mobil; }
//        if (result.card == null) { delete result.card; }
//
//        user.selectedPayementMethod = result;
//    }

    return {
        _id: user._id,
        email: user.email ?? '',
        country: user.country ? user.country : null,
        phone: user.phone ?? null,
        name: user.name ?? '',
        surname: user.surname ?? '',
        imgPath: user.photoURL ?? (user.name ? `https://ui-avatars.com/api/?name=${user.name}+${user.surname}&background=random` : 'https://ui-avatars.com/api/?size=500&background=random'),
        coins: user.coins ?? 0,
//        cards: user.cards,
        mobils: user.mobils,
        // new_user : 1,
        new_user : user.new_user ?? 0,
    };
}

module.exports = { getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse};

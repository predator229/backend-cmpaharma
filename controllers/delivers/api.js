require('module-alias/register');
const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse} = require('@tools/flutter_tools');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const Deliver = require('@models/Deliver');
const Uid = require('@models/Uid');
const Country = require('@models/Country');
const Mobil = require('@models/Mobil');

const authentificateUser = async (req, res) => {
    try {
        var the_deliver = await getTheCurrentUserOrFailed(req, res);
        if (the_deliver.error ) {
            return res.status(404).json({ message: 'Deliver1 not found', result: the_deliver });
        }

        the_deliver = the_deliver.the_deliver;

        const userResponse = await generateUserResponse(the_deliver);
        res.status(200).json({'error':0, user: userResponse, message: the_deliver.new_user ? 'Bienvenu !' : 'Bon retour !' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

const getDefaultParams = async (req, res) => {
    try {
        var the_deliver = await getTheCurrentUserOrFailed(req, res);
        if (the_deliver.result !== 200 ) {
            return res.status(404).json({ message: 'Deliver not found', result:the_deliver.result });
        }
        const userResponse = await generateUserResponse(the_deliver);

        res.status(200).json({ user: userResponse, message: the_deliver.new_user ? 'Bienvenu !' : 'Bon retour !' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const addMobil = async (req, res) => {
    try {
        const { uid, mobil } = req.body;
        var the_deliver = await getTheCurrentUserOrFailed(req, res);
        if (the_deliver.result !== 200 ) {
            return res.status(404).json({ message: 'Deliver not found', result:the_deliver.result });
        }

        if (mobil){
            const mobil_ = new  Mobil();
            mobil_.digits = mobil.digits;
            mobil_.indicatif = mobil.indicatif;
            mobil_.title = mobil.title;
            await mobil_.save();

            the_deliver.mobils.push(mobil_._id);
            await the_deliver.save();

            the_deliver = await Deliver.findOne({_id: the_deliver._id}) 
                .populate('phone')
                .populate('country')
                .populate('mobils');
        }
        const userResponse = await generateUserResponse(the_deliver);

        res.status(200).json({ user: userResponse, message: 'User found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const addCard = async (req, res) => {
    try {
        const { uid, card } = req.body;

        var the_deliver = await getTheCurrentUserOrFailed(req, res);
        if (the_deliver.result !== 200 ) {
            return res.status(404).json({ message: 'Deliver not found', result:the_deliver.result });
        }

        const userResponse = await generateUserResponse(the_deliver);

        res.status(200).json({ user: userResponse, message: 'User found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const removeMobil = async (req, res) => {
    try {
        const { uid, mobil } = req.body;

        var the_deliver = await getTheCurrentUserOrFailed(req, res);
        if (the_deliver.result !== 200 ) {
            return res.status(404).json({ message: 'Deliver not found', result:the_deliver.result });
        }

        if (mobil){
            const mobil_ = await Mobil.findOne({ _id: mobil.id });
            if (mobil_){
                the_deliver.mobils = the_deliver.mobils.filter((k, v) => k != mobil.id);
                await the_deliver.save();
                await Mobil.deleteOne(mobil_);
            }

            the_deliver = await Deliver.findOne({_id: the_deliver._id}) 
                .populate('country')
                .populate('mobils')
                .populate('phone');
        }
        const userResponse = await generateUserResponse(the_deliver);

        res.status(200).json({ user: userResponse, message: 'User found' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const refreshUser = async (req, res) => {
    const { authkey, uid } = req.body;
    
    if (authkey !== "awebifu abwiofebu 4gt1p9p891ht bw45iugt9w") {
        return res.status(403).json({ message: 'Not authorized!' });
    }
    
    try {
        var uidObj = await Uid.findOne({ uid: uid });

        var the_deliver = uidObj ? await Deliver.findOne({ uids: uidObj }) 
            .populate('country')
            .populate('phone')
            .populate('mobils') : false;

        var isNewUser = !the_deliver;

        var result = await getUserInfoByUUID(uid);

        if (result.status !== 200) {
            return res.status(404).json({ message: 'Deliver not found', result: result });
        }

        the_deliver = result.deliver.phoneNumber ? await Deliver.findOne({ 
            $or: [
            // { phone: result.user.phoneNumber.trim() },
            { phone: result.user.phoneNumber.replace(/\s+/g, '').trim() }
            ]
        })
        .populate('country')
        .populate('phone')
        .populate('mobils') : false;
        
        if (!the_deliver && result.user.email) {
            the_deliver = await Deliver.findOne({ email: result.user.email })
                                                .populate('country')
                                                .populate('phone')
                                                .populate('mobils')
        }

        if(the_deliver) { isNewUser = false;}

        if (isNewUser) { the_deliver = new Deliver(); }
        const phoneNumber = result.user.phoneNumber ? parsePhoneNumberFromString(result.user.phoneNumber) : false;
    
        if (phoneNumber) {
            const country = await Country.findOne({ code: phoneNumber.country });
            if (country) {
                let mobil = new Mobil();
                mobil.indicatif = country.dial_code;
                mobil.digits = phoneNumber.nationalNumber;
                await mobil.save();

                the_deliver.country = country._id;
                the_deliver.phone = mobil._id;
                await the_deliver.save();
            }
        }

        if (!uidObj){
            uidObj = new Uid({ uid: uid });
            await uidObj.save();
        }
        the_deliver.uids = the_deliver.uids ? the_deliver.uids.concat(uidObj._id) : [uidObj._id];

        ['email', 'name', 'photoURL', 'disabled'].forEach(element => {
            the_deliver[element] = result.user[element];
        });
        if (result.user.displayName) { 
            let name = result.user.displayName.split(' ');
            the_deliver.name = name[0] ?? '';
            the_deliver.surname = name.filter((k, v) => v != 0).toString() ?? '';
        }
        the_deliver.coins = 0;

        if (!isNewUser) { the_deliver.updatedAt = Date.now(); }

        await the_deliver.save();

        res.status(200).json({ user: the_deliver, message: 'User refreshed with updated data!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
const editProfil = async (req, res) => {
    try {
        const { uid, name, surname, email, thephone, country } = req.body;

        var the_deliver = await getTheCurrentUserOrFailed(req, res);
        var theUserPhone = null;
        if (the_deliver.result !== 200 ) {
            return res.status(404).json({ message: 'Deliver not found', result:the_deliver.result });
        }
        if (!thephone || !country || !name){
            const userResponse = await generateUserResponse(the_deliver);
            return res.status(200).json({ message: 'Certains parametres sont manquants !', user: userResponse, error: 1 });
        }

        thephone.replace(/\s+/g, '').trim();

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
            const userResponse = await generateUserResponse(the_deliver);
            return res.status(200).json({ message: 'Email invalide !', user: userResponse, error: 1 });
            }
        }

        var existUserWithEmailOrPhone = the_deliver.email === email ? null : await Deliver.findOne({ email: email });
        if (existUserWithEmailOrPhone == null) {
            if (the_deliver.phone){
                theUserPhone = await Mobil.findOne({id: the_deliver.phone._id});
            }
            if (theUserPhone && theUserPhone.digits !== thephone && theUserPhone.indicatif !== country){
                const phones = await Mobil.find({ digits: thephone });
                for (const phone of phones) {
                    const userWithPhone = await Deliver.findOne({ phone: phone._id });
                    if (userWithPhone && userWithPhone._id !== the_deliver._id) {
                        existUserWithEmailOrPhone = userWithPhone;
                        break;
                    }
                }    
            }
        }

        if (existUserWithEmailOrPhone != null  && existUserWithEmailOrPhone._id != the_deliver._id) {
            const userResponse = await generateUserResponse(the_deliver);
            return res.status(200).json({ message: `Un utilisateur avec ce numero de telephone ou l\'email existe deja ! ${existUserWithEmailOrPhone._id}`, error: 1, user: userResponse });
        }

        const countryObj = await Country.findOne({ dial_code: country });
        if (!countryObj) {
            const userResponse = await generateUserResponse(the_deliver);
            return res.status(200).json({ message: 'Le pays selectionne n\'existe pas !', user: userResponse, error: 1 });
        }

        let phone_ = the_deliver.phone != null ? await Mobil.findOne({_id: the_deliver.phone}) : new Mobil();
        if (!theUserPhone || (theUserPhone && theUserPhone.digits !== thephone && theUserPhone.indicatif !== country)){
            phone_.indicatif = countryObj.dial_code;
            phone_.digits = thephone;
            phone_.title = thephone;
            await phone_.save();

            the_deliver.country = countryObj._id;
        }

        the_deliver.name = name;
        the_deliver.phone = phone_._id;
        if (!the_deliver.email){the_deliver.email = email; }

        await the_deliver.save();

        the_deliver = await Deliver.findOne({_id: the_deliver._id}) 
            .populate('country')
            .populate('phone')
            .populate('mobils');
                
        const userResponse = await generateUserResponse(the_deliver);

        res.status(200).json({ user: userResponse, message: 'Modifications effectuees avec success !', error: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const registerAdditionalInfo = async (req, res) => {
    try {
      const { uid, ...infos } = req.body;
  
      const uidObj = await Uid.findOne({ uid });
      if (!uidObj) return res.status(404).json({ message: "UID non trouvé" });
  
      const deliver = await Deliver.findOne({ uids: uidObj._id });
      if (!deliver) return res.status(404).json({ message: "Utilisateur non trouvé" });
  
      deliver.name = infos.name ?? deliver.name;
      deliver.surname = infos.surname ?? deliver.surname;
      deliver.email = infos.email ?? deliver.email;
      deliver.address = infos.address ?? deliver.address;
      deliver.vehicleType = infos.vehicleType ?? deliver.vehicleType;
      deliver.marqueVehicule = infos.marqueVehicule ?? deliver.marqueVehicule;
      deliver.modelVehicule = infos.modelVehicule ?? deliver.modelVehicule;
      deliver.anneeVehicule = infos.anneeVehicule ?? deliver.anneeVehicule;
      deliver.nrEssieux = infos.nrEssieux ?? deliver.nrEssieux;
      deliver.capaciteCharge = infos.capaciteCharge ?? deliver.capaciteCharge;
      deliver.nrImmatriculation = infos.nrImmatriculation ?? deliver.nrImmatriculation;
      deliver.nrAssurance = infos.nrAssurance ? new Date(infos.nrAssurance) : deliver.nrAssurance;
      deliver.nrChassis = infos.nrChassis ?? deliver.nrChassis;
      deliver.nrPermis = infos.nrPermis ?? deliver.nrPermis;
      deliver.nrVisiteTechnique = infos.nrVisiteTechnique ? new Date(infos.nrVisiteTechnique) : deliver.nrVisiteTechnique;
      deliver.nrCarteGrise = infos.nrCarteGrise ?? deliver.nrCarteGrise;
      deliver.nrContrat = infos.nrContrat ?? deliver.nrContrat;
  
      // Gestion du pays si on reçoit un objet
      if (infos.country && infos.country.code) {
        const country = await Country.findOne({ code: infos.country.code });
        if (country) deliver.country = country._id;
      }
  
      await Deliver.save(deliver);
      return res.status(200).json({'error':0, 'user': await generateUserResponse(deliver)});
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Erreur lors de l'enregistrement des infos", error: err.message });
    }
  };

//exports
module.exports = { authentificateUser, refreshUser, addMobil, addCard, removeMobil, editProfil, getDefaultParams, registerAdditionalInfo };

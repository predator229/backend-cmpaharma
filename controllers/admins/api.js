require('module-alias/register');
const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse} = require('@tools/flutter_tools');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const Uid = require('@models/Uid');
const Country = require('@models/Country');
const Mobil = require('@models/Mobil');
const Deliver = require('@models/Deliver');

const authentificateUser = async (req, res) => {
    try {
        var the_admin = await getTheCurrentUserOrFailed(req, res);
        // return res.json({kk: the_admin});

        if (the_admin.error ) {
            return res.status(404).json({ message: 'User not found' });
        }
        user = the_admin.the_user;

        user.fullName = [user.name ?? '', user.surname ?? ''].filter(Boolean).join(' ');
        user.defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'User')}&background=random&size=500`;
    
        return res.status(200).json({'error':0, user: user, message: user.new_user ? 'Bienvenu !' : 'Bon retour !' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

//exports
module.exports = { authentificateUser };

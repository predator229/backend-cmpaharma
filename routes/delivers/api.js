require('module-alias/register');
const express = require('express');
const { createAuthMiddleware } = require('@middlewares/auth');

const { verifyFirebaseToken: deliververifyFirebaseToken, injectDeliverType } = createAuthMiddleware('deliver');
const { authentificateUser, refreshUser, addMobil, addCard, removeMobil, editProfil, getDefaultParams, registerAdditionalInfo } = require('@controllers/delivers/api');

const router = express.Router();
router.use(injectDeliverType);

router.get('/', (req, res) => {
    res.status(200).json({ message: 'API deliver is running', });
}); 

router.post('/', (req, res) => {
    res.status(200).json({ message: 'API deliver is running',  req_infos : req.body ?? "pas de parametre"});
}); //

//users auth and refresh
router.post('/users/register-additional-info', registerAdditionalInfo);
router.post('/users/authentificate', deliververifyFirebaseToken, authentificateUser);
router.post('/users/refresh', deliververifyFirebaseToken, refreshUser);
// default settings
router.post('/settings/get-default-params', deliververifyFirebaseToken, getDefaultParams);
//user
router.post('/users/edit-profil', deliververifyFirebaseToken, editProfil);
router.post('/users/add-mobil', deliververifyFirebaseToken, addMobil);
router.post('/users/add-card', deliververifyFirebaseToken, addCard);
router.post('/users/remove-mobil', deliververifyFirebaseToken, removeMobil);


module.exports = router;

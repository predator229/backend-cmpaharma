require('module-alias/register');
const express = require('express');
const { createAuthMiddleware } = require('@middlewares/auth');

const { verifyFirebaseToken: deliververifyFirebaseToken, injectDeliverType } = createAuthMiddleware('admin');
const { authentificateUser, setProfilInfo, loadGeneralsInfo, setSettingsFont, pharmacieList, pharmacieDetails, pharmacieNew, pharmacieEdit, pharmacieDelete, pharmacieApprove, pharmacieSuspend, pharmacieActive, pharmacieReject, pharmacieDocuments, pharmacieDocumentsDownload} = require('@controllers/admins/api');

const router = express.Router();
router.use(injectDeliverType);

router.get('/', (req, res) => { res.status(200).json({ message: 'API admin is running' }); });

router.post('/users/authentificate', deliververifyFirebaseToken, authentificateUser);
router.post('/users/set-profil-info', deliververifyFirebaseToken, setProfilInfo);
router.post('/users/set-setings-font', deliververifyFirebaseToken, setSettingsFont);

router.post('/managers/dashboard', deliververifyFirebaseToken, loadGeneralsInfo);

router.post('/managers/pharmacies/list', deliververifyFirebaseToken, pharmacieList);
router.post('/managers/pharmacies/details', deliververifyFirebaseToken, pharmacieDetails);
router.post('/managers/pharmacies/new', deliververifyFirebaseToken, pharmacieNew);
router.post('/managers/pharmacies/edit', deliververifyFirebaseToken, pharmacieEdit);
router.post('/managers/pharmacies/delete', deliververifyFirebaseToken, pharmacieDelete);
router.post('/managers/pharmacies/approve', deliververifyFirebaseToken, pharmacieApprove);
router.post('/managers/pharmacies/suspend', deliververifyFirebaseToken, pharmacieSuspend);
router.post('/managers/pharmacies/activate', deliververifyFirebaseToken, pharmacieActive);
router.post('/managers/pharmacies/reject', deliververifyFirebaseToken, pharmacieReject);
router.post('/managers/pharmacies/documents', deliververifyFirebaseToken, pharmacieDocuments);
router.post('/managers/pharmacies/documents/download', deliververifyFirebaseToken, pharmacieDocumentsDownload);

module.exports = router;

require('module-alias/register');
const express = require('express');
const { createAuthMiddleware } = require('@middlewares/auth');

const { verifyFirebaseToken: deliververifyFirebaseToken, injectDeliverType } = createAuthMiddleware('admin');
const { authentificateUser, setProfilInfo, setSettingsFont, pharmacieList, pharmacieDetails, pharmacieNew, pharmacieEdit, pharmacieDelete, pharmacieApprove, pharmacieSuspend, pharmacieActive, pharmacieReject, pharmacieDocuments, pharmacieDocumentsDownload} = require('@controllers/admins/api');

const router = express.Router();
router.use(injectDeliverType);

router.get('/', (req, res) => { res.status(200).json({ message: 'API admin is running' }); });

router.post('/users/authentificate', deliververifyFirebaseToken, authentificateUser);
router.post('/users/set-profil-info', deliververifyFirebaseToken, setProfilInfo);
router.post('/users/set-setings-font', deliververifyFirebaseToken, setSettingsFont);
router.post('/pharmacies/list', deliververifyFirebaseToken, pharmacieList);
router.post('/pharmacies/details', deliververifyFirebaseToken, pharmacieDetails);
router.post('/pharmacies/new', deliververifyFirebaseToken, pharmacieNew);
router.post('/pharmacies/edit', deliververifyFirebaseToken, pharmacieEdit);
router.post('/pharmacies/delete', deliververifyFirebaseToken, pharmacieDelete);
router.post('/pharmacies/approve', deliververifyFirebaseToken, pharmacieApprove);
router.post('/pharmacies/suspend', deliververifyFirebaseToken, pharmacieSuspend);
router.post('/pharmacies/activate', deliververifyFirebaseToken, pharmacieActive);
router.post('/pharmacies/reject', deliververifyFirebaseToken, pharmacieReject);
router.post('/pharmacies/documents', deliververifyFirebaseToken, pharmacieDocuments);
router.post('/pharmacies/documents/download', deliververifyFirebaseToken, pharmacieDocumentsDownload);

module.exports = router;

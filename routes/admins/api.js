require('module-alias/register');
const express = require('express');
const { createAuthMiddleware } = require('@middlewares/auth');
const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, getUserInfoByEmail, signUpUserWithEmailAndPassword,createUserAndSendEmailLink,deleteUserByEmail, getListCountries} = require('@tools/flutter_tools');

const { verifyFirebaseToken: deliververifyFirebaseToken, injectDeliverType } = createAuthMiddleware('admin');
const { authentificateUser,
    setProfilInfo,
    loadGeneralsInfo,
    setSettingsFont,
    loadAllActivities,
    pharmacieList,
    pharmacieDetails,
    pharmacieNew,
    pharmacieEdit,
    pharmacieDelete,
    pharmacieApprove,
    pharmacieSuspend,
    pharmacieActive,
    pharmacieReject,
    pharmacieDocuments,
    pharmacieDocumentsDownload,pharmacieUpdate,
    pharmacieDocumentsUpload,
    pharmacieWorkingsHours,
    pharmacieActivities,loadHistoricMiniChat,
    pharmacyCategoriesList,
    pharmacieCategorieImagesUpload,
    pharmacyCategoriesCreate,
    pharmacyCategoryDetail,
    categoriesActivities,
    categorieUpdate,
    categorieDelete,
    pharmacyCategoriesImport,
    pharmacyProductsList,
    pharmacyProductsCreate,
    productsActivities,
    uploadProductImages,
    productsAdvancedSearch,
    productsStats,
    pharmacyProductsImport,
    pharmacyProductDetail,
    productUpdate,
    productDelete,
    AllPharmacieActivities,
    pharmacyUsersList,
    pharmacyPermissionsList,
    pharmacyGroupsList,
    pharmacyGroupsJoin,
    pharmacyGroupsLeave,
    pharmacyGroupsgetMembers,
    pharmacyGroupsgetAvailableUsers,
    pharmacyGroupsaddMembers,
    pharmacyGroupsremoveMember,
    pharmacyGroupsManage,
    pharmacyUsersCreate,
    pharmacyUsersDetail,
    pharmacyUsersEditProfile,
    usersActivities,
    loadConversations,
    createConversation,
    loadMessages,
    getTicketsList,
    getTicketById,
    createTicket,
    updateTicket,
    deleteTicket,
    sendMessage,
    markMessageAsRead,
    getTicketTemplates,
    getTicketStats,
    uploadTicketAttachment,
    uploadTicketMessageAttachment
} = require('@controllers/admins/api');

const {checkPharmacyInfo, checkPharmacyOwnerInfo} = require('@controllers/guest/api');
const upload = require('@middlewares/uploadRoutes');

const router = express.Router();
router.use(injectDeliverType);

//checker without authentification
router.get('/', (req, res) => { res.status(200).json({ message: 'API admin is running' }); });
router.post('/pharmacies/check-pharmacy-info', checkPharmacyInfo);
router.post('/pharmacies/check-owner-and-save-info', checkPharmacyOwnerInfo);

router.get('/testcreatingandsendingemail', async (req, res) => { 
    if (req.body.email) {
        const resultCreatedUser = await createUserAndSendEmailLink(req.body.email, "admin", process.env.FRONT_BASE_LINK+'set-password');
        if (resultCreatedUser.status == 200) {
            return res.status(200).json({ message: 'All ok' });
        } else{
            return res.status(200).json({ message: resultCreatedUser.error ?? 'noepe', actionUrl: resultCreatedUser.actionUrl ?? '' });
        }
    }
    res.status(200).json({ message: 'API admin is running' });
});


//admins
router.post('/users/authentificate', deliververifyFirebaseToken, authentificateUser);
router.post('/users/set-profil-info', deliververifyFirebaseToken, setProfilInfo);
router.post('/users/set-setings-font', deliververifyFirebaseToken, setSettingsFont);

router.post('/managers/dashboard', deliververifyFirebaseToken, loadGeneralsInfo);
router.post('/managers/dashboard/activities', deliververifyFirebaseToken, loadAllActivities);

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
router.post('/managers/pharmacies/activities', deliververifyFirebaseToken, pharmacieActivities);

//pharcy-managment

    //dahbord
    router.post('/pharmacy-managment/dashboard', deliververifyFirebaseToken, loadGeneralsInfo);
    router.post('/pharmacy-managment/dashboard/activities', deliververifyFirebaseToken, loadAllActivities);

    router.post('/pharmacy-managment/pharmacies/list', deliververifyFirebaseToken, pharmacieList);
    router.post('/pharmacy-managment/pharmacies/details', deliververifyFirebaseToken, pharmacieDetails);
    router.post('/pharmacy-managment/pharmacies/activities', deliververifyFirebaseToken, pharmacieActivities);
    router.post('/pharmacy-managment/pharmacies/workingsHours', deliververifyFirebaseToken, pharmacieWorkingsHours);
    router.post('/pharmacy-managment/pharmacies/new', deliververifyFirebaseToken, pharmacieNew);
    router.post('/pharmacy-managment/pharmacies/edit', deliververifyFirebaseToken, pharmacieEdit);
    router.post('/pharmacy-managment/pharmacies/documents', deliververifyFirebaseToken, pharmacieDocuments);
    router.post('/pharmacy-managment/pharmacies/documents/download', deliververifyFirebaseToken, pharmacieDocumentsDownload);
    router.post('/pharmacy-managment/pharmacies/upload-document', deliververifyFirebaseToken, upload.single('file'), pharmacieDocumentsUpload);
    router.post('/pharmacy-managment/pharmacies/update', deliververifyFirebaseToken, pharmacieUpdate);

    //routes categories
    router.post('/pharmacy-management/categories/list', deliververifyFirebaseToken, pharmacyCategoriesList);
    router.post('/pharmacy-management/categories/detail', deliververifyFirebaseToken, pharmacyCategoryDetail);
    router.post('/pharmacy-management/categories/create', deliververifyFirebaseToken, pharmacyCategoriesCreate);
    router.post('/pharmacy-managment/pharmacies/upload-images-cat', deliververifyFirebaseToken, upload.single('file'), pharmacieCategorieImagesUpload);
    router.post('/pharmacy-managment/categories/activities', deliververifyFirebaseToken, categoriesActivities);
    router.post('/pharmacy-management/categories/update', deliververifyFirebaseToken, categorieUpdate);
    router.post('/pharmacy-management/categories/delete', deliververifyFirebaseToken, categorieDelete);
    router.post('/pharmacy-management/categories/import', deliververifyFirebaseToken, pharmacyCategoriesImport);

    // Routes produits
    router.post('/pharmacy-management/products/list',deliververifyFirebaseToken, pharmacyProductsList);
    router.post('/pharmacy-management/products/create',deliververifyFirebaseToken, pharmacyProductsCreate);
    router.post('/pharmacy-management/products/import',deliververifyFirebaseToken, pharmacyProductsImport);
    router.post('/pharmacy-management/products/detail',deliververifyFirebaseToken, pharmacyProductDetail);
    router.post('/pharmacy-management/products/update',deliververifyFirebaseToken, productUpdate);
    router.post('/pharmacy-management/products/delete',deliververifyFirebaseToken, productDelete);
    router.post('/pharmacy-management/products/activities',deliververifyFirebaseToken, productsActivities);
    router.post('/pharmacy-management/products/upload-images', deliververifyFirebaseToken, upload.single('file'), uploadProductImages);
    router.post('/pharmacy-management/products/search',deliververifyFirebaseToken, productsAdvancedSearch);
    router.post('/pharmacy-management/products/stats',deliververifyFirebaseToken, productsStats);

    //Routes utilisateurs
    router.post('/pharmacy-management/users/list',deliververifyFirebaseToken, pharmacyUsersList);
    router.post('/pharmacy-management/users/detail',deliververifyFirebaseToken, pharmacyUsersDetail);
    router.post('/pharmacy-management/users/create',deliververifyFirebaseToken, pharmacyUsersCreate);
    router.post('/pharmacy-management/users/update-profile',deliververifyFirebaseToken, pharmacyUsersEditProfile);
    router.post('/pharmacy-management/users/activities',deliververifyFirebaseToken, usersActivities);

    //Routes permissions et groupes
    router.post('/pharmacy-management/permissions/list',deliververifyFirebaseToken, pharmacyPermissionsList);

    //Routes permissions et groupes
    router.post('/pharmacy-management/groups/list',deliververifyFirebaseToken, pharmacyGroupsList);
    router.post('/pharmacy-management/groups/join',deliververifyFirebaseToken, pharmacyGroupsJoin);
    router.post('/pharmacy-management/groups/leave',deliververifyFirebaseToken, pharmacyGroupsLeave);
    router.post('/pharmacy-management/groups/getMembers',deliververifyFirebaseToken, pharmacyGroupsgetMembers);
    router.post('/pharmacy-management/groups/getAvailableUsers',deliververifyFirebaseToken, pharmacyGroupsgetAvailableUsers);
    router.post('/pharmacy-management/groups/addMembers',deliververifyFirebaseToken, pharmacyGroupsaddMembers);
    router.post('/pharmacy-management/groups/removeMember',deliververifyFirebaseToken, pharmacyGroupsremoveMember);
    router.post('/pharmacy-management/groups/manage',deliververifyFirebaseToken, pharmacyGroupsManage);
    
//tools
    router.post('/tools/get-countries-list' , getListCountries);
    router.post('/tools/activities', deliververifyFirebaseToken, AllPharmacieActivities);


    router.post('/tools/tickets/list', deliververifyFirebaseToken, getTicketsList);
    router.post('/tools/tickets/listById', deliververifyFirebaseToken, getTicketById);
    router.post('/tools/tickets/create', deliververifyFirebaseToken, createTicket);
    router.post('/tools/tickets/update', deliververifyFirebaseToken, updateTicket);
    router.post('/tools/tickets/delete', deliververifyFirebaseToken, deleteTicket);
    router.post('/tools/tickets/sendMessage', deliververifyFirebaseToken, sendMessage);
    router.post('/tools/tickets/messages/read', deliververifyFirebaseToken, markMessageAsRead);
    router.post('/tools/tickets/templates', deliververifyFirebaseToken, getTicketTemplates);
    router.post('/tools/tickets/stats', deliververifyFirebaseToken, getTicketStats);
    router.post('/tools/tickets/upload', deliververifyFirebaseToken, upload.single('file'),  uploadTicketAttachment);
    router.post('/tools/tickets/upload-message', deliververifyFirebaseToken, upload.single('file'),  uploadTicketMessageAttachment);

//mini-chat
    router.post('/chat/pharmacy/messages', deliververifyFirebaseToken, loadHistoricMiniChat);
    router.post('/chat/pharmacy/messages/conversation', deliververifyFirebaseToken, loadConversations);
    router.post('/chat/pharmacy/messages/conversation/create', deliververifyFirebaseToken, createConversation);
    router.post('/chat/pharmacy/messages/conversation/loadMessage', deliververifyFirebaseToken, loadMessages);


module.exports = router;

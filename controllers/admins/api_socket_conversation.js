const MiniChatMessage = require('@models/MiniChatMessage'); 
const Pharmacy = require('@models/Pharmacy'); 
const MiniChatAttachement = require('@models/MiniChatAttachement');
const File = require('@models/File');
const Conversation = require('@models/Conversation');
const Admin = require('@models/Admin');

const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, registerActivity } = require('@tools/flutter_tools');

const conversationSocketRoutes = async (socket, adminNamespace) => {
  try {
        const the_admin = await getTheCurrentUserOrFailed({ body: { uid: socket.user.uid, type: 'admin' } }, null);
        if (the_admin.error) {
            console.error(`❌ Admin non trouvé: ${socket.user.uid}`);
            socket.emit('error', { message: 'Erreur : L\'utilisateur n\'a pas été retrouvé !' });
            socket.disconnect();
            return;
        }
        let pharmaciesManaged = user?.groups?.some(g => [ 'manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant'].includes(g.code))
            ? user.pharmaciesManaged.map(pharm => pharm._id)
            : [];

        if (!pharmaciesManaged && pharmaciesManaged.length <= 0) {
            console.error(`❌ Admin : aucune pharmacie trouvé: ${socket.user.uid}`);
            socket.emit('error', { message: 'Admin : aucune pharmacie trouvé !' });
            
            socket.disconnect();
            return;
        }

        const userToSave = await Admin.findById(the_admin.the_user._id);
        if (!userToSave) {
            console.error(`❌ Admin non trouvée: ${socket.user.name}`);
            socket.emit('error', { message: 'Admin non trouvée !' });
            socket.disconnect();
            return;
        }
        userToSave.lastLogin = Date.now();
        await userToSave.save();

        socket.the_user = the_admin.the_user;
        socket.the_user.photoURL = socket.the_user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(socket.the_user.name || 'User')}&background=random&size=500`;
        socket.emit('you are connected');

        // Event: Join an room
        socket.on('je_rejoins_la_phamacie_conv', async (data) => {
            console.log(`🔄 Tentative de rejoindre la conversation:`);
            const { pharmacyId } = data;
            
            if (!pharmacyId) {
                console.error('❌ Id  manquant');
                socket.emit('error', { message: 'Id est requis' });
                return;
            }

            try {
                const rooms = Array.from(socket.rooms);
                rooms.forEach(room => {
                    if (room.startsWith('full_plateform_pharmacy_')) {
                        socket.leave(room);
                        console.log(`👋 Utilisateur ${socket.user.name} a quitté ${room}`);
                    }
                });
                
                const roomName = `full_plateform_pharmacy_${pharmaciesManaged.join('_')}`;
                socket.join(roomName);
                
                console.log(`👤 Utilisateur ${socket.user.name} a rejoint la conversation (room : full_plateform_pharmacy_${pharmaciesManaged.join('_')})`);
                
                // Notifier les autres dans la room
                adminNamespace.to(roomName).emit('user_joined', {
                    userId: socket.user.uid,
                    userName: `${socket.the_user.name} ${socket.the_user.surname}`,
                    userType: 'pharmacy',
                    pharmacyId: socket.uid,
                    timestamp: new Date()
                });

                socket.emit('user_joined', {
                    userId: socket.user.uid,
                    userName: `${socket.the_user.name} ${socket.the_user.surname}`,
                    userType: 'pharmacy',
                    pharmacyId: socket.uid,
                    timestamp: new Date()
                });

                // Debug: afficher les rooms actuelles
                console.log(`📋 Rooms de l'admin ${socket.the_user.name}:`, Array.from(socket.rooms));

            } catch (error) {
                console.error('❌ Erreur lors de la connexion à la conversation:', error);
                socket.emit('error', { message: 'Erreur lors de la connexion à la conversation' });
            }
        });

        // // Event: Quitter une conversation de pharmacie
        socket.on('leave_pharmacy_chat', async (data) => {
            const { pharmacyId } = data;
            
            userToSave.lastLogin = Date.now();
            await userToSave.save();

            const roomName = `full_plateform_pharmacy_${pharmaciesManaged.join('_')}`;
            
            socket.leave(roomName);
            console.log(`👋 Utilisateur ${socket.user.name} a quitté la conversation (room : full_plateform_pharmacy_${pharmaciesManaged.join('_')})`);
            
            socket.to(roomName).emit('user_left', {
                userId: socket.user.uid,
                userName: `${socket.the_user.name} ${socket.the_user.surname}`,
                userType: 'pharmacy',
                pharmacyId: socket.uid,
                timestamp: new Date()
            });

            socket.emit('left_pharmacy_chat', {
                userId: socket.the_user._id,
                userName: `${socket.the_user.name} ${socket.the_user.surname}`,
                userType: 'pharmacy',
                pharmacyId: socket.uid,
                timestamp: new Date()
            });
        });

        // Event: Envoyer un message
        socket.on('send_message', async (data) => {
            const { pharmacyId, message = {}, attachments } = data;
            userToSave.lastLogin = Date.now();
            await userToSave.save();

            if (!pharmacyId) {
                socket.emit('error', { message: 'Id de la conversation est requis' });
                return;
            }

            try {
                const query = { _id: pharmacyId, participants: { $in: [socket.user._id] }, };
                let conversation = await Conversation.findOne(query);
                if (!conversation) {
                    console.error('❌ Erreur : La conversation n\'existe pas');
                    socket.emit('error', { message: 'Erreur : La conversation n\'existe pas' });
                    return;
                }

                const roomName = `full_plateform_pharmacy_${pharmaciesManaged.join('_')}`;

                // Traitement des attachments
                var attsMess = [];

                // Création du nouveau message
                const newMessage = new MiniChatMessage({
                    senderId: socket.the_user.id,
                    senderName: socket.the_user.name,
                    senderType: 'pharmacy',
                    conversation: conversation._id,
                    message: message.message || '',
                    isActivated: true,
                    isDeleted: false,
                    seen: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                if (attachments) {
                    const fileee = await File.findOne({_id: attachments});
                    if (fileee) {
                        newMessage.attachments = fileee._id;
                    }
                }
                await newMessage.save();
                await newMessage.populate('attachments');
                
                const plainMessage = newMessage.toObject();

                adminNamespace.to(roomName).emit('new_message', {
                    message: plainMessage,
                    pharmacyId: pharmacyId
                });

                console.log(`✅ Message envoyé par admin ${socket.the_user.name} dans ${roomName}`);

            } catch (error) {
                console.error('❌ Erreur lors de l\'envoi du message:', error);
                socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
            }
        });

        // Event: Marquer les messages comme lus
        socket.on('mark_as_read', async (data) => {
            const { pharmacyId } = data;

            userToSave.lastLogin = Date.now();
            await userToSave.save();

            if (!pharmacyId) {
                socket.emit('error', { message: 'Conversation Id est requis' });
                return;
            }

            try {
                const updateResult = await MiniChatMessage.updateMany(
                    { 
                        conversation: pharmacyId,
                        seen: true 
                    },
                    { 
                        seen: true,
                        seenAt: new Date()
                    }
                );

                const roomName = `full_plateform_pharmacy_${pharmaciesManaged.join('_')}`;
                socket.to(roomName).emit('messages_read', {
                    pharmacyId: pharmacyId,
                    userId: socket.user.uid,
                    readCount: updateResult.modifiedCount
                });

                socket.emit('marked_as_read', {
                    userId: socket.user.uid,
                    userName: `${socket.the_user.name} ${socket.the_user.surname}`,
                    userType: 'pharmacy',
                    pharmacyId: socket.uid,
                    timestamp: new Date()
                });

                console.log(`✅ ${updateResult.modifiedCount} messages marqués comme lus par admin ${socket.the_user.name} pour ${pharmacyId}`);

            } catch (error) {
                console.error('❌ Erreur lors du marquage comme lu:', error);
                socket.emit('error', { message: 'Erreur lors du marquage comme lu' });
            }
        });

        // Event: Supprimer un message (admin uniquement)
        // socket.on('delete_message', async (data) => {
        //     const { pharmacyId, messageId } = data;

        //     if (!pharmacyId || !messageId) {
        //         socket.emit('error', { message: 'pharmacyId et messageId sont requis' });
        //         return;
        //     }

        //     try {
        //         const message = await MiniChatMessage.findOne({
        //             _id: messageId,
        //             for: pharmacyId,
        //             senderId: socket.user.uid,
        //             senderType: 'admin'
        //         });

        //         if (!message) {
        //             socket.emit('error', { message: 'Message non trouvé ou non autorisé' });
        //             return;
        //         }

        //         // Soft delete
        //         message.isDeleted = true;
        //         message.deletedAt = new Date();
        //         await message.save();

        //         const roomName = `pharmacy_${pharmacyId}`;
        //         adminNamespace.to(roomName).emit('message_deleted', {
        //             messageId: messageId,
        //             pharmacyId: pharmacyId,
        //             deletedBy: socket.user.uid
        //         });

        //         socket.emit('message_deleted_confirm', {
        //             messageId: messageId,
        //             pharmacyId: pharmacyId
        //         });

        //         console.log(`🗑️ Message supprimé par admin ${socket.user.uid}: ${messageId}`);

        //     } catch (error) {
        //         console.error('❌ Erreur lors de la suppression:', error);
        //         socket.emit('error', { message: 'Erreur lors de la suppression du message' });
        //     }
        // });

        // Event: Déconnexion
        socket.on('disconnect', () => {
            console.log(`🔌 Admin déconnecté: ${socket.user.uid}`);
            
            const roomName = `full_plateform_pharmacy_${pharmaciesManaged.join('_')}`;

            const rooms = Array.from(socket.rooms);
            rooms.forEach(room => {
                if (room.startsWith('full_plateform_pharmacy_')) {
                    const pharmacyId = room.replace('full_plateform_pharmacy_', '');
                    socket.to(room).emit('user_left', {
                        userId: socket.the_user.id,
                        userName: socket.the_user.name,
                        userType: 'pharmacy',
                        pharmacyId: pharmacyId,
                        timestamp: new Date()
                    });
                }
            });
        });

        // Event: Gestion des erreurs
        socket.on('error', (error) => {
            console.error(`❌ Erreur socket admin ${socket.user.uid}:`, error);
        });

  } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de la connexion admin:', error);
      socket.emit('error', { message: 'Erreur lors de l\'initialisation' });
      socket.disconnect();
  }
};

module.exports = conversationSocketRoutes;
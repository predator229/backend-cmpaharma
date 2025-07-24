const MiniChatMessage = require('@models/MiniChatMessage'); 
const Pharmacy = require('@models/Pharmacy'); 
const MiniChatAttachement = require('@models/MiniChatAttachement');

const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, registerActivity } = require('@tools/flutter_tools');

const adminSocketRoutes = async (socket, adminNamespace) => {
  try {
        const the_admin = await getTheCurrentUserOrFailed({ body: { uid: socket.user.uid, type: 'admin' } }, null);
        if (the_admin.error) {
            console.error(`❌ Admin non trouvé: ${socket.user.uid}`);
            socket.emit('error', { message: 'Erreur : L\'utilisateur n\'a pas été retrouvé !' });
            socket.disconnect();
            return;
        }
        socket.the_user = the_admin.the_user;
        socket.the_user.photoURL = socket.the_user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(socket.the_user.name || 'User')}&background=random&size=500`;
        socket.emit('you are connected');

        // Event: Join an room
        socket.on('je_rejoins_la_phamacie_conv', async (data) => {
            console.log(`🔄 Tentative de rejoindre la conversation:`);
            const { pharmacyId } = data;
            
            if (!pharmacyId) {
                console.error('❌ pharmacyId manquant');
                socket.emit('error', { message: 'pharmacyId est requis' });
                return;
            }

            try {
                // Vérifier que la pharmacie existe
                const pharmacy = await Pharmacy.findById(pharmacyId);
                if (!pharmacy) {
                    console.error(`❌ Pharmacie non trouvée: ${pharmacyId}`);
                    socket.emit('error', { message: 'Pharmacie non trouvée' });
                    return;
                }

                // Quitter les anciennes rooms de pharmacie
                const rooms = Array.from(socket.rooms);
                rooms.forEach(room => {
                    if (room.startsWith('pharmacy_')) {
                        socket.leave(room);
                        console.log(`👋 Admin ${socket.user.uid} a quitté ${room}`);
                    }
                });
                
                // Rejoindre la nouvelle room
                const roomName = `pharmacy_${pharmacyId}`;
                socket.join(roomName);
                
                console.log(`👤 Admin ${socket.user.uid} a rejoint la conversation ${pharmacyId} (room: ${roomName})`);
                
                // Notifier les autres dans la room
                adminNamespace.to(roomName).emit('user_joined', {
                    userId: socket.user.uid,
                    userName: socket.the_user.name,
                    userType: 'admin',
                    pharmacyId: pharmacyId,
                    timestamp: new Date()
                });

                // // Confirmer la connexion à l'admin
                socket.emit('user_joined', {
                    pharmacyId: pharmacyId,
                    roomName: roomName,
                    timestamp: new Date()
                });

                // Debug: afficher les rooms actuelles
                console.log(`📋 Rooms de l'admin ${socket.user.uid}:`, Array.from(socket.rooms));

            } catch (error) {
                console.error('❌ Erreur lors de la connexion à la conversation:', error);
                socket.emit('error', { message: 'Erreur lors de la connexion à la conversation' });
            }
        });

        // // Event: Quitter une conversation de pharmacie
        socket.on('leave_pharmacy_chat', (data) => {
            const { pharmacyId } = data;
            
            if (!pharmacyId) {
                socket.emit('error', { message: 'pharmacyId est requis' });
                return;
            }

            const roomName = `pharmacy_${pharmacyId}`;
            
            socket.leave(roomName);
            console.log(`👋 Admin ${socket.user.uid} a quitté la conversation ${pharmacyId}`);
            
            socket.to(roomName).emit('user_left', {
                userId: socket.user.uid,
                userName: socket.the_user.name,
                userType: 'admin',
                pharmacyId: pharmacyId,
                timestamp: new Date()
            });

            socket.emit('left_pharmacy_chat', {
                pharmacyId: pharmacyId,
                timestamp: new Date()
            });
        });

        // Event: Envoyer un message
        socket.on('send_message', async (data) => {
            const { pharmacyId, message = {} } = data;

            if (!pharmacyId) {
                socket.emit('error', { message: 'pharmacyId est requis' });
                return;
            }

            try {
                const pharmacy = await Pharmacy.findById(pharmacyId);
                if (!pharmacy) {
                    console.error('❌ Erreur : La pharmacie n\'existe pas');
                    socket.emit('error', { message: 'Erreur : La pharmacie n\'existe pas' });
                    return;
                }

                const roomName = `pharmacy_${pharmacyId}`;

                // Traitement des attachments
                var attsMess = [];
                if (message.attachments && Array.isArray(message.attachments)) {
                    for (const att of message.attachments) {
                        const attToSave = new MiniChatAttachement({
                            name: att.name,
                            type: att.type,
                            size: att.size,
                            url: att.url,
                            isActivated: true,
                            isDeleted: false,
                        });
                        await attToSave.save();
                        attsMess.push(attToSave._id);
                    }
                }

                // Création du nouveau message
                const newMessage = new MiniChatMessage({
                    senderId: socket.the_user.id,
                    senderName: socket.the_user.name+(message.senderType == 'admin' ? '- admin' : ''),
                    senderType: message.senderType,
                    for: pharmacy._id,
                    message: message.message || '',
                    attachments: attsMess,
                    isActivated: true,
                    isDeleted: false,
                    seen: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                await newMessage.save();
                await newMessage.populate('attachments');
                
                const plainMessage = newMessage.toObject();

                // Debug: vérifier qui est dans la room
                // const socketsInRoom = await adminNamespace.in(roomName).fetchSockets();
                // console.log(`📤 Envoi message dans ${roomName} à ${socketsInRoom.length} socket(s)`);
                
                // Envoyer le message à toute la room
                adminNamespace.to(roomName).emit('new_message', {
                    message: plainMessage,
                    pharmacyId: pharmacyId
                });

                // Confirmer l'envoi à l'expéditeur
                // socket.emit('message_sent', {
                //     messageId: plainMessage._id,
                //     timestamp: new Date()
                // });

                console.log(`✅ Message envoyé par admin ${socket.user.uid} dans ${roomName}`);

            } catch (error) {
                console.error('❌ Erreur lors de l\'envoi du message:', error);
                socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
            }
        });

        // // Event: Indicateur de frappe
        socket.on('typing', (data) => {
            const { pharmacyId, isTyping, userType } = data;
            
            if (!pharmacyId) {
                socket.emit('error', { message: 'pharmacyId est requis' });
                return;
            }

            const roomName = `pharmacy_${pharmacyId}`;

            socket.to(roomName).emit('user_typing', {
                userId: socket.user.uid,
                userName: socket.the_user.name,
                userType: userType,
                pharmacyId: pharmacyId,
                isTyping: isTyping
            });
        });

        // Event: Marquer les messages comme lus
        socket.on('mark_as_read', async (data) => {
            const { pharmacyId } = data;

            if (!pharmacyId) {
                socket.emit('error', { message: 'pharmacyId est requis' });
                return;
            }

            try {
                // Marquer tous les messages de cette pharmacie comme lus pour cet admin
                const updateResult = await MiniChatMessage.updateMany(
                    { 
                        for: pharmacyId,
                        senderType: { $ne: 'admin' },
                        seen: false 
                    },
                    { 
                        seen: true,
                        seenAt: new Date()
                    }
                );

                const roomName = `pharmacy_${pharmacyId}`;
                socket.to(roomName).emit('messages_read', {
                    pharmacyId: pharmacyId,
                    userId: socket.user.uid,
                    readCount: updateResult.modifiedCount
                });

                socket.emit('marked_as_read', {
                    pharmacyId: pharmacyId,
                    readCount: updateResult.modifiedCount
                });

                console.log(`✅ ${updateResult.modifiedCount} messages marqués comme lus par admin ${socket.user.uid} pour ${pharmacyId}`);

            } catch (error) {
                console.error('❌ Erreur lors du marquage comme lu:', error);
                socket.emit('error', { message: 'Erreur lors du marquage comme lu' });
            }
        });

        // Event: Supprimer un message (admin uniquement)
        socket.on('delete_message', async (data) => {
            const { pharmacyId, messageId } = data;

            if (!pharmacyId || !messageId) {
                socket.emit('error', { message: 'pharmacyId et messageId sont requis' });
                return;
            }

            try {
                const message = await MiniChatMessage.findOne({
                    _id: messageId,
                    for: pharmacyId,
                    senderId: socket.user.uid,
                    senderType: 'admin'
                });

                if (!message) {
                    socket.emit('error', { message: 'Message non trouvé ou non autorisé' });
                    return;
                }

                // Soft delete
                message.isDeleted = true;
                message.deletedAt = new Date();
                await message.save();

                const roomName = `pharmacy_${pharmacyId}`;
                adminNamespace.to(roomName).emit('message_deleted', {
                    messageId: messageId,
                    pharmacyId: pharmacyId,
                    deletedBy: socket.user.uid
                });

                socket.emit('message_deleted_confirm', {
                    messageId: messageId,
                    pharmacyId: pharmacyId
                });

                console.log(`🗑️ Message supprimé par admin ${socket.user.uid}: ${messageId}`);

            } catch (error) {
                console.error('❌ Erreur lors de la suppression:', error);
                socket.emit('error', { message: 'Erreur lors de la suppression du message' });
            }
        });

        // Event: Déconnexion
        socket.on('disconnect', () => {
            console.log(`🔌 Admin déconnecté: ${socket.user.uid}`);
            
            const rooms = Array.from(socket.rooms);
            rooms.forEach(room => {
                if (room.startsWith('pharmacy_')) {
                    const pharmacyId = room.replace('pharmacy_', '');
                    socket.to(room).emit('user_left', {
                        userId: socket.user.uid,
                        userName: socket.the_user.name,
                        userType: 'admin',
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

module.exports = adminSocketRoutes;
const MiniChatMessage = require('@models/MiniChatMessage'); 
const Pharmacy = require('@models/Pharmacy'); 
const MiniChatAttachement = require('@models/MiniChatAttachement');
const File = require('@models/File');
const Conversation = require('@models/Conversation');
const Admin = require('@models/Admin');

const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, registerActivity } = require('@tools/flutter_tools');

const internalMessagingSocketRoutes = async (socket, internalNamespace) => {
  try {
    console.log(`🔌 Nouvelle connexion au namespace internal_messaging: ${socket.user?.uid}`);

    // Vérification et récupération de l'utilisateur admin
    const the_admin = await getTheCurrentUserOrFailed({ body: { uid: socket.user.uid, type: 'admin' } }, null);
    if (the_admin.error || !the_admin.the_user) {
      console.error(`❌ Admin non trouvé: ${socket.user.uid}`);
      socket.emit('error', { message: 'Erreur : L\'utilisateur n\'a pas été retrouvé !' });
      socket.disconnect();
      return;
    }

    // Vérification des permissions pour la messagerie interne
    const hasMessagingPermission = the_admin.the_user?.groups?.some(g => 
      ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant', 'admin'].includes(g.code)
    );

    if (!hasMessagingPermission) {
      console.error(`❌ Utilisateur sans permission de messagerie: ${socket.user.uid}`);
      socket.emit('error', { message: 'Vous n\'avez pas les permissions pour accéder à la messagerie interne' });
      socket.disconnect();
      return;
    }

    // Mettre à jour le dernier login
    const userToSave = await Admin.findById(the_admin.the_user._id);
    if (!userToSave) {
      console.error(`❌ Admin non trouvé en base: ${the_admin.the_user._id}`);
      socket.emit('error', { message: 'Utilisateur non trouvé en base de données' });
      socket.disconnect();
      return;
    }

    userToSave.lastLogin = Date.now();
    await userToSave.save();

    // Stocker les informations utilisateur dans la socket
    socket.the_user = the_admin.the_user;
    socket.the_user.photoURL = socket.the_user.photoURL ?? 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(socket.the_user.name || 'User')}&background=random&size=500`;

    // Rejoindre la room générale de messagerie interne
    const generalRoom = `internal_messaging_general_${the_admin.the_user.pharmaciesManaged.map( p => p._id).join('_') }`;
    socket.join(generalRoom);

    console.log(`✅ Utilisateur ${socket.the_user.name} connecté à la messagerie interne`);
    socket.emit('you are connected', {
      userId: socket.the_user._id,
      userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
      userType: 'admin',
      timestamp: new Date()
    });

    // Notifier les autres utilisateurs de la connexion
    socket.to(generalRoom).emit('user_online', {
      userId: socket.the_user._id,
      userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
      userType: 'admin',
      isOnline: true,
      timestamp: new Date()
    });

    // connection a toutes les rooms de conversation existantes
    const conversations = await Conversation.find({
      participants: { $in: [socket.the_user._id] }
    });

    conversations.forEach(conversation => {
      const conversationRoom = `conversation_${conversation._id}`;
      socket.join(conversationRoom);
      console.log(`👋 Utilisateur ${socket.the_user.name} a rejoindre ${conversationRoom}`);
    });

    // Event: Rejoindre une conversation spécifique
    socket.on('join_conversation', async (data) => {
      console.log(`🔄 Tentative de rejoindre la conversation:`, data);
      const { iD } = data;
      
      if (!iD) {
        console.error('❌ iD manquant');
        socket.emit('error', { message: 'ID de conversation requis' });
        return;
      }

      try {
        // Vérifier que l'utilisateur est participant de la conversation
        const conversation = await Conversation.findOne({
          _id: iD,
          participants: { $in: [socket.the_user._id] }
        }).populate('participants', 'name surname email photoURL');

        if (!conversation) {
          console.error('❌ Conversation non trouvée ou accès refusé');
          socket.emit('error', { message: 'Conversation non trouvée ou accès refusé' });
          return;
        }

        // Quitter les anciennes rooms de conversation
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith('conversation_')) {
            socket.leave(room);
            console.log(`👋 Utilisateur ${socket.the_user.name} a quitté ${room}`);
          }
        });
        
        const conversationRoom = `conversation_${iD}`;
        socket.join(conversationRoom);
        
        console.log(`👤 Utilisateur ${socket.the_user.name} a rejoint la conversation ${iD}`);
        
        // Notifier les autres participants
        socket.to(conversationRoom).emit('user_joined_conversation', {
          userId: socket.the_user._id,
          userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
          iD: iD,
          timestamp: new Date()
        });

        socket.emit('conversation_joined', {
          iD: iD,
          conversation: conversation,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('❌ Erreur lors de la connexion à la conversation:', error);
        socket.emit('error', { message: 'Erreur lors de la connexion à la conversation' });
      }
    });

    // Event: Quitter une conversation
    socket.on('leave_conversation', async (data) => {
      const { iD } = data;
      
      if (!iD) {
        socket.emit('error', { message: 'ID de conversation requis' });
        return;
      }

      try {
        await userToSave.updateOne({ lastLogin: Date.now() });

        const conversationRoom = `conversation_${iD}`;
        socket.leave(conversationRoom);
        
        console.log(`👋 Utilisateur ${socket.the_user.name} a quitté la conversation ${iD}`);
        
        socket.to(conversationRoom).emit('user_left_conversation', {
          userId: socket.the_user._id,
          userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
          iD: iD,
          timestamp: new Date()
        });

        socket.emit('conversation_left', {
          iD: iD,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('❌ Erreur lors de la déconnexion de la conversation:', error);
        socket.emit('error', { message: 'Erreur lors de la déconnexion de la conversation' });
      }
    });

    // Event: Créer une nouvelle conversation
    socket.on('create_conversation', async (data) => {
      const { participants = [], isGroup = false, groupName } = data;

      try {
        await userToSave.updateOne({ lastLogin: Date.now() });

        // Validation des participants
        if (!participants.length) {
          socket.emit('error', { message: 'Au moins un participant est requis' });
          return;
        }

        // Ajouter l'utilisateur actuel aux participants
        const allParticipants = [socket.the_user._id, ...participants.filter(p => p !== socket.the_user._id)];

        // Vérifier si les participants existent
        const validParticipants = await Admin.find({ 
          _id: { $in: allParticipants },
          isActivated: true,
          disabled: false
        });

        if (validParticipants.length !== allParticipants.length) {
          socket.emit('error', { message: 'Certains participants sont invalides' });
          return;
        }

        // Créer la conversation
        const newConversation = new Conversation({
          participants: allParticipants,
          isGroup: isGroup || allParticipants.length > 2,
          groupName: isGroup ? groupName : undefined,
          createdBy: socket.the_user._id,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newConversation.save();
        await newConversation.populate('participants');

        // Notifier tous les participants
        allParticipants.forEach(participantId => {
          internalNamespace.to(`user_${participantId}`).emit('new_conversation', {
            conversation: newConversation.toObject(),
            createdBy: socket.the_user._id,
            timestamp: new Date()
          });
        });

        const conversationRoom = `conversation_${newConversation._id}`;
        socket.join(conversationRoom);

        socket.emit('conversation_created', {
          conversation: newConversation.toObject(),
          timestamp: new Date()
        });

        console.log(`✅ Nouvelle conversation créée: ${newConversation._id}`);

      } catch (error) {
        console.error('❌ Erreur lors de la création de conversation:', error);
        socket.emit('error', { message: 'Erreur lors de la création de la conversation' });
      }
    });

    // Event: Envoyer un message dans une conversation
    socket.on('send_message', async (data) => {
      const { iD, message = {}, attachments } = data;

      if (!iD) {
        socket.emit('error', { message: 'ID de conversation requis' });
        return;
      }

      try {
        await userToSave.updateOne({ lastLogin: Date.now() });

        // Vérifier l'accès à la conversation
        const conversation = await Conversation.findOne({
          _id: iD,
          participants: { $in: [socket.the_user._id] }
        });

        if (!conversation) {
          console.error('❌ Conversation non trouvée ou accès refusé');
          socket.emit('error', { message: 'Conversation non trouvée ou accès refusé' });
          return;
        }

        const roomName = `conversation_${conversation._id}`;

        // Création du nouveau message
        const newMessage = new MiniChatMessage({
          senderId: socket.the_user._id,
          senderName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
          senderType: 'admin',
          conversation: iD,
          message: message.message || '',
        //   attachments: attachmentFile ? attachmentFile._id : null,
          isActivated: true,
          isDeleted: false,
          seen: false,
        });
            console.log('damiennnn', data)

        if (attachments) {
            
            console.log(attachments)
            const fileee = await File.find({_id: { $in: attachments }});
            if (fileee) {
                newMessage.attachments = fileee.map(fiiile => fiiile._id);
            }
        }

        await newMessage.save();
        await newMessage.populate('attachments');

        // Mettre à jour la conversation
        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        const plainMessage = newMessage.toObject();
        const conversationRoom = `conversation_${iD}`;

        // Envoyer le message à tous les participants dans la room
        internalNamespace.to(conversationRoom).emit('new_message', {
          message: plainMessage,
          iD: iD,
          namespace: 'internal_messaging'
        });

        // Envoyer aussi aux utilisateurs connectés mais pas forcément dans la room
        conversation.participants.forEach(participantId => {
          if (participantId.toString() !== socket.the_user._id.toString()) {
            internalNamespace.to(`user_${participantId}`).emit('new_conv_message', {
              conversation: {
                _id: conversation._id,
                lastMessage: plainMessage,
                updatedAt: conversation.updatedAt
              },
              userID: participantId.toString(),
              namespace: 'internal_messaging'
            });
          }
        });

        socket.emit('message_sent', {
          messageId: newMessage._id,
          iD: iD,
          timestamp: new Date()
        });

        console.log(`✅ Message envoyé par admin ${socket.the_user.name} dans conversation ${iD}`);

      } catch (error) {
        console.error('❌ Erreur lors de l\'envoi du message:', error);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Event: Marquer les messages comme lus
    socket.on('mark_as_read', async (data) => {
      const { iD } = data;

      if (!iD) {
        socket.emit('error', { message: 'ID de conversation requis' });
        return;
      }

      try {
        await userToSave.updateOne({ lastLogin: Date.now() });

        // Marquer les messages non lus de cette conversation comme lus
        const updateResult = await MiniChatMessage.updateMany(
          { 
            conversation: iD,
            senderId: { $ne: socket.the_user._id }, // Pas ses propres messages
            seen: false 
          },
          { 
            seen: true,
            seenAt: new Date()
          }
        );

        const conversationRoom = `conversation_${iD}`;
        socket.to(conversationRoom).emit('messages_read', {
          iD: iD,
          userId: socket.the_user._id,
          readCount: updateResult.modifiedCount
        });

        socket.emit('marked_as_read', {
          iD: iD,
          readCount: updateResult.modifiedCount,
          timestamp: new Date()
        });

        console.log(`✅ ${updateResult.modifiedCount} messages marqués comme lus par admin ${socket.the_user.name} pour conversation ${iD}`);

      } catch (error) {
        console.error('❌ Erreur lors du marquage comme lu:', error);
        socket.emit('error', { message: 'Erreur lors du marquage comme lu' });
      }
    });

    // Event: Supprimer un message
    socket.on('delete_message', async (data) => {
      const { iD, messageId } = data;

      if (!iD || !messageId) {
        socket.emit('error', { message: 'ID de conversation et ID de message requis' });
        return;
      }

      try {
        await userToSave.updateOne({ lastLogin: Date.now() });

        // Vérifier que le message appartient à l'utilisateur et qu'il est récent (5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const message = await MiniChatMessage.findOne({
          _id: messageId,
          conversation: iD,
          senderId: socket.the_user._id,
          createdAt: { $gte: fiveMinutesAgo },
          isDeleted: false
        });

        if (!message) {
          socket.emit('error', { message: 'Message non trouvé, non autorisé ou trop ancien' });
          return;
        }

        // Soft delete
        message.isDeleted = true;
        message.deletedAt = new Date();
        await message.save();

        const conversationRoom = `conversation_${iD}`;
        internalNamespace.to(conversationRoom).emit('message_deleted', {
          messageId: messageId,
          iD: iD,
          deletedBy: socket.the_user._id,
          timestamp: new Date()
        });

        socket.emit('message_deleted_confirm', {
          messageId: messageId,
          iD: iD,
          timestamp: new Date()
        });

        console.log(`🗑️ Message supprimé par admin ${socket.the_user.name}: ${messageId}`);

      } catch (error) {
        console.error('❌ Erreur lors de la suppression:', error);
        socket.emit('error', { message: 'Erreur lors de la suppression du message' });
      }
    });

    // Event: Indicateur de frappe
    socket.on('typing_start', async (data) => {
      const { iD } = data;
      if (iD) {
        const conversationRoom = `conversation_${iD}`;
        socket.to(conversationRoom).emit('user_typing', {
          userId: socket.the_user._id,
          userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
          iD: iD,
          isTyping: true,
          timestamp: new Date()
        });
      }
    });

    socket.on('typing_stop', async (data) => {
      const { iD } = data;
      if (iD) {
        const conversationRoom = `conversation_${iD}`;
        socket.to(conversationRoom).emit('user_typing', {
          userId: socket.the_user._id,
          userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
          iD: iD,
          isTyping: false,
          timestamp: new Date()
        });
      }
    });

    // Rejoindre une room personnelle pour les notifications
    socket.join(`user_${socket.the_user._id}`);

    // Event: Déconnexion
    socket.on('disconnect', async (reason) => {
      console.log(`🔌 Admin déconnecté de la messagerie interne: ${socket.the_user.name} (${reason})`);
      
      try {
        // Mettre à jour le dernier login
        await userToSave.updateOne({ lastLogin: Date.now() });

        // Notifier les autres de la déconnexion
        socket.to(generalRoom).emit('user_offline', {
          userId: socket.the_user._id,
          userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
          isOnline: false,
          timestamp: new Date()
        });

        // Quitter toutes les rooms de conversation
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room.startsWith('conversation_')) {
            const iD = room.replace('conversation_', '');
            socket.to(room).emit('user_left_conversation', {
              userId: socket.the_user._id,
              userName: `${socket.the_user.name} ${socket.the_user.surname || ''}`.trim(),
              iD: iD,
              timestamp: new Date()
            });
          }
        });

      } catch (error) {
        console.error('❌ Erreur lors de la déconnexion:', error);
      }
    });

    // Event: Gestion des erreurs
    socket.on('error', (error) => {
      console.error(`❌ Erreur socket admin ${socket.the_user.name}:`, error);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation de la connexion admin messagerie:', error);
    socket.emit('error', { message: 'Erreur lors de l\'initialisation de la messagerie' });
    socket.disconnect();
  }
};

module.exports = internalMessagingSocketRoutes;
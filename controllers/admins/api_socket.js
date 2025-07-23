const MiniChatMessage = require('@models/MiniChatMessage'); 
const Pharmacy = require('@models/Pharmacy'); 
const MiniChatAttachement = require('@models/MiniChatAttachement');

const {getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, registerActivity } = require('@tools/flutter_tools');

const adminSocketRoutes = async (socket, io) => {
  const the_admin = await getTheCurrentUserOrFailed({ body: { uid: socket.user.uid, type: 'admin' } }, null)

  if (the_admin.error) {
    socket.emit('error', { message: 'Erreur : L\'utilisateur n\'a pas été retrouvé !'});
    return;
  }
  
  socket.the_user = the_admin.the_user;
  socket.the_user.photoURL = socket.the_user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(socket.the_user.name || 'User')}&background=random&size=500`;
        
  socket.on('join_pharmacy_chat', async (data) => {
    const { pharmacyId } = data;
    
    try {
      // Quitter toutes les anciennes rooms de pharmacie
      const rooms = Array.from(socket.rooms);
      rooms.forEach(room => {
        if (room.startsWith('pharmacy_')) {
          socket.leave(room);
        }
      });
      
      const roomName = `pharmacy_${pharmacyId}`;
      socket.join(roomName);
      
      console.log(`👤 Admin ${socket.user.uid} a rejoint la conversation ${pharmacyId}`);
      
      socket.to(roomName).emit('user_joined', {
        userId: socket.user.uid,
        pharmacyId: pharmacyId,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('❌ Erreur lors de la connexion à la conversation:', error);
      socket.emit('error', { message: 'Erreur lors de la connexion à la conversation' });
    }
  });

  socket.on('leave_pharmacy_chat', (data) => {
    const { pharmacyId } = data;
    const roomName = `pharmacy_${pharmacyId}`;
    
    socket.leave(roomName);
    console.log(`👤 Admin ${socket.user.uid} a quitté la conversation ${pharmacyId}`);
    
    socket.to(roomName).emit('user_left', {
      userId: socket.user.uid,
      pharmacyId: pharmacyId,
      timestamp: new Date()
    });
  });

  socket.on('send_message', async (data) => {
    const { pharmacyId, message = {} } = data;

    try {
      const pharmacy = await Pharmacy.findOne({_id: pharmacyId});
      if (!pharmacy) {
        console.error('❌ Erreur : La pharmacie n\'existe pas');
        socket.emit('error', { message: 'Erreur : La pharmacie n\'existe pas'});
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
        senderId: message.senderId,
        senderName: message.senderName,
        senderType: message.senderType,
        for: pharmacy._id,
        message: message.message,
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

      // Log des informations de debug
      const roomsInfo = {};
      const allSockets = await io.in(roomName).fetchSockets();
      allSockets.forEach(s => {
        s.rooms.forEach(r => {
          if (r.startsWith('pharmacy_')) {
            if (!roomsInfo[r]) roomsInfo[r] = [];
            roomsInfo[r].push(s.user ? s.user.uid : 'unknown');
          }
        });
      });
      console.log('📋 Rooms et users:', roomsInfo);
      
      // Envoyer le message à toute la room
      io.in(roomName).emit('new_message', {
        message: plainMessage,
      });

    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi du message:', error);
      socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
    }
  });

  // Indicateur de frappe
  socket.on('typing', (data) => {
    const { pharmacyId, isTyping } = data;
    const roomName = `pharmacy_${pharmacyId}`;

    socket.to(roomName).emit('user_typing', {
      userId: socket.the_user._id,
      userName: socket.the_user.name,
      pharmacyId: pharmacyId,
      isTyping: isTyping
    });
  });

  // Marquer les messages comme lus
  socket.on('mark_as_read', async (data) => {
    const { pharmacyId } = data;

    try {
      // Marquer tous les messages de cette pharmacie comme lus pour cet admin
      await MiniChatMessage.updateMany(
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
        userId: socket.user.uid
      });

      console.log(`✅ Messages marqués comme lus par admin ${socket.user.uid} pour ${pharmacyId}`);

    } catch (error) {
      console.error('❌ Erreur lors du marquage comme lu:', error);
      socket.emit('error', { message: 'Erreur lors du marquage comme lu' });
    }
  });

  // Supprimer un message (admin uniquement)
  socket.on('delete_message', async (data) => {
    const { pharmacyId, messageId } = data;

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
      io.in(roomName).emit('message_deleted', {
        messageId: messageId,
        pharmacyId: pharmacyId,
        deletedBy: socket.user.uid
      });

      console.log(`🗑️ Message supprimé par admin ${socket.user.uid}: ${messageId}`);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
      socket.emit('error', { message: 'Erreur lors de la suppression du message' });
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`🔌 Admin déconnecté: ${socket.user.uid}`);
    
    const rooms = Array.from(socket.rooms);
    rooms.forEach(room => {
      if (room.startsWith('pharmacy_')) {
        const pharmacyId = room.replace('pharmacy_', '');
        socket.to(room).emit('user_left', {
          userId: socket.user.uid,
          pharmacyId: pharmacyId,
          timestamp: new Date()
        });
      }
    });
  });

  // Gestion des erreurs globales
  socket.on('error', (error) => {
    console.error(`❌ Erreur socket admin ${socket.user.uid}:`, error);
  });
};

module.exports = adminSocketRoutes;
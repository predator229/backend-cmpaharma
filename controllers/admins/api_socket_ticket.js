const Ticket = require('@models/Ticket');
const TicketMessage = require('@models/TicketMessage');
const TicketTemplate = require('@models/TicketTemplate');
const File = require('@models/File');
const Admin = require('@models/Admin');
const Pharmacy = require('@models/Pharmacy');

const { getUserInfoByUUID, getTheCurrentUserOrFailed, generateUserResponse, registerActivity } = require('@tools/flutter_tools');

const ticketSocketRoutes = async (socket, ticketNamespace) => {
  try {
    console.log(`🔌 Nouvelle connexion au namespace tickets: ${socket.user?.uid}`);

    // Vérification et récupération de l'utilisateur admin
    const the_admin = await getTheCurrentUserOrFailed({ body: { uid: socket.user.uid, type: 'admin' } }, null);
    if (the_admin.error || !the_admin.the_user) {
      console.error(`❌ Admin non trouvé: ${socket.user.uid}`);
      socket.emit('error', { message: 'Erreur : L\'utilisateur n\'a pas été retrouvé !' });
      socket.disconnect();
      return;
    }

    const user = the_admin.the_user;

    // Vérification des permissions pour les tickets
    const hasTicketPermission = user?.groups?.some(g =>
      ['manager_pharmacy', 'pharmacien', 'preparateur', 'caissier', 'consultant', 'admin'].includes(g.code)
    );

    if (!hasTicketPermission) {
      console.error(`❌ Utilisateur sans permission tickets: ${socket.user.uid}`);
      socket.emit('error', { message: 'Vous n\'avez pas les permissions pour accéder aux tickets' });
      socket.disconnect();
      return;
    }

    // Mettre à jour le dernier login
    const userToSave = await Admin.findById(user._id);
    if (!userToSave) {
      console.error(`❌ Utilisateur non trouvé en base: ${user._id}`);
      socket.emit('error', { message: 'L\'utilisateur n\'a pas été retrouvé en base de données !' });
      socket.disconnect();
      return;
    }
    userToSave.lastLogin = new Date();
    await userToSave.save();

    // Envoi de l'utilisateur connecté
    user.photoURL = user.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=random&size=500`;
    socket.emit('user', generateUserResponse(user));

    /**
     * 📩 Réception d’un message
     */
    socket.on('send_message', async (data) => {
      try {
        const { ticketId, message } = data;

        const ticket = await Ticket.findById(ticketId);
        if (!ticket) {
          return socket.emit('error', { message: 'Ticket non trouvé' });
        }

        let newMessage = null;
        if (message._id) {
          newMessage = await TicketMessage.findById(message._id);
        }

        // Création du message
        newMessage = newMessage !== null ?  await TicketMessage.create({
          ticketId,
          content: message.content,
          attachments: message.attachments || [],
          isInternal: message.isInternal || false,
          author: user._id,
        }) : newMessage;

        if (!newMessage._id) {
          await newMessage.save();
          ticket.messages.push(newMessage._id);
        }
        await newMessage.populate([
          { path: 'author' },
          { path: 'attachments' },
        ]);
        
        // MAJ du ticket (ex: lastUpdated, status)
        ticket.lastUpdated = new Date();
        if (message.isInternal !== true) {
          ticket.status = 'open';
        }
        await ticket.save();
        await ticket.populate([
          { path: 'createdBy'},
          { path: 'pharmacy'},
          { path: 'assignedTo._id'},
          { path: 'attachments' },
          {
            path: 'messages', 
            populate: ([
                { path: 'author'},
                { path: 'attachments' },

            ]),
            options: { sort: { createdAt: 1 } }
          }
        ]);

        newMessage.author.photoURL = newMessage.author.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(newMessage.author.name || 'User')}&background=random&size=500`;
        ticket.createdBy.photoURL = ticket.createdBy.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.createdBy.name || 'User')}&background=random&size=500`;
        if (ticket.assignedTo && ticket.assignedTo._id) {
          ticket.assignedTo._id.photoURL = ticket.assignedTo._id.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(ticket.assignedTo._id.name || 'User')}&background=random&size=500`;
        }

        if (Array.isArray(ticket.messages)) {
          ticket.messages = ticket.messages.map(message => {
            if (message && message.author) {
              message.author.photoURL = message.author.photoURL ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(message.author.name || 'User')}&background=random&size=500`;
            }
            return message;
          });
        }

        // Émettre à tous les utilisateurs du ticket
        ticketNamespace.emit('new_message', { message: newMessage });

        // Émettre la MAJ du ticket
        ticketNamespace.emit('ticket_updated', { ticket });
      } catch (err) {
        console.error('Erreur send_message:', err);
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    /**
     * ✅ Marquer un message comme lu
     */
    socket.on('mark_message_read', async ({ ticketId, messageId }) => {
      try {
        const message = await TicketMessage.findById(messageId);
        if (!message) return;

        // if (!message.readBy.includes(user._id)) {
        //   message.readBy.push(user._id);
        //   await message.save();
        // }

        ticketNamespace.emit('message_read', {
          ticketId,
          messageId,
          readBy: user._id
        });
      } catch (err) {
        console.error('Erreur mark_message_read:', err);
        socket.emit('error', { message: 'Erreur lors de la lecture du message' });
      }
    });

    /**
     * 🎫 Création de ticket (optionnel : à connecter avec createTicket si appelé depuis API)
     * Tu peux déclencher :
     * ticketNamespace.emit('ticket_created', { ticket });
     */

    // (Optionnel) Déconnexion
    socket.on('disconnect', () => {
      console.log(`🔌 Déconnexion du namespace tickets: ${socket.user?.uid}`);
    });

  } catch (error) {
    console.error('Erreur ticketSocketRoutes:', error);
    socket.emit('error', { message: 'Erreur interne du serveur' });
    socket.disconnect();
  }
};

module.exports = ticketSocketRoutes;

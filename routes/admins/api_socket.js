require('module-alias/register');
const { authentificateUser, refreshUser, addMobil, addCard, removeMobil, editProfil, getDefaultParams,} = require('@controllers/delivers/api');
  
const connectedUsers = new Map(); 
  
  module.exports = (socket) => {
    const userId = socket.user.uid;
    connectedUsers.set(userId, socket.id);
  
    console.log(`✅ [Socket] ${userId} connecté via socket ${socket.id}`);
  
    // Gestion des routes socket
    socket.on('users:authentificate', (data, cb) => authentificateUser(socket, data, cb));
    socket.on('users:refresh', (data, cb) => refreshUser(socket, data, cb));
    socket.on('settings:get-default-params', (data, cb) => getDefaultParams(socket, data, cb));
    socket.on('users:edit-profil', (data, cb) => editProfil(socket, data, cb));
    socket.on('users:add-mobil', (data, cb) => addMobil(socket, data, cb));
    socket.on('users:add-card', (data, cb) => addCard(socket, data, cb));
    socket.on('users:remove-mobil', (data, cb) => removeMobil(socket, data, cb));
  
    // Ping de présence
    socket.on('user:online', (_, cb) => {
      console.log(`🟢 ${userId} est actif`);
      cb?.({ success: true });
    });
  
    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      console.log(`❌ [Socket] ${userId} s’est déconnecté`);
    });
  
    socket.on('users:get-connected', (data, cb) => {
      const list = Array.from(connectedUsers.entries());
      cb?.({ success: true, users: list });  
    });
  };
  
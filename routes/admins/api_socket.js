require('module-alias/register');
const { authentificateUser, refreshUser, addMobil, addCard, removeMobil, editProfil, getDefaultParams,} = require('@controllers/admins/api_socket');
  
const connectedUsers = new Map(); 
  
  module.exports = (socket) => {
    const userId = socket.user.uid;
    connectedUsers.set(userId, socket.id);
  
    console.log(`✅ [Socket] ${userId} connecté via socket ${socket.id}`);
  
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


    socket.on('users:remove-mobil', (data, cb) => removeMobil(socket, data, cb));


  };
  
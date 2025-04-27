const mongoose = require('mongoose');

const pharmacySchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    workingHours: { type: String, required: true },  // Horaires d'ouverture
    geoLocation: { 
        type: { 
            lat: { type: Number, required: true }, 
            long: { type: Number, required: true } 
        }, 
        required: true 
    }, 
    deliveryarea: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Pharmacy', pharmacySchema);

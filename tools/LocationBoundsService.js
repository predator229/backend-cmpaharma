const axios = require('axios');

class LocationBoundsService {
  constructor() {
    this.geocodeCache = new Map();
    this.boundsCache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000;
  }
  async isLocationInCityBounds(pharmacie, location) {
    try {

      const { city, country } = pharmacie;
    const { latitude, longitude } = location;

    if (typeof country.name !== 'string') { throw new Error('Paramètres invalides 11'); }
    if (!city || !country || typeof city !== 'string' || typeof country.name !== 'string') { throw new Error('Paramètres invalides 1'); }
    if (!city || !country || typeof city !== 'string' || typeof country.name !== 'string') { throw new Error('Paramètres invalides 1'); }
    if (!city || !country || typeof city !== 'string' || typeof country.name !== 'string') { throw new Error('Paramètres invalides 1'); }
    if (!city || !country || typeof city !== 'string' || typeof country.name !== 'string') { throw new Error('Paramètres invalides 1'); }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') { throw new Error('Paramètres invalides 2'); }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { throw new Error('Paramètres invalides 3');}



      if (!this.validateInputs(pharmacie, location)) {
        throw new Error('Paramètres invalides');
      }

      // const { city, country } = pharmacie;
      // const { latitude, longitude } = location;

      const cityInfo = await this.getCityInfo(city, country);
      
      if (!cityInfo) {
        return {
          isInBounds: false,
          error: 'Ville non trouvée',
          distance: null,
          cityCenter: null
        };
      }

      const distance = this.calculateDistance(
        latitude, longitude,
        cityInfo.lat, cityInfo.lng
      );

      const isInBounds = distance <= cityInfo.radius;

      return {
        isInBounds,
        distance: Math.round(distance * 100) / 100,
        cityCenter: {
          lat: cityInfo.lat,
          lng: cityInfo.lng
        },
        cityRadius: cityInfo.radius,
        cityName: cityInfo.name
      };

    } catch (error) {
      console.error('Erreur dans isLocationInCityBounds:', error.message);
      return {
        isInBounds: false,
        error: error.message,
        distance: null,
        cityCenter: null
      };
    }
  }

  validateInputs(pharmacie, location) {
    if (!pharmacie || !location) return false;
    
    const { city, country } = pharmacie;
    const { latitude, longitude } = location;

    if (!city || !country || typeof city !== 'string' || typeof country.name !== 'string') { return false; }

    if (typeof latitude !== 'number' || typeof longitude !== 'number') { return false; }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) { return false;}

    return true;
  }

  async getCityInfo(city, country) {
    const cacheKey = `${city.toLowerCase()}_${country.name.toLowerCase()}`;
    
    if (this.boundsCache.has(cacheKey)) {
      const cached = this.boundsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const cityInfo = await this.getCityInfoFromNominatim(city, country);
      
      if (cityInfo) {
        this.boundsCache.set(cacheKey, {
          data: cityInfo,
          timestamp: Date.now()
        });
        return cityInfo;
      }

      return await this.getCityInfoFallback(city, country);

    } catch (error) {
      console.error('Erreur lors de la récupération des infos de ville:', error);
      return null;
    }
  }

  async getCityInfoFromNominatim(city, country) {
    const query = `${city}, ${country.name}`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`;

    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'PharmacieApp/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        
        let radius = 10;
        
        if (result.boundingbox) {
          const [south, north, west, east] = result.boundingbox.map(parseFloat);
          
          const diagonal = this.calculateDistance(
            parseFloat(south), parseFloat(west),
            parseFloat(north), parseFloat(east)
          );
          
          radius = Math.max(5, Math.min(50, diagonal / 2));
        }

        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          radius: radius,
          name: result.display_name,
          type: result.type
        };
      }
    } catch (error) {
      console.error('Erreur Nominatim:', error.message);
    }

    return null;
  }

  async getCityInfoFallback(city, country) {
    const coords = await this.geocodeCity(city, country);
    
    if (!coords) return null;

    let radius = 10;
    
    const cityLower = city.toLowerCase();
    
    const majorCities = ['paris', 'london', 'berlin', 'madrid', 'rome', 'moscow', 'tokyo'];
    if (majorCities.includes(cityLower)) {
      radius = 30;
    } else if (city.length > 10) {
      radius = 15;
    } else if (city.length < 5) {
      radius = 8; 
    }

    return {
      lat: coords.lat,
      lng: coords.lng,
      radius: radius,
      name: `${city}, ${country.name}`,
      type: 'estimated'
    };
  }
  async geocodeCity(city, country) {
    const cacheKey = `geocode_${city.toLowerCase()}_${country.name.toLowerCase()}`;
    
    if (this.geocodeCache.has(cacheKey)) {
      const cached = this.geocodeCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const query = `${city}, ${country.name}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'PharmacieApp/1.0'
        }
      });

      if (response.data && response.data.length > 0) {
        const result = {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon)
        };

        this.geocodeCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        return result;
      }
    } catch (error) {
      console.error('Erreur de géocodage:', error.message);
    }

    return null;
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  clearCache() {
    this.geocodeCache.clear();
    this.boundsCache.clear();
  }
}

module.exports = LocationBoundsService;
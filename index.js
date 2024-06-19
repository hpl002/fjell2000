const csv = require('csvtojson');
const utm = require('utm');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// data sourced from https://no.wikipedia.org/wiki/Liste_over_fjelltopper_i_Norge_med_prim%C3%A6rfaktor_30_meter_pluss
// copy paste into Excel, Numbers, or alternative. Export to csv.

const helpers = {

    markdown: {
        // for writing top level index

        mainIndex: () => {
            throw new Error('Not implemented');
        }

        // need to produce dedicated files for each peak
        // need to merge content of any of these files have something pre-existing
        // each page can have a set number of properties, which we then merge

    },

    convertUTMToDecimal: (utmStr) => {
        const [easting, northing] = utmStr.split(' ').map(Number);
        const zoneNumber = 32;
        const zoneLetter = 'V'; // Hardcoding based on the example

        const { latitude, longitude } = utm.toLatLon(easting, northing, zoneNumber, zoneLetter);

        // Format to five decimal places
        const formattedLatitude = latitude.toFixed(5);
        const formattedLongitude = longitude.toFixed(5);

        return `${formattedLatitude}, ${formattedLongitude}`;
    },

    loadCsv: async () => {
        try {
            const jsonArray = await csv({
                delimiter: ';',
                trim: true
            }).fromFile(path.join(__dirname, 'fjell.csv'));

            return jsonArray
        } catch (err) {
            console.error('Error converting CSV to JSON:', err);
        }
    },

    sourceCsv: async () => {
        throw new Error('Not implemented. Source from https://no.wikipedia.org/wiki/Liste_over_fjelltopper_i_Norge_med_prim%C3%A6rfaktor_30_meter_pluss');
    },

    write: (jsonArray) => {
        fs.writeFileSync(path.join(__dirname, 'fjell.json'), JSON.stringify(jsonArray, null, 2));
    },

    addNorgeskart: (entries) => {
        const newUrl = (coordinates) => {
            const baseUrl = "https://www.norgeskart.no/#!?project=norgeskart&layers=1002&zoom=13&lat=6851883.63&lon=146002.11&markerLat=6851883.634396978&markerLon=146002.11011350987&p=searchOptionsPanel";
            const urlEncodedCoordinates = encodeURIComponent(coordinates);
            const modifiedUrl = `${baseUrl}&sok=${urlEncodedCoordinates}`;
            return modifiedUrl;
        };

        entries.map((entry) => {
            entry.norgesKart = newUrl(entry.coordinates.DMS)
            return { ...entry };
        });
    },

    addGaiaGpsUrl: (entries) => {
        const newUrl = ({ longitude, latitude }) => {
            const baseUrl = "https://www.gaiaGPS.com/map/?loc=16.0";
            return `${baseUrl}/${longitude}/${latitude}`
        };

        entries.map((entry) => {
            entry.gaiaGPS = newUrl({...entry.coordinates});
            return { ...entry };
        });
    },

    addLongitudeLatitude: (entries) => {
        const convert = (utmStr) => {
            const [easting, northing] = utmStr.split(' ').map(Number);
            const zoneNumber = 32;
            const zoneLetter = 'V'; // Hardcoding based on the example

            const res = utm.toLatLon(easting, northing, zoneNumber, zoneLetter);
            return { latitude: res.latitude.toFixed(5), longitude: res.longitude.toFixed(5) }
        };

        entries.map((entry) => {
            entry.coordinates = { ...entry.coordinates ,...convert(entry.coordinates.UTM) }
            return { ...entry };
        });

    },

    addLocationSpecifics: (entries) => {
        // TODO: research kartverket APIs
        entries.map((entry) => {
            entry["county"] = null
            entry["commune"] = null
            entry["nationalPark"] = null
        });
    },

    addGroup: (entries) => {

        entries.map((entry) => {
            entry.group = null;
            return { ...entry };
        })
    },

    translate: (entries) => {
        entries.map((entry) => {
            entry.name = entry.Navn
            delete entry.Navn
            entry["MASL"] = entry.Moh
            delete entry.Moh
            entry.map = entry["Kartblad M711"]
            delete entry["Kartblad M711"]
            entry.coordinates = {
                DMS: entry["Koordinater grad, min, sek"],
                UTM: entry["Koordinater UTM 32V"],
                longitude: null,
                latitude: null,
            }
            delete entry["Koordinater grad, min, sek"];
            delete entry["Koordinater UTM 32V"]
            return { ...entry };
        })
    },

    deleteProps: (entries) => {
        entries.map((entry) => {
            //delete entry["Koordinater UTM 32V"]
            delete entry.Index
            return { ...entry };
        })
    },

    addUid: (entries) => {
        function createHash(input) {
            return crypto.createHash('sha256').update(input).digest('hex');
        }
        entries.map((entry) => {
            entry.uid = createHash(entry.coordinates.UTM.trim())
            return { ...entry };
        })
    }
};


(async function () {
    const entries = await helpers.loadCsv();
    helpers.deleteProps(entries);
    helpers.translate(entries);
    helpers.addUid(entries);
    helpers.addLongitudeLatitude(entries);
    helpers.addNorgeskart(entries);
    helpers.addGaiaGpsUrl(entries);
    helpers.addGroup(entries);
    helpers.addLocationSpecifics(entries);
    helpers.write(entries);
})();


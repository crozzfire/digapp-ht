/**
 * Common transform functions used.
 */

/* globals _ */
/* exported commonTransforms */
/* jshint camelcase:false */

/* note lodash should be defined in parent scope */
var commonTransforms = (function(_) {

  function getGeoFromKeys(record) {
    var geos = [];
    _.each(record, function(key) {
      var geoData = key.key.split(':');
      /* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
      var geo = {
        city: geoData[0],
        state: geoData[1],
        country: geoData[2],
        longitude: geoData[3],
        latitude: geoData[4],
        count: key.doc_count,
        name: geoData[0] + ', ' + geoData[1]
      };
      /* jscs:enable requireCamelCaseOrUpperCaseIdentifiers */
      geos.push(geo);
    });
    return geos;
  }

  /**
  * Changes the key/value names of buckets given from an aggregation
  * to names preferred by the user.
  */
  function transformBuckets(buckets, keyName, alternateKey) {
    buckets = _.map(buckets, function(bucket) {
      /* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
      var obj = {
        count: bucket.doc_count
      };
      /* jscs:enable requireCamelCaseOrUpperCaseIdentifiers */
      if(alternateKey) {
        obj[keyName] = bucket[alternateKey];
      } else {
        obj[keyName] = bucket.key;
      }
      return obj;
    });
    return buckets;
  }

  return {
    /**
    * Changes the key/value names of buckets given from an aggregation
    * to names preferred by the user.
    */
    transformBuckets: function(buckets, keyName, alternateKey) {
      return transformBuckets(buckets, keyName, alternateKey);
    },

    /**
        Get people aggregation info:

        "features": [
            {"key": "Emily", "count": 14},
            {"key": "Erin", "count": 12},
            {"key": "Jane", "count": 3}
        ]
    */
    peopleFeatures: function(data) {
      /* jscs:disable requireCamelCaseOrUpperCaseIdentifiers */
      return {
        features: transformBuckets(data.aggregations.people_features.buckets, 'key')
      };
      /* jscs:enable requireCamelCaseOrUpperCaseIdentifiers */
    },

    /**
        "locations": [
            {
                "city": "hawthorn",
                "state": "california",
                "latitude": 33.916403,
                "longitude": -118.352575,
                "date": "2012-04-23T18:25:43.511Z"
            }
        ]
    */
    getLocations: function(hits) {
      var locations = [];
      _.each(hits, function(hit) {
        var location = hit._source.availableAtOrFrom;
        if(location) {

          _.each(location.address, function(address) {
            locations.push({
              city: address.addressLocality,
              state: address.addressRegion,
              latitude: address.geo ? _.get(address, 'geo.latitude') : undefined,
              longitude: address.geo ? _.get(address, 'geo.longitude') : undefined,
              date: hit._source.validFrom
            });
          });
        }
      });

      return locations;
    },

    /** build address object:
    "address": {
        "locality": "Los Angeles",
        "region": "California",
        "formattedAddress": 'Los Angeles, California'
    }
    */
    getAddress: function(record) {
      var address = {};
      address.locality = _.get(record, 'availableAtOrFrom.address[0].addressLocality');
      address.region = _.get(record, 'availableAtOrFrom.address[0].addressRegion');

      var formattedAddress = [];
      if(address.locality) {
        formattedAddress.push(address.locality);
      }

      if(address.region) {
        if(formattedAddress.length > 0) {
          formattedAddress.push(', ');
        }
        formattedAddress.push(address.region);
      }

      address.formattedAddress = formattedAddress.join('');

      if(_.isEmpty(address.formattedAddress)) {
        address.formattedAddress = 'Address N/A';
      }

      return address;
    },

    /** build an array of strings:
        example: ["1112223333", "0123456789"]
    */
    getArrayOfStrings: function(record, pathToArray, pathToString) {
      var arrayToReturn = [];
      var initialArray = _.get(record, pathToArray, []);

      initialArray.forEach(function(element) {
        arrayToReturn.push(_.get(element, pathToString));
      });

      return arrayToReturn;
    },

    getClickableObjectArr: function(records, type) {
      var result = [];
      if(records) {
        if(records.constructor === Array) {
          records.forEach(function(record) {
            if(record.name) {
              var obj = {
                _id: record.uri,
                _type: type,
                title: type === 'email' ? decodeURIComponent(record.name) : record.name,
                descriptors: []
              };
              result.push(obj);
            }
          });
        } else {
          var obj = {
            _id: records.uri,
            _type: type,
            title: type === 'email' ? decodeURIComponent(records.name) : records.name,
            descriptors: []
          };
          result.push(obj);
        }
      }

      return result;
    },

    offerLocationData: function(data) {
      var newData = {};

      if(data.hits.hits.length > 0) {
        var aggs = data.aggregations;
        newData.offerLocation = getGeoFromKeys(aggs.phone.city.buckets);
      }

      return newData;
    },

    getSellerId: function(record) {
      var sellerId = '';
      if(record.owner) {

        if(_.isArray(record.owner)) {
          //phone will have one seller
          sellerId = record.owner[0].uri;
        } else {
          sellerId = record.owner;
        }

      }

      return sellerId;
    },

    getEmailAndPhoneFromMentions: function(mentions) {
      var newData = {};
      newData.phones = [];
      newData.emails = [];

      if(mentions) {
        mentions.forEach(function(elem) {
          var type = 'none';
          if(elem.indexOf('phone') !== -1) {
            type = 'phone';
          } else if(elem.indexOf('email') !== -1) {
            type = 'email';
          }
          if(type !== 'none') {
            var idx = elem.lastIndexOf('/');
            var text = elem.substring(idx + 1);
            var countryCode = '';
            if(type === 'phone') {
              if(text.indexOf('-') !== -1) {
                var idx2 = text.indexOf('-');
                text = text.substring(idx2 + 1);
                var cc = text.substring(0,idx2);
                if(cc.length < 5) {
                  countryCode = cc;
                }
              }
            }
            var newObj = {
              _id: elem,
              _type: type,
              title: type === 'email' ? decodeURIComponent(text) : text,
              descriptors: []
            };
            if(type === 'phone') {
              newData.phones.push(newObj);
            }
            if(type === 'email') {
              newData.emails.push(newObj);
            }
          }
        });
      }
      return newData;
    },

    makeJSONArray: function(val1, val2) {
      return [val1, val2];
    }
  };
})(_);

/*jshint node: true */
'use strict';

const Boom = require('@hapi/boom');
const Hawk = require('@hapi/hawk');
const Joi = require('@hapi/joi');
const http = require('http');
const EventEmitter = require('events');
const https = require('https');
const Url = require('url');

const appSchema = Joi.object().keys({
  id: Joi.string().required(),
  key: Joi.string().required(),
  algorithm: Joi.string().allow(['sha1', 'sha256']).default('sha256')
});


module.exports = {

  events: new EventEmitter(),

  app: {
    id: process.env.BPC_APP_ID,
    key: process.env.BPC_APP_KEY,
    algorithm: process.env.BPC_ALGORITHM || 'sha256'
  },


  url: process.env.BPC_URL || 'https://bpc.berlingskemedia.net',
  
  
  appTicket: null,


  ticketBuffer: 1000 * 30, // 30 seconds


  errorTimeout: 1000 * 60 * 5, // Five minutes


  request: async(options, credentials) => {

    const url = Url.parse(module.exports.url);

    const newOptions = {
      ...url,
      ...options,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  
    // In case we want a request completely without any credentials, use {} as the credentials parameter to this function
    credentials = credentials || module.exports.appTicket || null;

    if (credentials !== null && typeof credentials === 'object' && Object.keys(credentials).length > 1){
      var requestHref = Url.resolve(url.href, newOptions.path);
  
      var hawkHeader = Hawk.client.header(requestHref, newOptions.method || 'GET', {credentials: credentials, app: credentials.app || module.exports.app.id});
      if (hawkHeader.err) {
        return new Error('Hawk header: ' + hawkHeader.err);
      }
  
      newOptions.headers['Authorization'] = hawkHeader.header;
    }
  
    return new Promise((resolve, reject) => {
      var reqHandler = https;
      if (newOptions.protocol === 'http:') {
        reqHandler = http;
      }
    
      var req = reqHandler.request(newOptions);
    
      if (newOptions.payload) {
        if (typeof newOptions.payload === 'object'){
          req.write(JSON.stringify(newOptions.payload));
        } else {
          req.write(newOptions.payload);
        }
      }
    
      req.end();

      req.on('response', function(response) {
        var data = '';
    
        response.on('data', function(chunk) {
          data = data + chunk;
        });
    
        response.on('end', function () {
          if (data.length > 0){
            try {
              data = JSON.parse(data);
            } catch(ex) {
              // to nothing
            }
          }
    
          if (response.statusCode > 300) {
            const err = new Error(data.message || data || 'Unknown error');
            reject(Boom.boomify(err, { statusCode: response.statusCode }));
          } else {
            resolve(data);
          }
        });
      });
    
      req.on('error', function (err) {
        reject(err);
      });  
    });
  },


  getAppTicket: async() => {
    try {
      const result = await module.exports.request({ path: '/ticket/app', method: 'POST' }, module.exports.app);
      module.exports.appTicket = result;
      module.exports.events.emit('appticket');
      setTimeout(module.exports.reissueAppTicket, result.exp - Date.now() - module.exports.ticketBuffer);
      return result;
    } catch(ex) {
      console.error(ex);
      setTimeout(module.exports.getAppTicket, module.exports.errorTimeout);
      return module.exports.appTicket = null;
    }
  },


  reissueAppTicket: async() => {
    try {
      const result = await module.exports.request({ path: '/ticket/reissue', method: 'POST' }, module.exports.appTicket);
      module.exports.appTicket = result;
      module.exports.events.emit('appticket');
      setTimeout(module.exports.reissueAppTicket, result.exp - Date.now() - module.exports.ticketBuffer);
      return result;
    } catch(ex) {
      console.error(ex);
      setTimeout(module.exports.getAppTicket, module.exports.errorTimeout);
      return module.exports.appTicket = null;
    }
  },


  connect: async(app, url) => {

    const newApp = {
      ...module.exports.app,
      ...app,
    };

    const appValidateResult = Joi.validate(newApp, appSchema);
    if(appValidateResult.error) {
      throw appValidateResult.error;
    }

    module.exports.app = newApp;

    const newUrl = url || module.exports.url;

    try {
      Url.parse(newUrl);
    } catch (ex) {
      throw new Error('BPC URL missing or invalid');
    }
    
    module.exports.url = newUrl;
    
    const result = await module.exports.getAppTicket();
    if(result) {
      module.exports.events.emit('ready');
    }
  },

  boom: Boom,

  hawk: Hawk,

  joi: Joi

};

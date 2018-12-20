/*jshint node: true */
'use strict';

const Boom = require('boom');
const Hawk = require('hawk');
const Joi = require('joi');
const http = require('http');
const EventEmitter = require('events');
const https = require('https');
const Url = require('url');

const appSchema = Joi.object().keys({
  id: Joi.string(),
  key: Joi.string(),
  algorithm: Joi.string().allow(['sha256']) // Must find out what other values are allowed
});

module.exports = {


  app: {},


  appTicket: null,


  events: new EventEmitter(),


  url: Url.parse('https://berlingskemedia.net'),


  ticketBuffer: 1000 * 10, // Ten seconds


  errorTimeout: 1000 * 60 * 5, // Five minutes


  async request(options, credentials) {

    return new Promise((resolve, reject) => {
      Object.assign(options, {
        protocol: module.exports.url.protocol,
        hostname: module.exports.url.hostname,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    
      if (module.exports.url.port){
        options.port = module.exports.url.port;
      }
    
      // In case we want a request completely without any credentials, use {} as the credentials parameter to this function
      if (!credentials){
        credentials = module.exports.appTicket;
      }
    
      if (typeof credentials === 'object' && Object.keys(credentials).length > 1){
        var requestHref = Url.resolve(module.exports.url.href, options.path);
    
        var hawkHeader = Hawk.client.header(requestHref, options.method || 'GET', {credentials: credentials, app: module.exports.app.id});
        if (hawkHeader.err) {
          return reject(new Error('Hawk header: ' + hawkHeader.err));
        }
    
        options.headers['Authorization'] = hawkHeader.header;
      }
    
      var reqHandler = https;
      if (options.protocol === 'http:') {
        reqHandler = http;
      }
    
      var req = reqHandler.request(options);
    
      if (options.payload) {
        if (typeof options.payload === 'object'){
          req.write(JSON.stringify(options.payload));
        } else {
          req.write(options.payload);
        }
      }
    
      req.end();

      req.on('response', function(response) {
        var data = '';
        var data_org = '';
    
        response.on('data', function(chunk) {
          data = data + chunk;
          data_org = data;
        });
    
        response.on('end', function () {
          if (data.length > 0){
            data = JSON.parse(data);
          }
    
          if (response.statusCode > 300) {
            const err = new Error(data.message || data_org);
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


  async getAppTicket() {
    try {
      const result = await module.exports.request({ path: '/ticket/app', method: 'POST' }, module.exports.app);
      module.exports.appTicket = result;
      module.exports.events.emit('appticket');
      setTimeout(module.exports.reissueAppTicket, result.exp - Date.now() - module.exports.ticketBuffer);
      return;
    } catch(ex) {
      console.error(ex);
      setTimeout(module.exports.getAppTicket, module.exports.errorTimeout);
      return module.exports.appTicket = null;
    }
  },


  async reissueAppTicket() {
    try {
      const result = await module.exports.request({ path: '/ticket/reissue', method: 'POST' }, module.exports.appTicket);
      module.exports.appTicket = result;
      module.exports.events.emit('appticket');
      setTimeout(module.export.reissueAppTicket, result.exp - Date.now() - module.exports.ticketBuffer);
      return;
    } catch(ex) {
      console.error(ex);
      setTimeout(module.export.getAppTicket, module.exports.errorTimeout);
      return module.exports.appTicket = null;
    }
  },


  async connect(app, url) {

    app = app || {
      id: process.env.BPC_APP_ID,
      key: process.env.BPC_APP_SECRET,
      algorithm: process.env.BPC_APP_ALGORITHM || 'sha256'
    };

    const appValidateResult = Joi.validate(app, appSchema);
    if(appValidateResult.error) {
      throw appValidateResult.error;
    }

    module.exports.app = app;

    const _url = url || process.env.BPC_URL;
    if(_url) {
      try {
        module.exports.url = Url.parse(_url);
      } catch (ex) {
        throw new Error('BPC URL missing or invalid');
      }
    }
    
    const result = await module.exports.getAppTicket();
    if(result) {
      module.exports.events.emit('ready');
      return Promise.resolve();
    }
  }
}

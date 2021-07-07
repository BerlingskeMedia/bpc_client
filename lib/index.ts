import Boom from '@hapi/boom';
import Hawk from '@hapi/hawk';
import Joi from 'joi';
import fetch, { Response } from 'node-fetch';
import { EventEmitter } from 'events';
import Url from 'url';
// @types/node  ^14.17.4  →  ^16.0.0
// babel-jest    ^26.6.3  →  ^27.0.6
// jest          ^26.6.3  →  ^27.0.6
export type AllowedAlgorithms = 'sha1' | 'sha256';

const appSchema = Joi.object().keys({
  id: Joi.string().required(),
  key: Joi.string().required(),
  algorithm: Joi.string().allow('sha1', 'sha256').default('sha256'),
});

export interface AppTicket {
  app?: string;
  id: string;
  key: string;
  exp?: number;
  scope?: string[];
  algorithm: AllowedAlgorithms;
}

export interface BpcClient {
  events: EventEmitter;
  app: AppTicket;
  url: string;
  appTicket: AppTicket | null;
  ticketBuffer: number;
  errorTimeout: number;
  request: (options: unknown, credentials?: AppTicket) => Promise<any>;
  getAppTicket: () => Promise<AppTicket>;
  reissueAppTicket: () => Promise<AppTicket>;
  connect: (app?: AppTicket, url?: string) => Promise<void>;
  boom: unknown,
  hawk: unknown,
  joi: unknown,
}

const client: BpcClient = {
  events: new EventEmitter(),
  app: {
    id: process.env.BPC_APP_ID || '',
    key: process.env.BPC_APP_KEY || '',
    algorithm: (process.env.BPC_ALGORITHM as AllowedAlgorithms) || 'sha256',
  },
  url: process.env.BPC_URL || 'https://bpc.berlingskemedia.net',
  appTicket: null,
  ticketBuffer: 1000 * 30, // 30 seconds
  errorTimeout: 1000 * 60 * 5, // Five minutes

  request: async (options: any, credentials?: AppTicket): Promise<any> => {
    const parsedUrl = Url.parse(module.exports.url);
    const newOptions = {
      ...parsedUrl,
      ...options,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // In case we want a request completely without any credentials,
    // use {} as the credentials parameter to this function
    const appTicket: AppTicket | null = credentials || module.exports.appTicket || null;

    if (appTicket !== null && typeof appTicket === 'object' && Object.keys(appTicket).length > 1) {
      const requestHref = Url.resolve(parsedUrl.href, newOptions.path || '');
      let hawkHeader;
      try {
        hawkHeader = Hawk.client.header(
          requestHref,
          newOptions.method || 'GET',
          { credentials: appTicket, app: appTicket.app || module.exports.app.id },
        );
      } catch (e) {
        return new Error(`Hawk header: ${e.message}`);
      }

      if (!newOptions.headers) {
        newOptions.headers = {};
      }
      newOptions.headers.Authorization = hawkHeader.header;
    }

    if (newOptions.payload) {
      if (typeof newOptions.payload === 'object') {
        newOptions.body = JSON.stringify(newOptions.payload);
      } else {
        newOptions.body = newOptions.payload;
      }
    }
    const response: Response = await fetch(module.exports.url, newOptions);
    if (!response.ok) {
      const err = new Error(response.statusText || 'Unknown error');
      throw Boom.boomify(err, { statusCode: response.status, data: response.body });
    }
    const data: any = await response.json();

    return data;
  },

  getAppTicket: async (): Promise<AppTicket> => {
    try {
      const result = await module.exports.request({ path: '/ticket/app', method: 'POST' }, module.exports.app);
      module.exports.appTicket = result;
      module.exports.events.emit('appticket');
      setTimeout(() => module.exports.reissueAppTicket(), result.exp - Date.now() - module.exports.ticketBuffer);
      return result;
    } catch (ex) {
      console.error(ex);
      setTimeout(() => module.exports.getAppTicket(), module.exports.errorTimeout);
      module.exports.appTicket = null;
      return module.exports.appTicket;
    }
  },

  reissueAppTicket: async (): Promise<AppTicket> => {
    try {
      const result = await module.exports.request(
        { path: '/ticket/reissue', method: 'POST' },
        module.exports.appTicket,
      );
      module.exports.appTicket = result;
      module.exports.events.emit('appticket');
      setTimeout(() => module.exports.reissueAppTicket(), result.exp - Date.now() - module.exports.ticketBuffer);
      return result;
    } catch (ex) {
      console.error(ex);
      setTimeout(() => module.exports.getAppTicket(), module.exports.errorTimeout);
      module.exports.appTicket = null;
      return module.exports.appTicket;
    }
  },

  connect: async (app: AppTicket = client.app, url?: string): Promise<void> => {
    const newApp = {
      ...module.exports.app,
      ...app,
    };

    const appValidateResult = appSchema.validate(newApp);
    if (appValidateResult.error) {
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
    if (result) {
      module.exports.events.emit('ready');
    }
  },

  boom: Boom,

  hawk: Hawk,

  joi: Joi,

};

export default client;
module.exports = client;

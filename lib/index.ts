import Boom from '@hapi/boom';
import Hawk from '@hapi/hawk';
import Joi from 'joi';
import fetch, { RequestInit, Response } from 'node-fetch';
import { EventEmitter } from 'events';
import { URL } from 'url';
import timeoutSignal from 'timeout-signal';

export type AllowedAlgorithms = 'sha1' | 'sha256';
export type RequestMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT' | string; // string for backward compatibility

function getRequestHref(options: BpcRequestOptions, defaultUrl = ''): string {
  const DEFAULT_PROTOCOL = 'https:';
  const port = options.port ? `:${options.port}` : '';
  const base = options.origin
    || (options.host ? `${options.host}${port}` : '')
    || (options.hostname ? `${options.protocol || DEFAULT_PROTOCOL}//${options.hostname}${port}` : '')
    || defaultUrl;
  // backwards compatibility with legacy 'url'
  const pathname = options.pathname || options.path || '';

  return options.href || (new URL(pathname, base)).href;
}

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

export interface RsvpPayload {
  app: string;
  returnUrl?: string;
  // Gigya
  UID?: string;
  UIDSignature?: string;
  signatureTimestamp?: string;
  // Google
  id_token?: string;
  access_token?: string;
}

export interface Rsvp {
  rsvp: string;
}

export interface BpcRequestOptions {
  host?: string;
  hostname?: string;
  href?: string;
  method?: RequestMethod;
  origin?: string;
  path?: string; // deprecated, use pathname instead
  pathname?: string;
  port?: string;
  protocol?: string;
  payload?: string | unknown;
  // eslint-disable-next-line @typescript-eslint/ban-types
  headers?: object,
}

export interface BpcClientInterface {
  events: EventEmitter;
  app: AppTicket;
  url: string;
  appTicket: AppTicket | null;
  request: <R = any>(options: BpcRequestOptions, credentials?: AppTicket) => Promise<R | undefined>;
  requestFullResponse: (options: BpcRequestOptions, credentials?: AppTicket) => Promise<Response>;
  getAppTicket: () => Promise<AppTicket | null>;
  reissueAppTicket: () => Promise<AppTicket | null>;
  connect: (app?: AppTicket, url?: string) => Promise<void>;
}

export class BpcClient implements BpcClientInterface {
  public app: AppTicket = {
    id: process.env.BPC_APP_ID || '',
    key: process.env.BPC_APP_KEY || '',
    algorithm: (process.env.BPC_ALGORITHM as AllowedAlgorithms) || 'sha256',
  };

  public appTicket: AppTicket | null = null;

  public events = new EventEmitter();

  public url = process.env.BPC_URL || 'https://bpc.berlingskemedia.net';

  constructor(
    private readonly ticketBuffer = 1000 * 60 * 5, // 5 minutes
    private readonly errorTimeout = 1000 * 60, // 1 minute
    private readonly requestTimeout = 1000 * 30, // 30 seconds
  ) {}

  public request = async <R = any>(
    options: BpcRequestOptions,
    credentials?: AppTicket | null,
  ): Promise<R | undefined> => {
    const response = await this.requestFullResponse(options, credentials);

    let parsedData;
    const rawData = await response.text();
    if (rawData.length) {
      try {
        parsedData = JSON.parse(rawData);
      } catch (e) {
        const err = new Error(rawData || 'Unknown error');
        throw Boom.boomify(err, { statusCode: response.status, data: rawData });
      }
    }
    if (!response.ok) {
      const err = new Error(parsedData.message || response.body || 'Unknown error');
      throw Boom.boomify(err, { statusCode: response.status, data: parsedData });
    }

    return parsedData;
  };

  public requestFullResponse = async (
    options: BpcRequestOptions, credentials?: AppTicket | null,
  ): Promise<Response> => {
    const newOptions: RequestInit & { headers: Record<string, string>, method: RequestMethod } = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
    const requestHref = getRequestHref(options, this.url);

    // In case we want a request completely without any credentials,
    // use {} as the credentials parameter to this function
    const appTicket: AppTicket | null = credentials || this.appTicket || null;

    if (appTicket !== null && typeof appTicket === 'object' && Object.keys(appTicket).length > 1) {
      let hawkHeader;
      try {
        hawkHeader = Hawk.client.header(
          requestHref,
          newOptions.method,
          { credentials: appTicket, app: appTicket.app || this.app.id },
        );
      } catch (e) {
        throw new Error(`Hawk header: ${e.message}`);
      }

      newOptions.headers.Authorization = hawkHeader.header;
    }

    if (options.payload) {
      if (typeof options.payload === 'object') {
        newOptions.body = JSON.stringify(options.payload);
      } else {
        newOptions.body = `${options.payload}`;
      }
    }
    const signal = timeoutSignal(this.requestTimeout);

    let response = {} as Response;
    try {
      response = await fetch(requestHref, { ...newOptions, signal });
      timeoutSignal.clear(signal);
    } catch (error) {
      if (error.message === 'The user aborted a request.') {
        console.error(`BPC request was aborted due to a timeout - ${requestHref}`);
      }
      throw error;
    }
    return response;
  };

  public getAppTicket = async (): Promise<AppTicket | null> => {
    try {
      const result = await this.request<AppTicket>({ pathname: '/ticket/app', method: 'POST' }, this.app);
      if (result === undefined) {
        throw Boom.boomify(new Error('Missing app ticket'));
      }
      this.appTicket = result;
      this.events.emit('appticket');
      if (result.exp) {
        setTimeout(() => this.reissueAppTicket(), result.exp - Date.now() - this.ticketBuffer);
      }
    } catch (ex) {
      console.error(ex);
      setTimeout(() => this.getAppTicket(), this.errorTimeout);
      this.appTicket = null;
    }

    return this.appTicket;
  };

  public reissueAppTicket = async (): Promise<AppTicket | null> => {
    try {
      if (!this.appTicket) {
        throw Error('No app ticket to reissue. Try to get a new one.');
      }
      const result = await this.getReissuedTicket(this.appTicket);
      this.appTicket = result;
      this.events.emit('appticket');
      if (result.exp) {
        setTimeout(() => this.reissueAppTicket(), result.exp - Date.now() - this.ticketBuffer);
      }
    } catch (ex) {
      console.error(ex);
      setTimeout(() => this.getAppTicket(), this.errorTimeout);
      this.appTicket = null;
    }

    return this.appTicket;
  };

  public connect = async (app?: AppTicket, url?: string): Promise<void> => {
    const newApp = {
      ...this.app,
      ...(app || {}),
    };

    const appValidateResult = appSchema.validate(newApp);
    if (appValidateResult.error) {
      throw appValidateResult.error;
    }

    this.app = newApp;

    const newUrl = url || this.url;

    try {
      const validate = new URL(newUrl);
    } catch (ex) {
      throw new Error('BPC URL missing or invalid');
    }

    this.url = newUrl;

    const result = await this.getAppTicket();
    if (result) {
      this.events.emit('ready');
    }
  };

  public getRsvp = async (payload: RsvpPayload): Promise<Rsvp> => this.request<Rsvp>({
    pathname: '/rsvp',
    method: 'POST',
    payload,
  }).then((result) => {
    if (result === undefined) {
      throw Boom.boomify(new Error('Missing rsvp'));
    }
    return result;
  });

  public getUserTicket = async (payload: Rsvp): Promise<AppTicket> => this.request<AppTicket>({
    pathname: '/ticket/user',
    method: 'POST',
    payload,
  }).then((result) => {
    if (result === undefined) {
      throw Boom.boomify(new Error('Missing app ticket'));
    }
    return result;
  });

  public getReissuedTicket = async (oldTicket: AppTicket): Promise<AppTicket> => this.request<AppTicket>({
    pathname: '/ticket/reissue',
    method: 'POST',
  }, oldTicket).then((result) => {
    if (result === undefined) {
      throw Boom.boomify(new Error('Missing app ticket'));
    }
    return result;
  });
}

const client = new BpcClient();
export default client;

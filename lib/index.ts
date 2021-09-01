import Boom from '@hapi/boom';
import Hawk from '@hapi/hawk';
import Joi from 'joi';
import fetch, { Response } from 'node-fetch';
import { EventEmitter } from 'events';
import { URL } from 'url';

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

export interface BpcClientInterface {
  events: EventEmitter;
  app: AppTicket;
  url: string;
  appTicket: AppTicket | null;
  request: (options: unknown, credentials?: AppTicket, fullResponse?: boolean) => Promise<any>;
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
    private readonly ticketBuffer = 1000 * 30, // 30 seconds
    private readonly errorTimeout = 1000 * 60 * 5, // Five minutes
  ) {}

  public request = async (
    options: any, credentials?: AppTicket | null, fullResponse = false,
  ): Promise<Response | any> => {
    const newOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const requestHref = this.getRequestHref(options);

    // In case we want a request completely without any credentials,
    // use {} as the credentials parameter to this function
    const appTicket: AppTicket | null = credentials || this.appTicket || null;

    if (appTicket !== null && typeof appTicket === 'object' && Object.keys(appTicket).length > 1) {
      let hawkHeader;
      try {
        hawkHeader = Hawk.client.header(
          requestHref,
          newOptions.method || 'GET',
          { credentials: appTicket, app: appTicket.app || this.app.id },
        );
      } catch (e) {
        return new Error(`Hawk header: ${e.message}`);
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

    const response: Response = await fetch(requestHref, newOptions);
    if (!response.ok) {
      const err = new Error(response.statusText || 'Unknown error');
      throw Boom.boomify(err, { statusCode: response.status, data: response.body });
    }

    const data: any = await response.json();
    if (fullResponse) {
      return response;
    }
    return data;
  };

  public getAppTicket = async (): Promise<AppTicket | null> => {
    try {
      const result = await this.request({ pathname: '/ticket/app', method: 'POST' }, this.app);
      this.appTicket = result;
      this.events.emit('appticket');
      setTimeout(() => this.reissueAppTicket(), result.exp - Date.now() - this.ticketBuffer);
    } catch (ex) {
      console.error(ex);
      setTimeout(() => this.getAppTicket(), this.errorTimeout);
      this.appTicket = null;
    }

    return this.appTicket;
  };

  public reissueAppTicket = async (): Promise<AppTicket | null> => {
    try {
      const result = await this.request({ pathname: '/ticket/reissue', method: 'POST' }, this.appTicket);
      this.appTicket = result;
      this.events.emit('appticket');
      setTimeout(() => this.reissueAppTicket(), result.exp - Date.now() - this.ticketBuffer);
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

  private getRequestHref = (options: any): string => {
    const DEFAULT_PROTOCOL = 'https:';
    const port = options.port ? `:${options.port}` : '';
    const base = options.origin
      || (options.host ? `${options.host}${port}` : '')
      || (options.hostname ? `${options.protocol || DEFAULT_PROTOCOL}//${options.hostname}${port}` : '')
      || this.url;
    // backwards compatibility with legacy 'url'
    const pathname = options.pathname || options.path || '';

    return options.href || (new URL(pathname, base)).href;
  };
}

const client = new BpcClient();
export default client;

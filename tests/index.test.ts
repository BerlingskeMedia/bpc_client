import Hawk from '@hapi/hawk';
import { URL } from 'url';
import Client, { AllowedAlgorithms, AppTicket } from '../lib/index';

jest.mock('node-fetch');
// eslint-disable-next-line
import fetch from 'node-fetch';

const mockedFetch = fetch as any;
jest.useFakeTimers();

describe('client tests', () => {
  const expectedResult = { testValue: 'testCorrect' };
  const fetchDefaults = {
    host: 'bdk.fake',
    hostname: 'bdk.fake',
    pathname: '/',
    port: null,
  };

  Hawk.client.header = jest.fn().mockReturnValue({ header: 'Hawk-generated-header' });

  afterEach(() => {
    Client.url = 'https://bdk.fake';
    Client.app = {
      id: process.env.BPC_APP_ID || '124oeh12b21gfoi2bo3utfb21o',
      key: process.env.BPC_APP_KEY || 'vgjb24ejvg',
      algorithm: process.env.BPC_ALGORITHM as AllowedAlgorithms || 'sha256',
    };
    Client.appTicket = null;
  });

  it('should make https request with Authorization header and object payload', async () => {
    // given
    const options = { pathname: '/getTicket', payload: { someValue: 'test1' } };
    const credentials = { key: 'test1', id: 'test2' } as AppTicket;
    mockedFetch.mockReturnValueOnce(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));
    // when
    const response = await Client.request(Client.url, options, credentials);
    const url = new URL('https://bdk.fake/getTicket');
    // then
    expect(Hawk.client.header).toHaveBeenCalledWith(url.href, 'GET', {
      credentials,
      app: '124oeh12b21gfoi2bo3utfb21o',
    });
    expect(fetch).toHaveBeenCalledWith(url.href, {
      ...options,
      body: '{"someValue":"test1"}',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      href: 'https://bdk.fake/',
      protocol: 'https:',
      host: 'bdk.fake',
      hostname: 'bdk.fake',
      origin: 'https://bdk.fake',
      pathname: '/getTicket',
      port: '',
    });
    expect(response).toMatchObject(expectedResult);
  });

  it('should make http request without Authorization header and string payload', async () => {
    // given
    const options = { pathname: '/getTicket', payload: 'some string to send' };
    const credentials = { key: 'test1' } as AppTicket;
    Client.url = 'http://bdk.fake';
    mockedFetch.mockReturnValueOnce(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));

    // when
    const response = await Client.request(Client.url, options, credentials);

    // then
    expect(Hawk.client.header).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('http://bdk.fake/getTicket', {
      ...fetchDefaults,
      ...options,
      body: 'some string to send',
      headers: {
        'Content-Type': 'application/json',
      },
      href: 'http://bdk.fake/',
      protocol: 'http:',
      host: 'bdk.fake',
      hostname: 'bdk.fake',
      origin: 'http://bdk.fake',
      pathname: '/getTicket',
      port: '',
    });
    expect(response).toMatchObject(expectedResult);
  });

  describe('should throw exceptions', () => {
    const options = {
      pathname: '/getTicket',
      payload: {
        someValue: 'test1',
      },
    };

    it('if statusCode > 300', async () => {
      // given
      mockedFetch.mockReturnValueOnce(Promise.resolve({
        json: () => Promise.resolve(),
        status: 304,
        ok: false,
      }));

      // then
      await expect(Client.request(Client.url, options, {} as AppTicket)).rejects.toMatchObject({});
    });

    it('if statusCode 4xx', async () => {
      // given
      mockedFetch.mockReturnValueOnce(Promise.resolve({
        json: () => Promise.reject(),
        status: 404,
        ok: false,
      }));

      // then
      await expect(Client.request(Client.url, options, {} as AppTicket)).rejects.toMatchObject({
        isBoom: true,
        output: {
          statusCode: 404,
        },
      });
    });

    it('if statusCode 5xx', async () => {
      // given
      mockedFetch.mockReturnValueOnce(Promise.resolve({
        json: () => Promise.reject(),
        status: 500,
        ok: false,
      }));

      // then
      await expect(Client.request(Client.url, options, {} as AppTicket)).rejects.toMatchObject({
        isBoom: true,
        output: {
          statusCode: 500,
        },
      });
    });
  });

  it('should fetch app ticket', async () => {
    // given
    const credentials = { key: 'test1', id: 'test2' };
    Client.app = credentials as AppTicket;
    mockedFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve({ ...credentials, exp: Date.now() + 10000 }),
      status: 200,
      ok: true,
    }));

    // when
    const result = await Client.getAppTicket();

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/app', 'POST', {
      credentials,
      app: 'test2',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/ticket/app', {
      ...fetchDefaults,
      ...{ pathname: '/ticket/app', method: 'POST' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      href: 'https://bdk.fake/',
      protocol: 'https:',
      host: 'bdk.fake',
      hostname: 'bdk.fake',
      origin: 'https://bdk.fake',
      pathname: '/ticket/app',
      port: '',
    });
    expect(result).toMatchObject(credentials);
    expect(Client.appTicket).toMatchObject(credentials);
  });

  it('should reissue app ticket', async () => {
    // given
    const credentials = { key: 'test1', id: 'test2', app: 'test3' };
    Client.appTicket = credentials as AppTicket;
    mockedFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve({ ...credentials, exp: Date.now() + 10000 }),
      status: 200,
      ok: true,
    }));

    // when
    const result = await Client.reissueAppTicket();

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/reissue', 'POST', {
      credentials,
      app: 'test3',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/ticket/reissue', {
      ...fetchDefaults,
      ...{ pathname: '/ticket/reissue', method: 'POST' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      href: 'https://bdk.fake/',
      protocol: 'https:',
      host: 'bdk.fake',
      hostname: 'bdk.fake',
      origin: 'https://bdk.fake',
      pathname: '/ticket/reissue',
      port: '',
    });
    expect(result).toMatchObject(credentials);
    expect(Client.appTicket).toMatchObject(credentials);
  });

  it('should initialize ticket', async () => {
    // given
    const expectedResponse = { id: 'test_id', key: 'test_key', exp: Date.now() + 10000 };
    mockedFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve(expectedResponse),
      status: 200,
      ok: true,
    }));

    // when
    await Client.connect({
      id: 'test_id',
      key: 'test_key',
    } as AppTicket);

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/app', 'POST', {
      credentials: {
        id: 'test_id',
        key: 'test_key',
        algorithm: 'sha256',
      },
      app: 'test_id',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/ticket/app', {
      ...fetchDefaults,
      ...{ pathname: '/ticket/app', method: 'POST' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      href: 'https://bdk.fake/',
      protocol: 'https:',
      host: 'bdk.fake',
      hostname: 'bdk.fake',
      origin: 'https://bdk.fake',
      pathname: '/ticket/app',
      port: '',
    });
    expect(Client.appTicket).toMatchObject(expectedResponse);
  });
});

import Hawk from '@hapi/hawk';
import Client, {
  AllowedAlgorithms, AppTicket, BpcRequestOptions, Rsvp, RsvpPayload,
} from '../lib/index';

jest.mock('node-fetch');
// eslint-disable-next-line
import fetch, { RequestInit } from 'node-fetch';

const mockedFetch = fetch as any;
jest.useFakeTimers();

const optionsDP: [BpcRequestOptions, { url: string, init: RequestInit }][] = [
  [
    { path: '/getTicket', payload: { someValue: 'test1' } },
    {
      url: 'https://bdk.fake/getTicket',
      init: { method: 'GET', body: '{"someValue":"test1"}' },
    },
  ],
  [
    { origin: 'https://payment.fake:80', path: '/getOfferings' },
    {
      url: 'https://payment.fake:80/getOfferings',
      init: { method: 'GET' },
    },
  ],
  [
    { host: 'https://payment.fake', port: '80', pathname: '/getOfferings' },
    {
      url: 'https://payment.fake:80/getOfferings',
      init: { method: 'GET' },
    },
  ],
  [
    {
      hostname: 'payment.fake', pathname: '/getOfferings', method: 'GET', protocol: 'http:',
    },
    {
      url: 'http://payment.fake/getOfferings',
      init: { method: 'GET' },
    },
  ],
  [
    { hostname: 'payment.fake', pathname: '/buyOffer', method: 'POST' },
    {
      url: 'https://payment.fake/buyOffer',
      init: { method: 'POST' },
    },
  ],
];

describe('client tests', () => {
  const expectedResult = { testValue: 'testCorrect' };

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

  it.each(optionsDP)('should make request based on given options', async (options, expected) => {
    // given
    const credentials = { key: 'test1', id: 'test2' } as AppTicket;
    mockedFetch.mockReturnValueOnce(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));
    // when
    const response = await Client.request(options, credentials);
    // then
    expect(Hawk.client.header).toHaveBeenCalledWith(expected.url, expected.init.method, {
      credentials,
      app: '124oeh12b21gfoi2bo3utfb21o',
    });
    expect(fetch).toHaveBeenCalledWith(expected.url, {
      ...expected.init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
    });
    expect(response).toMatchObject(expectedResult);
  });

  it('should make https request with Authorization header and object payload', async () => {
    // given
    const options = { path: '/getTicket', payload: { someValue: 'test1' } };
    const credentials = { key: 'test1', id: 'test2' } as AppTicket;
    mockedFetch.mockReturnValueOnce(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));
    // when
    const response = await Client.request(options, credentials);
    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/getTicket', 'GET', {
      credentials,
      app: '124oeh12b21gfoi2bo3utfb21o',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/getTicket', {
      body: '{"someValue":"test1"}',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'GET',
    });
    expect(response).toMatchObject(expectedResult);
  });

  it('should make http request without Authorization header and string payload', async () => {
    // given
    const options = { path: '/getTicket', payload: 'some string to send' };
    const credentials = { key: 'test1' } as AppTicket;
    Client.url = 'http://bdk.fake';
    mockedFetch.mockReturnValueOnce(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));

    // when
    const response = await Client.request(options, credentials);

    // then
    expect(Hawk.client.header).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('http://bdk.fake/getTicket', {
      body: 'some string to send',
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });
    expect(response).toMatchObject(expectedResult);
  });

  describe('should throw exceptions', () => {
    const options = {
      path: '/getTicket',
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
      await expect(Client.request(options, {} as AppTicket)).rejects.toMatchObject({});
    });

    it('if statusCode 4xx', async () => {
      // given
      mockedFetch.mockReturnValueOnce(Promise.resolve({
        json: () => Promise.reject(),
        status: 404,
        ok: false,
      }));

      // then
      await expect(Client.request(options, {} as AppTicket)).rejects.toMatchObject({
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
      await expect(Client.request(options, {} as AppTicket)).rejects.toMatchObject({
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'POST',
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'POST',
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
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'POST',
    });
    expect(Client.appTicket).toMatchObject(expectedResponse);
  });

  it.each([{
    UID: '07f73e5305cc4db9ab8433e8ecf05ab2',
    UIDSignature: 'E2wHxyDxS1sclDCtGjM846P83Wc=',
    signatureTimestamp: '1507038287',
  }, {
    id_token: 'idToken',
    access_token: 'accessToken',
  }])('should fetch rsvp', async (userData) => {
    // given
    const rsvp: Rsvp = {
      rsvp: 'Fe26.2**f9...',
    };
    const credentials = { key: 'test1', id: 'test2', app: 'test3' };
    Client.appTicket = credentials as AppTicket;
    mockedFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve(rsvp),
      status: 200,
      ok: true,
    }));
    const rsvpPayload: RsvpPayload = {
      app: 'test3',
      returnUrl: 'return_url',
      ...userData,
    };

    // when
    const result = await Client.getRsvp(rsvpPayload);

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/rsvp', 'POST', {
      credentials,
      app: 'test3',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/rsvp', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'POST',
      body: JSON.stringify(rsvpPayload),
    });
    expect(result).toMatchObject(rsvp);
  });

  it('should fetch user ticket', async () => {
    // given
    const rsvp: Rsvp = {
      rsvp: 'Fe26.2**f9...',
    };
    const credentials = { key: 'test1', id: 'test2', app: 'test3' };
    Client.appTicket = credentials as AppTicket;
    mockedFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));

    // when
    const result = await Client.getUserTicket(rsvp);

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/user', 'POST', {
      credentials,
      app: 'test3',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/ticket/user', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'POST',
      body: JSON.stringify(rsvp),
    });
    expect(result).toMatchObject(expectedResult);
  });

  it('should reissue user ticket', async () => {
    // given
    const oldTicket: AppTicket = { key: 'test1', id: 'test2', algorithm: 'sha256' };
    mockedFetch.mockReturnValue(Promise.resolve({
      json: () => Promise.resolve(expectedResult),
      status: 200,
      ok: true,
    }));

    // when
    const result = await Client.reissueUserTicket(oldTicket);

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/reissue', 'POST', {
      credentials: oldTicket,
      app: '124oeh12b21gfoi2bo3utfb21o',
    });
    expect(fetch).toHaveBeenCalledWith('https://bdk.fake/ticket/reissue', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
      method: 'POST',
    });
    expect(result).toMatchObject(expectedResult);
  });
});

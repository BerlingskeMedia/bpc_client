import Hawk from '@hapi/hawk';
import https from 'https';
import http from 'http';
import Url from 'url';
import Client, { AllowedAlgorithms, AppTicket } from '../lib/index';

describe('client tests', () => {
  let rawResponse: unknown; // raw response from api to be set in each test created in createRawResponse
  const expectedResult = { testValue: 'testCorrect' };
  const createRawResponse = (statusCode: number): unknown => ({
    on: jest.fn((event, callback) => {
      if (event === 'data') {
        callback(JSON.stringify(expectedResult));
      } else {
        callback();
      }
    }),
    statusCode,
  });
  Hawk.client.header = jest.fn().mockReturnValue({ header: 'Hawk-generated-header' });
  const mockWrite = jest.fn();
  const mockEnd = jest.fn();
  const mockRequest = {
    write: mockWrite,
    end: mockEnd,
    on: jest.fn((event, callback) => {
      if (event === 'response') {
        callback(rawResponse);
      }
    }),
  };
  https.request = jest.fn().mockReturnValue(mockRequest);
  http.request = jest.fn().mockReturnValue(mockRequest);

  afterEach(() => {
    Client.url = 'https://bdk.fake';
    Client.app = {
      id: process.env.BPC_APP_ID,
      key: process.env.BPC_APP_KEY,
      algorithm: process.env.BPC_ALGORITHM as AllowedAlgorithms,
    };
    Client.appTicket = null;
  });

  it('should make https request with Authorization header and object payload', async () => {
    // given
    const options = { path: '/getTicket', payload: { someValue: 'test1' } };
    const credentials = { key: 'test1', id: 'test2' } as AppTicket;
    rawResponse = createRawResponse(200);

    // when
    const response = await Client.request(options, credentials);

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/getTicket', 'GET', {
      credentials,
      app: '124oeh12b21gfoi2bo3utfb21o',
    });
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).toHaveBeenCalledWith({
      ...Url.parse('https://bdk.fake'),
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
    });
    expect(mockWrite).toHaveBeenCalledWith(JSON.stringify(options.payload));
    expect(mockEnd).toHaveBeenCalled();
    expect(response).toMatchObject(expectedResult);
  });

  it('should make http request without Authorization header and string payload', async () => {
    // given
    const options = { path: '/getTicket', payload: 'some string to send' };
    const credentials = { key: 'test1' }  as AppTicket;
    Client.url = 'http://bdk.fake';
    rawResponse = createRawResponse(200);

    // when
    const response = await Client.request(options, credentials);

    // then
    expect(Hawk.client.header).not.toHaveBeenCalled();
    expect(https.request).not.toHaveBeenCalled();
    expect(http.request).toHaveBeenCalledWith({
      ...Url.parse('http://bdk.fake'),
      ...options,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(mockWrite).toHaveBeenCalledWith('some string to send');
    expect(mockEnd).toHaveBeenCalled();
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
      rawResponse = createRawResponse(304);

      // then
      await expect(Client.request(options, {} as AppTicket)).rejects.toMatchObject({});
    });

    it('if statusCode 4xx', async () => {
      // given
      rawResponse = createRawResponse(404);

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
      rawResponse = createRawResponse(500);

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
    rawResponse = createRawResponse(200);

    // when
    const result = await Client.getAppTicket();

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/app', 'POST', {
      credentials,
      app: 'test2',
    });
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).toHaveBeenCalledWith({
      ...Url.parse('https://bdk.fake'),
      ...{ path: '/ticket/app', method: 'POST' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
    });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
    expect(result).toMatchObject(expectedResult);
    expect(Client.appTicket).toMatchObject(expectedResult);
  });

  it('should reissue app ticket', async () => {
    // given
    const credentials = { key: 'test1', id: 'test2', app: 'test3' };
    Client.appTicket = credentials as AppTicket;
    rawResponse = createRawResponse(200);

    // when
    const result = await Client.reissueAppTicket();

    // then
    expect(Hawk.client.header).toHaveBeenCalledWith('https://bdk.fake/ticket/reissue', 'POST', {
      credentials,
      app: 'test3',
    });
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).toHaveBeenCalledWith({
      ...Url.parse('https://bdk.fake'),
      ...{ path: '/ticket/reissue', method: 'POST' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
    });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
    expect(result).toMatchObject(expectedResult);
    expect(Client.appTicket).toMatchObject(expectedResult);
  });

  it('should initialize ticket', async () => {
    // given
    rawResponse = createRawResponse(200);

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
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).toHaveBeenCalledWith({
      ...Url.parse('https://bdk.fake'),
      ...{ path: '/ticket/app', method: 'POST' },
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Hawk-generated-header',
      },
    });
    expect(mockWrite).not.toHaveBeenCalled();
    expect(mockEnd).toHaveBeenCalled();
    expect(Client.appTicket).toMatchObject(expectedResult);
  });
});

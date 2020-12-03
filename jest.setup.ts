jest.mock('http');
jest.mock('https');
jest.mock('events');
jest.mock('@hapi/hawk');

process.env.BPC_APP_ID = '124oeh12b21gfoi2bo3utfb21o';
process.env.BPC_APP_KEY = 'vgjb24ejvg';
process.env.BPC_URL = 'https://bdk.fake';

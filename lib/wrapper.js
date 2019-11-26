// eslint-disable-next-line import/no-dynamic-require
const workerMethod = require(process.argv[2]);
const logMethod = (msg) => process.send({ type: 'log', log: msg });

process.send({ type: 'start', time: new Date().getTime() });
workerMethod(logMethod)
  .then((res) => process.send({ type: 'finish', time: new Date().getTime(), returned: res }))
  .catch((e) => process.send({ type: 'fatal', stack: e.stack }));

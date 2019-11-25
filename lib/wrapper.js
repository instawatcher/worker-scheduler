// eslint-disable-next-line import/no-dynamic-require
const workerMethod = require(process.argv[2]);
const logMethod = (msg) => process.send({ type: 'log', log: msg });

workerMethod(logMethod)
  .then((res) => process.send({ type: 'finish', returned: res }))
  .catch((e) => process.send({ type: 'fatal', stack: e.stack }));

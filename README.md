# worker-scheduler
  [![npm](https://img.shields.io/npm/v/worker-scheduler.svg)](https://www.npmjs.com/package/worker-scheduler)
  [![Build Status](https://travis-ci.org/instawatcher/worker-scheduler.svg?branch=master)](https://travis-ci.org/instawatcher/worker-scheduler)
  [![Maintainability](https://api.codeclimate.com/v1/badges/65a67d4434f0cabf6ec2/maintainability)](https://codeclimate.com/github/instawatcher/worker-scheduler/maintainability)
  [![Test Coverage](https://api.codeclimate.com/v1/badges/65a67d4434f0cabf6ec2/test_coverage)](https://codeclimate.com/github/instawatcher/worker-scheduler/test_coverage)

Ever wanted to schedule jobs like "this thing should execute every x hours/minutes/seconds"? Then this library is for you!
You can even trigger workers manually! Works with native promises, as I don't think you want to do synchronous work in your *background* workers.

# What's a "worker"?

Let me just show you a quick example:

## `index.js`

```javascript
const Scheduler = require('worker-scheduler');

const myScheduler = new Scheduler();
const worker = new Scheduler.Worker('mycoolworker', require.resolve('./myworker'), 86400 * 1000);

worker.on('finish', (ip) => {
  console.log(ip);
});
worker.on('error', e => console.error(e));
```

## `myworker.js`

```javascript
const fetch = require('node-fetch');

// NOTE: This *has* to be an async function (or a Promise-returning function),
//       otherwise the scheduler won't know what to do with it!
module.exports = async (log) => {
  log('I can even log stuff here! Yay!');
  return fetch('https://api.ipify.org').then(res => res.text());
};
```

This simple example would fetch your public IP address, return it, and `console.log` it out *every day*!
(Every worker is forked out of the scheduler, so don't worry about hanging your master process!)

# Just a quick note...

Have you noticed? This library is sitting under the `instawatcher` organization. That's because it's the core
of Instawatcher! I had to write a completely new "background task scheduler", because none of the available
ones fit the needs of IW.
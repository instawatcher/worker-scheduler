const assert = require('assert');
const path = require('path');
const Scheduler = require('../lib/index');

it('should resolve shit', (done) => {
  const sched = new Scheduler();
  sched.addWorker(new Scheduler.Worker('woot', require.resolve('./assets/worker1'), 1000));
  // TODO: Finish test
});

const assert = require('assert');
const log = require('npmlog');
const Scheduler = require('../lib/worker-scheduler');

log.level = 'verbose';

const { Worker } = Scheduler;
const sched = new Scheduler(3000, 200);

it('should not get nonexistent workers', () => {
  assert.strictEqual(sched.getWorkerByName('imnothere'), undefined);
});

it('should finish with normal worker', (done) => {
  const worker = new Worker('test_normal', require.resolve('./assets/normal'), 1000);

  sched.addWorker(worker);
  worker.once('launch', () => {
    worker.once('finish', (ret) => {
      assert.strictEqual(ret, true);
      assert.strictEqual(worker.getStatus(), 'FINISHED');
      done();
    });
    worker.once('error', done);
    worker.deactivate();
  });
}).timeout(6000);

it('should throw error with error worker', (done) => {
  const worker = new Worker('test_error', require.resolve('./assets/error'), 1000);

  sched.addWorker(worker);
  worker.once('launch', () => {
    worker.once('error', (e) => {
      assert.notStrictEqual(e.indexOf('imanerror'), -1);
      assert.strictEqual(worker.getStatus(), 'ERRORED');
      done();
    });
    worker.once('finish', () => done(new Error('Worker finished successfully')));
    worker.deactivate();
  });
}).timeout(6000);

it('should prematurely exit with premature worker', (done) => {
  const worker = new Worker('test_premature', require.resolve('./assets/premature'), 1000);

  sched.addWorker(worker);
  worker.once('launch', () => {
    worker.once('error', (e) => {
      assert.strictEqual(e, 'TERM_UNEXPECTED');
      assert.strictEqual(worker.getStatus(), 'INACTIVE');
      done();
    });
    worker.once('finish', () => done(new Error('Worker finished successfully')));
    worker.deactivate();
  });
}).timeout(6000);

it('should time out with toolong worker', (done) => {
  const worker = new Worker('test_toolong', require.resolve('./assets/toolong'), 1000);

  sched.addWorker(worker);
  worker.once('launch', () => {
    worker.once('error', (e) => {
      assert.strictEqual(e, 'TIMEOUT');
      assert.strictEqual(worker.getStatus(), 'ERRORED');
      worker.deactivate();
      done();
    });
    worker.once('finish', () => done(new Error('Timeout worker did not time out')));
  });
}).timeout(6000);

it('should kill worker post-resolution', (done) => {
  const worker = new Worker('deferred_long', require.resolve('./assets/deferredlong'), 1000);

  sched.addWorker(worker);
  worker.once('launch', () => {
    worker.once('error', (e) => {
      assert.ok(e);
      worker.deactivate();
      done();
    });
    worker.once('finish', () => done(new Error('Worker finished successfully')));
  });
}).timeout(5000);

it('should count workers', () => {
  assert.strictEqual(sched.getWorkers().length, 5);
});

it('should shutdown master tick', () => {
  sched.shutdown();
});

const childProc = require('child_process');
const EventEmitter = require('events');
const log = require('npmlog');

const utils = require('./utils');

const workerState = {
  INACTIVE: -1,
  QUEUED: 0,
  RUNNING: 1,
  FINISHED: 2,
  ERRORED: 3,
};

class Worker extends EventEmitter {
  constructor(name, file, interval) {
    super();

    this.isActive = true;
    this.name = name;
    this.file = file;
    this.interval = interval;
    this.status = workerState.INACTIVE;
    this.byline = null;
    this.proc = null;
    this.nextRun = -1;
    this.lastExit = -1;
    this.lastRun = -1;

    this.enqueue();
  }

  getStatus() {
    return Object.keys(workerState)[Object.values(workerState).findIndex(v => v === this.status)];
  }

  setStatus(status) {
    this.status = status;
    log.silly('workerMgmt', '[%s] Worker status changed to %s', this.name, this.getStatus());
  }

  doTick(compDate, timeout) {
    // Launch
    if (this.status === workerState.QUEUED && this.nextRun <= compDate) {
      this.launch();
      return true;
    }

    // Timeout
    if (this.status === workerState.RUNNING && compDate - this.lastRun > timeout) {
      log.warn('workerMgmt', '[%s] Timeout! Been running for %i ms with no result; terminating.', this.name, compDate - this.lastRun);
      this.terminate();
    }

    return false;
  }

  enqueue() {
    this.nextRun = utils.getNaturalizedInterval(this.interval);
    this.setStatus(workerState.QUEUED);
  }

  deactivate(forceInactiveState) {
    this.isActive = false;
    if (forceInactiveState || this.status !== workerState.RUNNING) {
      this.setStatus(workerState.INACTIVE);
    }
  }

  // NOTE: THIS METHOD SHOULD ONLY BE USED FOR TIMEOUTS!
  terminate() {
    this.proc.removeAllListeners();

    // This is here to avoid multiple terminate() calls & to avoid relaunch
    this.setStatus(workerState.INACTIVE);

    this.proc.once('exit', () => {
      log.verbose('workerMgmt', '[%s] Process killed. Poor little guy.', this.name);
      this.setStatus(workerState.ERRORED);
      this.emit('error', 'TIMEOUT');
    });
    this.proc.kill();
    log.verbose('workerMgmt', '[%s] Kill signal sent...', this.name);
  }

  launch() {
    this.lastRun = new Date().getTime();

    log.silly('workerMgmt', '[%s] Forking worker', this.name);
    this.proc = childProc.fork(require.resolve('./wrapper'), [this.file]);
    this.setStatus(workerState.RUNNING);
    this.emit('launch');

    this.proc.on('message', (msg) => {
      if (msg.type === 'log') {
        this.byline = msg.log;
        log.verbose('workerMgmt', '[%s] LOG: %s', this.name, msg.log);
      } else if (msg.type === 'finish') {
        log.verbose('workerMgmt', '[%s] Worker done, returned %o', this.name, msg.returned);
        this.setStatus(workerState.FINISHED);
        this.emit('finish', msg.returned);
      } else if (msg.type === 'fatal') {
        const { stack } = msg;
        const [headline] = stack.split('\n');
        this.byline = headline;

        log.warn('workerMgmt', '[%s] FATAL: %s', this.name, headline);
        log.silly('workerMgmt', '[%s] TRACE: %s', this.name, stack);
        this.setStatus(workerState.ERRORED);
        this.emit('error', stack);
      }
    });

    // TODO: Verify that this code gets executed AFTER the final message (finish OR fatal)
    this.proc.once('exit', (code) => {
      this.proc.removeAllListeners();

      this.lastExit = code;
      if (this.status === workerState.RUNNING || code !== 0) {
        log.error('workerMgmt', '[%s] Process terminated unexpectedly with code %i, NOT QUEUING IT AGAIN!', this.name, code);
        log.error('workerMgmt', '[%s] This may be the result of a premature process.exit() call or a non-zero exit code.', this.name);
        this.deactivate(true);
        this.emit('error', 'TERM_UNEXPECTED');
        return;
      }

      log.silly('workerMgmt', '[%s] Worker process exited with code %i', this.name, code);
      if (this.isActive) this.enqueue();
      else this.setStatus(workerState.INACTIVE);
    });
  }
}

module.exports = Worker;

const childProc = require('child_process');
const EventEmitter = require('events');
const log = require('npmlog');

const utils = require('./utils');

const workerState = {
  INACTIVE: -1,
  QUEUED: 0,
  AWAITING_HANDOFF: 1,
  RUNNING: 2,
  FINISHED_WAITING: 3,
  FINISHED: 4,
  ERRORED_WAITING: 5,
  ERRORED: 6,
  KILLED_WAITING: 7,
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
    this.lastRetval = null;
    this.proc = null;
    this.nextRun = -1;
    this.lastStart = -1;
    this.lastEnd = -1;
    this.logTag = `worker/${this.name}`;

    this.enqueue();
  }

  getStatus() {
    return Object.keys(workerState)[Object.values(workerState).findIndex((v) => v === this.status)];
  }

  setStatus(status) {
    this.status = status;
    log.verbose(this.logTag, 'Worker status changed to %s', this.getStatus());
  }

  doTick(compDate, timeout) {
    // Launch
    if (this.status === workerState.QUEUED && this.nextRun <= compDate) {
      this.launch();
      return true;
    }

    // Timeout
    if (this.status === workerState.RUNNING
      && compDate - this.lastStart > timeout) {
      log.warn(this.logTag, 'Timeout! Been running for %i ms with no result; terminating.', compDate - this.lastStart);
      this.terminate();
    }

    // Post-finish timeout
    if ([workerState.ERRORED_WAITING, workerState.FINISHED_WAITING].indexOf(this.status) !== -1
      && compDate - this.lastEnd > 5000) {
      log.warn(this.logTag, 'Timeout! Waiting for process to close for %i ms; no results. Terminating.', compDate - this.lastEnd);
      this.terminate();
    }

    if (this.status === workerState.KILLED_WAITING && compDate - this.lastEnd > 10000) {
      log.error(this.logTag, 'This worker is causing *TOO MUCH* trouble. It did not get killed by my SIGTERM.');
      log.error(this.logTag, 'I will now have to shutdown the master process.');
      log.error(this.logTag, 'I am very sorry. Goodbye.');
      process.exit(1);
    }

    return false;
  }

  enqueue(force) {
    if (this.isActive || force) {
      this.nextRun = utils.getNaturalizedInterval(this.interval);
      this.setStatus(workerState.QUEUED);
    } else log.verbose(this.logTag, 'Cowardly refusing to launch a non-active worker.');
  }

  activate() {
    this.isActive = true;
    this.enqueue();
    log.verbose(this.logTag, 'Worker activated! \\o/');
  }

  deactivate(forceInactiveState) {
    this.isActive = false;
    if (forceInactiveState || this.status !== workerState.RUNNING) {
      this.setStatus(workerState.INACTIVE);
    }
    log.verbose(this.logTag, 'Worker deactivated. :c');
  }

  // NOTE: THIS METHOD *MUST* ONLY BE USED FOR TIMEOUTS!
  terminate() {
    this.lastEnd = new Date().getTime();
    this.proc.kill();
    log.verbose(this.logTag, 'Termination signal sent...');
    this.setStatus(workerState.KILLED_WAITING);
  }

  launch() {
    log.silly(this.logTag, 'Forking worker');
    this.proc = childProc.fork(require.resolve('./wrapper'), [this.file], {
      stdio: 'pipe',
    });
    this.setStatus(workerState.AWAITING_HANDOFF);

    let stdoutln = '';
    this.proc.stdout.on('data', (chunk) => {
      const s = chunk.toString();
      if (s.indexOf('\n') !== -1) {
        stdoutln += s.trim();
        this.byline = stdoutln;
        log.verbose(`${this.logTag}:STDOUT`, stdoutln);
        stdoutln = '';
      } else {
        stdoutln += `${s.trim()} `;
      }
    });

    let stderrln = '';
    this.proc.stderr.on('data', (chunk) => {
      const s = chunk.toString();
      if (s.indexOf('\n') !== -1) {
        stderrln += s.trim();
        this.byline = stderrln;
        log.verbose(`${this.logTag}:STDERR`, stderrln);
        stderrln = '';
      } else {
        stderrln += `${s.trim()} `;
      }
    });

    this.proc.on('message', (msg) => {
      if (msg.type === 'start') { // Fired on start
        this.setStatus(workerState.RUNNING);
        this.lastStart = msg.time;
        this.emit('launch');
      } else if (msg.type === 'log') { // Fired on log
        this.byline = msg.log;
        log.verbose(this.logTag, msg.log);
      } else if (msg.type === 'finish') { // Fired on success
        this.lastEnd = msg.time;
        this.lastRetval = msg.returned;
        log.verbose(this.logTag,
          'Worker finished & returned %j under %i msecs. Waiting for process to stop...',
          msg.returned, this.lastEnd - this.lastStart);
        this.setStatus(workerState.FINISHED_WAITING);
      } else if (msg.type === 'fatal') { // Fired on failure (graceful)
        this.lastEnd = new Date().getTime();

        const [headline] = msg.stack.split('\n');
        this.byline = headline;
        this.lastRetval = headline;

        log.warn(this.logTag, 'FATAL: %s', headline);
        log.verbose(this.logTag, 'TRACE: %s', msg.stack);
        this.setStatus(workerState.ERRORED_WAITING);
      }
    });

    this.proc.once('exit', (code) => {
      this.proc.removeAllListeners();
      if (this.status === workerState.KILLED_WAITING) {
        log.verbose(this.logTag, 'Process terminated. Poor little guy :/');
        this.deactivate(true);
        this.emit('fail', 'TIMEOUT');
        return;
      }

      if (code !== 0) {
        log.error(this.logTag, 'Process terminated unexpectedly with code %i, NOT QUEUING IT AGAIN!', code);
        log.error(this.logTag, 'This may be the result of a premature process.exit() call or a non-zero exit code.');
        this.deactivate(true);
        this.byline = 'SEVERE ERROR: Process terminated unexpectedly, worker deactivated';
        this.emit('fail', 'TERM_UNEXPECTED');
        return;
      }

      log.verbose(this.logTag, 'Worker process exited (code 0)');
      if (this.status === workerState.FINISHED_WAITING) {
        this.setStatus(workerState.FINISHED);
        this.emit('finish', this.lastRetval);
      } else if (this.status === workerState.ERRORED_WAITING) {
        this.setStatus(workerState.ERRORED);
        this.emit('fail', this.lastRetval);
      } else {
        log.warn(this.logTag, 'U wot m8? This process was not expected to finish at this time. Deactivating.');
        this.deactivate(true);
      }

      this.enqueue();
    });
  }
}

module.exports = Worker;

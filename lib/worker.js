const childProc = require('child_process');
const log = require('npmlog');

const utils = require('./utils');

const workerState = {
  INACTIVE: -1,
  RUNNING: 0,
  QUEUED: 1,
};

class Worker {
  constructor(name, file, interval) {
    this.isActive = true;
    this.name = name;
    this.file = file;
    this.interval = interval;
    this.status = workerState.INACTIVE;
    this.byline = null;
    this.proc = null;
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

  doTick(compDate) {
    if (this.status === workerState.QUEUED && this.nextRun <= compDate) {
      this.launch();
      return true;
    }
    return false;
  }

  enqueue() {
    this.nextRun = utils.getNaturalizedInterval(this.interval);
    this.setStatus(workerState.QUEUED);
  }

  launch() {
    this.lastRun = new Date().getTime();

    log.silly('workerMgmt', '[%s] Forking worker', this.name);
    this.proc = childProc.fork(require.resolve('./wrapper'), [this.file]);
    this.setStatus(workerState.RUNNING);

    this.proc.on('message', (msg) => {
      if (msg.type === 'log') log.verbose('workerMgmt', '[%s][log] %s', this.name, msg.log);
    });

    // TODO: Proper exit handler, listen for fatals & finished (see message listener above)
    this.proc.once('exit', (code) => {
      log.log(code === 0 ? 'silly' : 'warn', 'workerMgmt', '[%s] Process exited with %i', this.name, code);
      this.lastExit = code;
      if (this.isActive) this.enqueue();
      else this.setStatus(workerState.INACTIVE);
    });
  }
}

module.exports = Worker;

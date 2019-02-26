const log = require('npmlog');
const Worker = require('./worker');

class Scheduler {
  constructor(timeout, masterTickInterval) {
    this.workers = [];
    this.timeout = timeout || 1800 * 1000;
    this.masterTick = setInterval(this.tick.bind(this), masterTickInterval || 1000);
    log.verbose('workerScheduler', 'I feel workers coming! Set master tick interval to %i msecs, let\'s do this!', masterTickInterval || 1000);
  }

  addWorker(w) {
    this.workers.push(w);
    log.verbose('workerRegistry', 'Registered new worker "%s"', w.name);
    return w;
  }

  getWorkers() {
    return this.workers;
  }

  getWorkerByName(name) {
    return this.workers.find(w => w.name === name);
  }

  tick() {
    const tickTime = new Date().getTime();
    let launches = 0;

    this.workers.forEach((w) => {
      launches += w.doTick(tickTime, this.timeout);
    });
    log.silly('ticker', 'Tick finished, %i tasks launched under %i msecs', launches, new Date().getTime() - tickTime);
  }

  shutdown() {
    log.verbose('workerScheduler', 'Shutting down master tick NOW. This process will stay alive until all workers are finished.');
    clearInterval(this.masterTick);
  }

  static get Worker() {
    return Worker;
  }
}

module.exports = Scheduler;

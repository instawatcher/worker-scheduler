const log = require('npmlog');
const Worker = require('./worker');

log.level = 'silly';

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
  }

  tick() {
    const tickTime = new Date().getTime();
    let launches = 0;

    this.workers.forEach((w) => {
      launches += w.doTick(tickTime);
    });
    log.silly('ticker', 'Tick finished, %i tasks launched under %i msecs', launches, new Date().getTime() - tickTime);
  }

  static get Worker() {
    return Worker;
  }
}

module.exports = Scheduler;

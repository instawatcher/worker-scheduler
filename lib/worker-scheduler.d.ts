import { ChildProcess } from "child_process";
import { EventEmitter } from "events";

export as namespace workerScheduler;
export = workerScheduler.Scheduler;

declare namespace workerScheduler {
  class Scheduler {
    workers: Worker[];
    timeout: number;
    static Worker: WorkerConstructor;
  
    /**
     * The scheduler is responsible for firing worker ticks.
     * @param timeout The timeout for individual workers
     * @param masterTickInterval The interval, in which workers will be ticked
     */
    constructor(timeout: number, masterTickInterval?: number);
  
    /**
     * Register a new worker under the given scheduler.
     * @param w The worker to add
     */
    addWorker(w: Worker): Worker;

    /**
     * Get all workers under the given scheduler.
     */
    getWorkers(): Worker[];

    /**
     * Get a worker by it's name
     * @param name The worker's name
     */
    getWorkerByName(name: string): Worker | undefined;

    /**
     * Stop the master tick and shutdown the scheduler.
     */
    shutdown(): void;
  
    /**
     * Internally, this method is used to tick workers.
     * @private
     */
    tick(): void;
  }

  interface WorkerConstructor {
    new (name: string, file: string, interval: number): Worker;
  }
  
  class Worker extends EventEmitter {
    isActive: boolean;
    name: string;
    file: string;
    interval: number;
    status: number;
    byline: string | null;
    proc: ChildProcess | null;
    nextRun: number;
    lastExit: number;
    lastRun: number;

    getStatus(): "INACTIVE" | "QUEUED" | "RUNNING" | "FINISHED" | "ERRORED";
    deactivate(forceInactiveState: boolean): void;
    launch(): void;
    
    addListener(event: 'launch', listener: () => void): this;
    addListener(event: 'finish', listener: (returned: any) => void): this;
    addListener(event: 'error', listener: (e: "TERM_UNEXPECTED" | "TIMEOUT") => void): this;
    addListener(event: 'error', listener: (e: string) => void): this;
    
    on(event: 'launch', listener: () => void): this;
    on(event: 'finish', listener: (returned: any) => void): this;
    on(event: 'error', listener: (e: "TERM_UNEXPECTED" | "TIMEOUT") => void): this;
    on(event: 'error', listener: (e: string) => void): this;

    once(event: 'launch', listener: () => void): this;s
    once(event: 'finish', listener: (returned: any) => void): this;
    once(event: 'error', listener: (e: "TERM_UNEXPECTED" | "TIMEOUT") => void): this;
    once(event: 'error', listener: (e: string) => void): this;
    
    /**
     * @private
     */
    logListener(): void;

    /**
     * @private
     */
    finishListener(): void;

    /**
     * @private
     */
    errorListener(): void;

    /**
     * @private
     */
    terminate(): void;

    /**
     * @private
     */
    setStatus(status: number): void;

    /**
     * @private
     */
    doTick(compDate: number, timeout: number): boolean;

    /**
     * @private
     */
    enqueue(): void;
  }
}

import { dbRuntime } from './dbStorage.js';
import { kccMissionEngine } from './kccMissionEngine.js';

export interface ScheduledMissionJob {
  jobId: string;
  goal: string;
  cronExpression?: string; // e.g. "0 0 * * *" or "EVERY_24_HOURS"
  delaySeconds?: number;
  nextRunAt: string;
  status: 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  createdMissions: string[];
  createdAt: string;
}

export class KCCMissionScheduler {
  public scheduleMission(goal: string, cronOrDelaySeconds: string | number): ScheduledMissionJob {
    const isDelay = typeof cronOrDelaySeconds === 'number';
    const nextRunAt = isDelay 
      ? new Date(Date.now() + cronOrDelaySeconds * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString();

    const job: ScheduledMissionJob = {
      jobId: `SCHED-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      goal,
      cronExpression: isDelay ? undefined : String(cronOrDelaySeconds),
      delaySeconds: isDelay ? Number(cronOrDelaySeconds) : undefined,
      nextRunAt,
      status: 'SCHEDULED',
      createdMissions: [],
      createdAt: new Date().toISOString()
    };

    const scheduled = dbRuntime.get('kccScheduledMissions') || [];
    scheduled.unshift(job);
    dbRuntime.set('kccScheduledMissions', scheduled);

    console.log(`[KCC Mission Scheduler] Scheduled job ${job.jobId} for goal: "${goal}" (Next run: ${nextRunAt})`);
    return job;
  }

  public getScheduledJobs(): ScheduledMissionJob[] {
    return dbRuntime.get('kccScheduledMissions') || [];
  }

  public async checkScheduledJobs() {
    const jobs = this.getScheduledJobs();
    const now = new Date().toISOString();

    for (const job of jobs) {
      if (job.status === 'SCHEDULED' && job.nextRunAt <= now) {
        console.log(`[KCC Mission Scheduler] Triggering scheduled job '${job.jobId}'...`);
        job.status = 'RUNNING';

        const mission = await kccMissionEngine.createMission(job.goal);
        job.createdMissions.push(mission.missionId);

        if (job.delaySeconds) {
          job.status = 'COMPLETED';
        } else {
          // Recurring job: set next run for 24 hours later
          job.nextRunAt = new Date(Date.now() + 86400 * 1000).toISOString();
          job.status = 'SCHEDULED';
        }

        dbRuntime.set('kccScheduledMissions', jobs);
      }
    }
  }
}

export const kccMissionScheduler = new KCCMissionScheduler();

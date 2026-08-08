import { dbRuntime } from './dbStorage.js';
import { kccExecutiveReasoningEngine } from './kccExecutiveReasoningEngine.js';

export interface MissionTask {
  taskId: string;
  missionId: string;
  title: string;
  description: string;
  category: 'RESEARCH' | 'STRATEGY' | 'STORE_BUILD' | 'SUPPLIER' | 'SEO' | 'MARKETING' | 'SECURITY' | 'DECISION';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  dependencies: string[];
  requiredCapability: string;
  assignedProvider: 'GEMINI' | 'CLAUDE' | 'OPENAI' | 'MANUS' | 'CJ_DROPSHIPPING' | 'KITORA_STORE';
  estimatedTokens: number;
  estimatedTimeSec: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'AWAITING_APPROVAL';
  verificationMethod: 'COMPILE' | 'API_CHECK' | 'CONTENT_VERIFY' | 'AI_AUDIT' | 'PAYMENT_STATE';
  result?: any;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

export interface MissionStrategy {
  targetNiche: string;
  coreMilestones: string[];
  estimatedROI: string;
  riskAssessment: string;
  targetAudience: string;
}

export interface KCCMission {
  missionId: string;
  goal: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PLANNING' | 'ACTIVE' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
  strategy: MissionStrategy;
  tasks: MissionTask[];
  currentStep: string;
  progressPercentage: number;
  ownerApprovalRequired: boolean;
  approvalReason?: string;
  finalReport?: any;
}

export class KCCMissionEngine {
  public async createMission(goal: string, priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'): Promise<KCCMission> {
    const missionId = `MIS-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const mission: KCCMission = {
      missionId,
      goal,
      priority,
      status: 'PLANNING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      strategy: {
        targetNiche: 'Autonomous AI Strategic Target Niche',
        coreMilestones: [
          'Executive AI Board Strategy Alignment',
          'Autonomous Sourcing & Infrastructure Build',
          'AI Marketing & Conversion Deployment',
          'Security & Risk Audit'
        ],
        estimatedROI: 'Autonomous AI ROI Target',
        riskAssessment: 'Executive board verified risk parameters',
        targetAudience: 'Global Target Market'
      },
      tasks: [],
      currentStep: 'Initializing Multi-AI Executive Meeting...',
      progressPercentage: 0,
      ownerApprovalRequired: false
    };

    // Every mission decision comes ONLY from KCC Brain / Executive Reasoning Engine
    const { generatedTasks, meetingRecord } = await kccExecutiveReasoningEngine.runExecutiveMeeting(mission, {
      type: 'INITIAL_GOAL',
      goal
    });

    mission.tasks = generatedTasks;
    mission.strategy.targetNiche = meetingRecord.consensus.strategy;
    mission.currentStep = `Executive Board Strategy Approved (${meetingRecord.meetingId}): ${meetingRecord.consensus.strategy}`;

    // Store in DB
    const missions = dbRuntime.get('kccMissions') || [];
    missions.unshift(mission);
    dbRuntime.set('kccMissions', missions);

    console.log(`[KCC Mission Engine] Created Mission ${missionId} with ${generatedTasks.length} executive tasks.`);
    return mission;
  }

  public getMissions(): KCCMission[] {
    return dbRuntime.get('kccMissions') || [];
  }

  public getMissionById(missionId: string): KCCMission | undefined {
    const missions = this.getMissions();
    return missions.find(m => m.missionId === missionId);
  }

  public updateMission(updated: KCCMission) {
    const missions = this.getMissions();
    const idx = missions.findIndex(m => m.missionId === updated.missionId);
    if (idx !== -1) {
      missions[idx] = updated;
      dbRuntime.set('kccMissions', missions);
    }
  }
}

export const kccMissionEngine = new KCCMissionEngine();

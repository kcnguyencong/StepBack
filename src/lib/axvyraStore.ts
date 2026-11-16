import {
  RecoveryCase,
  Milestone,
  INITIAL_MILESTONES,
  DailyExerciseSession,
  SessionFeedback,
  ROMRecord,
  DailyRecoveryLog,
  KnowledgeArticle,
  KNOWLEDGE_ARTICLES,
  MilestoneStatus,
} from '@/data/axvyraDomain';
import { SurgeryType, getRehabStatus, SURGERY_DETAILS, getSafeSurgeryType } from '@/data/rehabProtocols';

const STORAGE_KEY = 'axvyra_v1_case';
const AUDIT_KEY = 'axvyra_v1_audit';

export function getOrCreateDefaultCase(
  patientName = 'Bệnh nhân',
  surgeryDate = new Date().toISOString().split('T')[0],
  surgeryType: SurgeryType = 'ACL_MENISCUS_REPAIR',
  surgeryLeg: 'left' | 'right' = 'left',
  restrictions?: { weightBearing?: string; maxFlexion?: number }
): RecoveryCase {
  const rehab = getRehabStatus(surgeryDate, surgeryType);

  const dailySessions: DailyExerciseSession[] = [
    {
      id: `session-${surgeryDate}`,
      dayNumber: rehab.currentDay,
      weekNumber: rehab.currentWeek,
      title: `Buổi tập Phục hồi GĐ ${rehab.phase.phase}`,
      focus: rehab.phase.milestoneCriteria[0] || 'Kiểm soát sưng nề & Kích hoạt cơ',
      estimatedMinutes: Math.min(25, rehab.exercises.length * 4),
      exercises: rehab.exercises.map((e) => ({
        exerciseId: e.id,
        title: e.name,
        vietnameseName: e.vietnameseName || e.name,
        targetSets: e.targetSets,
        targetReps: e.targetReps,
        holdSec: e.holdSec,
        restSec: e.restSec,
        instructions: e.instructions,
        safetyNote: e.safetyWarning,
        maxFlexionAngle: e.maxFlexionAngle,
      })),
      completed: false,
    },
  ];

  return {
    id: `case-${Date.now()}`,
    patientName,
    surgeryDate,
    surgeryType,
    surgeryLeg,
    currentPhase: rehab.phase.phase,
    weightBearingStatus:
      restrictions?.weightBearing || rehab.weightBearingSummary,
    braceRequirement: rehab.braceSummary,
    maxSafeFlexion:
      restrictions?.maxFlexion !== undefined
        ? restrictions.maxFlexion
        : rehab.allowedFlexionMax,
    milestones: INITIAL_MILESTONES,
    dailySessions,
    sessionFeedbacks: [],
    romHistory: [],
    dailyLogs: [],
    clinicalPendingVerification: false,
  };
}

export class AxvyraStore {
  static sanitizeCase(raw: any): RecoveryCase {
    const defaultCase = getOrCreateDefaultCase();
    if (!raw || typeof raw !== 'object') return defaultCase;

    const safeType = getSafeSurgeryType(raw.surgeryType);
    const safeLeg = raw.surgeryLeg === 'right' ? 'right' : 'left';

    return {
      ...defaultCase,
      ...raw,
      id: typeof raw.id === 'string' && raw.id ? raw.id : defaultCase.id,
      patientName: typeof raw.patientName === 'string' && raw.patientName ? raw.patientName : defaultCase.patientName,
      surgeryDate: typeof raw.surgeryDate === 'string' && raw.surgeryDate ? raw.surgeryDate : defaultCase.surgeryDate,
      surgeryType: safeType,
      surgeryLeg: safeLeg,
      currentPhase: typeof raw.currentPhase === 'number' ? raw.currentPhase : defaultCase.currentPhase,
      weightBearingStatus: typeof raw.weightBearingStatus === 'string' ? raw.weightBearingStatus : defaultCase.weightBearingStatus,
      braceRequirement: typeof raw.braceRequirement === 'string' ? raw.braceRequirement : defaultCase.braceRequirement,
      maxSafeFlexion: typeof raw.maxSafeFlexion === 'number' ? raw.maxSafeFlexion : defaultCase.maxSafeFlexion,
      dailySessions: Array.isArray(raw.dailySessions) && raw.dailySessions.length > 0 ? raw.dailySessions : defaultCase.dailySessions,
      romHistory: Array.isArray(raw.romHistory) ? raw.romHistory : [],
      milestones: Array.isArray(raw.milestones) && raw.milestones.length > 0 ? raw.milestones : defaultCase.milestones,
      sessionFeedbacks: Array.isArray(raw.sessionFeedbacks) ? raw.sessionFeedbacks : [],
      dailyLogs: Array.isArray(raw.dailyLogs) ? raw.dailyLogs : [],
    };
  }

  static getRecoveryCase(): RecoveryCase | null {
    if (typeof window === 'undefined') return null;
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      return this.sanitizeCase(parsed);
    } catch {
      return null;
    }
  }

  static async syncWithServer(): Promise<RecoveryCase | null> {
    if (typeof window === 'undefined') return null;
    try {
      const activeCase = this.getRecoveryCase();
      if (!activeCase) {
        // Fetch from server if exists
        const res = await fetch('/api/sync');
        if (res.ok) {
          const json = await res.json();
          if (json.connected && json.data) {
            const sanitized = this.sanitizeCase(
              typeof json.data === 'string' ? JSON.parse(json.data) : json.data
            );
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
            return sanitized;
          }
        }
        return null;
      }

      // Sync activeCase to Neon server
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeCase),
      }).catch(() => {});

      return activeCase;
    } catch {
      return this.getRecoveryCase();
    }
  }

  static saveRecoveryCase(recoveryCase: RecoveryCase): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recoveryCase));
      this.logAudit('UPDATE', 'RecoveryCase', recoveryCase.id, 'Cập nhật hồ sơ phục hồi');

      // Sync to Neon in background
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recoveryCase),
      }).catch(() => {});
    } catch (e) {
      console.error('Failed to save RecoveryCase', e);
    }
  }

  static completeSession(
    sessionId: string,
    feedback: { rpeScore: number; painDuringSession: number; notes: string }
  ): RecoveryCase | null {
    const activeCase = this.getRecoveryCase();
    if (!activeCase) return null;

    const sessionIndex = activeCase.dailySessions.findIndex((s) => s.id === sessionId);
    const nowIso = new Date().toISOString();

    if (sessionIndex >= 0) {
      activeCase.dailySessions[sessionIndex].completed = true;
      activeCase.dailySessions[sessionIndex].completedAt = nowIso;
    }

    const sessionFeedback: SessionFeedback = {
      sessionId,
      completedAt: nowIso,
      rpeScore: feedback.rpeScore,
      painDuringSession: feedback.painDuringSession,
      notes: feedback.notes,
    };

    activeCase.sessionFeedbacks = [sessionFeedback, ...activeCase.sessionFeedbacks];
    this.saveRecoveryCase(activeCase);
    this.logAudit('COMPLETE_SESSION', 'ExerciseSession', sessionId, `RPE: ${feedback.rpeScore}`);
    return activeCase;
  }

  static addROMRecord(record: Omit<ROMRecord, 'id' | 'recordedAt'>): RecoveryCase | null {
    const activeCase = this.getRecoveryCase();
    if (!activeCase) return null;

    const newROM: ROMRecord = {
      id: `rom-${Date.now()}`,
      recordedAt: new Date().toISOString(),
      ...record,
    };

    activeCase.romHistory = [newROM, ...activeCase.romHistory];
    this.saveRecoveryCase(activeCase);
    this.logAudit('RECORD_ROM', 'ROMMeasurement', newROM.id, `Flexion: ${newROM.flexionAngle}°`);
    return activeCase;
  }

  static addDailyRecoveryLog(log: Omit<DailyRecoveryLog, 'id'>): RecoveryCase | null {
    const activeCase = this.getRecoveryCase();
    if (!activeCase) return null;

    const newLog: DailyRecoveryLog = {
      id: `log-${Date.now()}`,
      ...log,
    };

    activeCase.dailyLogs = [newLog, ...activeCase.dailyLogs.filter((l) => l.date !== log.date)];
    this.saveRecoveryCase(activeCase);
    this.logAudit('ADD_LOG', 'RecoveryLog', newLog.id, `Pain: ${newLog.painScore}/10`);
    return activeCase;
  }

  static updateMilestoneStatus(
    milestoneId: string,
    newStatus: MilestoneStatus,
    notes?: string
  ): RecoveryCase | null {
    const activeCase = this.getRecoveryCase();
    if (!activeCase) return null;

    const mIdx = activeCase.milestones.findIndex((m) => m.id === milestoneId);
    if (mIdx >= 0) {
      activeCase.milestones[mIdx].status = newStatus;
      if (newStatus === 'CONFIRMED' || newStatus === 'AWAITING_ASSESSMENT') {
        activeCase.milestones[mIdx].achievedDate = new Date().toISOString().split('T')[0];
      }
      this.saveRecoveryCase(activeCase);
      this.logAudit('UPDATE_MILESTONE', 'PatientMilestone', milestoneId, `Trạng thái: ${newStatus}`);
    }
    return activeCase;
  }

  static logAudit(action: string, entityType: string, entityId: string, details?: string): void {
    if (typeof window === 'undefined') return;
    try {
      const existingStr = localStorage.getItem(AUDIT_KEY);
      const existing = existingStr ? JSON.parse(existingStr) : [];
      const entry = {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action,
        entityType,
        entityId,
        details,
      };
      localStorage.setItem(AUDIT_KEY, JSON.stringify([entry, ...existing].slice(0, 50)));
    } catch {}
  }
}

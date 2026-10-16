/** Current v2 browser data. Documentation only; not a runtime validator.
 * Proposed future cloud/STT fields are intentionally NOT mixed into these types.
 */
export type RecordMode = 'demo' | 'live';
export type TranscriptionStatus = 'demo' | 'browser' | 'pending' | 'not_supported' | 'manual';
export type SessionStatus =
  | 'recording' | 'complete' | 'incomplete' | 'interrupted' | 'failed' | 'finished';

export interface PhotoRecord {
  id: string;
  sessionId: string;
  number: number;
  mode: RecordMode;
  createdAt: number;
  /** Unit/building text at capture, NOT the room classification. */
  location: string;
  /** Original issue text may include contractor name. */
  text: string;
  /** Unedited browser speech-recognition phrase, when available. */
  transcriptRaw?: string;
  photo: string;
  photoFormat: 'svg' | 'jpg' | 'png' | 'webp';
  /** App elapsed timer excluding pauses; not sample-accurate media time. */
  audioOffsetMs: number;
  transcriptionStatus: TranscriptionStatus;
  cloudStatus: 'not_connected';
  unitOverride?: string;
  positionOverride?: string;
  tradeOverride?: string;
  typeOverride?: string;
  classificationReviewed?: boolean;
  note?: string;
  updatedAt?: number;
  demoSource?: string;
}

export interface InspectionSession {
  id: string;
  mode: RecordMode;
  status: SessionStatus;
  /** Live capture uses createdAt; some import/demo paths use startedAt. */
  createdAt?: number;
  startedAt?: number;
  endedAt?: number;
  durationMs?: number;
  locationAtStart?: string;
  mime?: string;
  demoSource?: string;
}

export interface AudioChunk {
  id: string;
  sessionId: string;
  seq: number;
  blob: Blob;
  receivedAt?: number;
}

export interface ResolvedClassification {
  unit: string;
  position: string;
  trade: string;
  defectType: string;
  note: string;
  reviewed: boolean;
}

/** Exported ZIP uses file paths instead of inline photo data. */
export type BackupPhotoRecord = Omit<PhotoRecord, 'photo'> & { photoFile: string };
export type BackupSession = InspectionSession & { audioFile: string | null };
export interface BackupPayloadV2 {
  schemaVersion: 2;
  exportedAt: string;
  storage: 'local-browser-only';
  records: BackupPhotoRecord[];
  sessions: BackupSession[];
}

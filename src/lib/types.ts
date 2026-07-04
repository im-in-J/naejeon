export interface Group {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
  members: Member[];
  matches: Match[];
}

export interface Member {
  id: string;
  nickname: string;
  groupId: string;
  joinedAt: string;
  tier?: string;
  preferredLanes?: Lane[]; // ordered: index 0 = 1순위
  realName?: string;
  aliases?: string[]; // 부캐 닉네임들 (통합된 아이디)
}

export type Lane = "top" | "jungle" | "mid" | "adc" | "support";

export interface Match {
  id: string;
  groupId: string;
  createdAt: string;
  gameDuration: string;
  players: PlayerStat[];
}

export interface PlayerStat {
  id: string;
  matchId: string;
  nickname: string;
  champion: string;
  lane?: Lane;
  team: "blue" | "red";
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageDealt: number;
  damageTaken: number;
  visionScore: number;
  wardsPlaced: number;
  wardsDestroyed: number;
  objectiveDamage: number;
  ccScore: number;
  healingDone: number;
  shieldingDone: number;
  killParticipation: number;
  mvpScore: number;
  isMvp: boolean;
  isAce: boolean;
}

export interface AnalysisResult {
  players: Partial<PlayerStat>[];
  gameDuration?: string;
  confidence: number;
}

export interface LeaderboardEntry {
  nickname: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKda: number;
  avgDamage: number;
  avgVision: number;
  mvpCount: number;
  aceCount: number;
  totalScore: number;
}

-- 컴학내전 Supabase 스키마
-- Supabase 대시보드 > SQL Editor에서 실행

-- 매치 테이블
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL DEFAULT '컴학내전',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  game_duration TEXT,
  game_mode TEXT DEFAULT 'rift',
  players JSONB NOT NULL
);

-- 멤버 테이블 (선수 정보)
CREATE TABLE members (
  nickname TEXT PRIMARY KEY,
  real_name TEXT,
  tier TEXT,
  preferred_lanes JSONB DEFAULT '[]',
  aliases JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security 비활성화 (내부 서비스용)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 모든 접근 허용 (anon key로 접근)
CREATE POLICY "Allow all on matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on members" ON members FOR ALL USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX idx_matches_created_at ON matches (created_at DESC);
CREATE INDEX idx_matches_group ON matches (group_name);

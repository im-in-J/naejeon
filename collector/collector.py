"""
컴학내전 데이터 수집기
- 롤 클라이언트 자동 감지
- 게임 종료 시 상세 데이터 추출
- 서버로 자동 업로드

설치: pip install requests psutil
실행: python collector.py
"""

import json
import time
import os
import sys
import ssl
import base64
import subprocess
import urllib.request
import urllib.error

# ─── 설정 ───
SERVER_URL = "https://your-site.vercel.app"  # 배포 후 수정
UPLOAD_SECRET = "naejeon-upload-2024"  # 서버와 동일한 시크릿
POLL_INTERVAL = 5  # 클라이언트 감지 간격 (초)
GAME_CHECK_INTERVAL = 10  # 게임 상태 체크 간격 (초)

# SSL 인증서 무시 (LCU는 자체 서명 인증서 사용)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE


def find_lockfile():
    """롤 클라이언트 lockfile 찾기"""
    # Windows 기본 경로들
    paths = [
        os.path.expandvars(r"%LOCALAPPDATA%\Riot Games\League of Legends\lockfile"),
        r"C:\Riot Games\League of Legends\lockfile",
        r"D:\Riot Games\League of Legends\lockfile",
    ]

    # 환경변수로 커스텀 경로 지원
    custom = os.environ.get("LOL_PATH")
    if custom:
        paths.insert(0, os.path.join(custom, "lockfile"))

    for path in paths:
        if os.path.exists(path):
            return path
    return None


def parse_lockfile(path):
    """lockfile에서 포트와 비밀번호 추출"""
    try:
        with open(path, "r") as f:
            content = f.read().strip()
        parts = content.split(":")
        if len(parts) >= 5:
            return {
                "port": parts[2],
                "password": parts[3],
                "protocol": parts[4],
            }
    except (IOError, PermissionError):
        pass
    return None


def lcu_request(lock_info, endpoint):
    """LCU API 호출"""
    url = f"https://127.0.0.1:{lock_info['port']}{endpoint}"
    auth = base64.b64encode(f"riot:{lock_info['password']}".encode()).decode()

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Basic {auth}")
    req.add_header("Accept", "application/json")

    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  HTTP 에러: {e.code}")
        return None
    except Exception as e:
        return None


def get_game_phase(lock_info):
    """현재 게임 상태 확인"""
    result = lcu_request(lock_info, "/lol-gameflow/v1/gameflow-phase")
    return result if isinstance(result, str) else None


def get_eog_stats(lock_info):
    """게임 종료 후 상세 스탯 가져오기"""
    return lcu_request(lock_info, "/lol-end-of-game/v1/eog-stats-block")


def format_match_data(eog_data):
    """LCU 데이터를 서버 포맷으로 변환"""
    if not eog_data or "teams" not in eog_data:
        return None

    teams = eog_data.get("teams", [])
    if len(teams) < 2:
        return None

    game_length = eog_data.get("gameLength", 0)
    minutes = game_length // 60
    seconds = game_length % 60
    duration = f"{minutes}:{seconds:02d}"

    players = []

    for team_idx, team in enumerate(teams):
        team_side = "blue" if team_idx == 0 else "red"
        is_winner = team.get("isWinningTeam", False)

        for p in team.get("players", []):
            stats = p.get("stats", {})
            player = {
                "nickname": p.get("summonerName", ""),
                "champion": p.get("championName", ""),
                "team": team_side,
                "win": is_winner,
                "kills": stats.get("CHAMPIONS_KILLED", 0),
                "deaths": stats.get("NUM_DEATHS", 0),
                "assists": stats.get("ASSISTS", 0),
                "cs": stats.get("MINIONS_KILLED", 0) + stats.get("NEUTRAL_MINIONS_KILLED", 0),
                "gold": stats.get("GOLD_EARNED", 0),
                "damageDealt": stats.get("TOTAL_DAMAGE_DEALT_TO_CHAMPIONS", 0),
                "damageTaken": stats.get("TOTAL_DAMAGE_TAKEN", 0),
                "visionScore": stats.get("VISION_SCORE", 0),
                "wardsPlaced": stats.get("WARD_PLACED", 0),
                "wardsDestroyed": stats.get("WARD_KILLED", 0),
                "objectiveDamage": stats.get("TOTAL_DAMAGE_DEALT_TO_OBJECTIVES", 0),
                "ccScore": stats.get("TOTAL_TIME_CROWD_CONTROL_DEALT", 0),
                "healingDone": stats.get("TOTAL_HEAL", 0),
                "shieldingDone": stats.get("TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES", 0),
            }
            players.append(player)

    return {
        "gameDuration": duration,
        "players": players,
        "gameMode": eog_data.get("gameMode", "CLASSIC"),
    }


def upload_match(match_data):
    """서버에 매치 데이터 업로드"""
    url = f"{SERVER_URL}/api/upload"
    payload = json.dumps({
        "secret": UPLOAD_SECRET,
        "match": match_data,
    }).encode()

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  업로드 실패: {e.code} - {body}")
        return None
    except Exception as e:
        print(f"  업로드 에러: {e}")
        return None


def main():
    print("=" * 50)
    print("  컴학내전 데이터 수집기")
    print("=" * 50)
    print(f"  서버: {SERVER_URL}")
    print(f"  클라이언트 감지 간격: {POLL_INTERVAL}초")
    print()

    last_game_id = None
    was_in_game = False

    while True:
        # 1. lockfile 찾기
        lockfile_path = find_lockfile()
        if not lockfile_path:
            print("  롤 클라이언트를 찾는 중...")
            time.sleep(POLL_INTERVAL)
            continue

        lock_info = parse_lockfile(lockfile_path)
        if not lock_info:
            time.sleep(POLL_INTERVAL)
            continue

        # 2. 게임 상태 확인
        phase = get_game_phase(lock_info)

        if phase == "InProgress":
            if not was_in_game:
                print("  🎮 게임 진행 중... 종료를 기다리는 중")
                was_in_game = True
            time.sleep(GAME_CHECK_INTERVAL)
            continue

        if phase == "EndOfGame":
            if was_in_game:
                print("  ✅ 게임 종료 감지! 데이터 추출 중...")
                time.sleep(3)  # EOG 데이터 로드 대기

                eog = get_eog_stats(lock_info)
                if eog:
                    game_id = eog.get("gameId")

                    if game_id != last_game_id:
                        match_data = format_match_data(eog)

                        if match_data and len(match_data["players"]) == 10:
                            print(f"  📊 {len(match_data['players'])}명 데이터 추출 완료")
                            print(f"  ⏱️  게임 시간: {match_data['gameDuration']}")

                            # 팀 정보 출력
                            blue = [p for p in match_data["players"] if p["team"] == "blue"]
                            red = [p for p in match_data["players"] if p["team"] == "red"]
                            blue_win = blue[0]["win"] if blue else False

                            print(f"  {'🔵 승' if blue_win else '🔵 패'}: {', '.join(p['champion'] for p in blue)}")
                            print(f"  {'🔴 승' if not blue_win else '🔴 패'}: {', '.join(p['champion'] for p in red)}")

                            # 업로드
                            print("  📤 서버에 업로드 중...")
                            result = upload_match(match_data)
                            if result:
                                print("  ✅ 업로드 성공!")
                            else:
                                # 로컬 백업 저장
                                backup_path = f"match_backup_{game_id}.json"
                                with open(backup_path, "w", encoding="utf-8") as f:
                                    json.dump(match_data, f, ensure_ascii=False, indent=2)
                                print(f"  ⚠️  업로드 실패. 로컬 백업 저장: {backup_path}")

                            last_game_id = game_id
                        else:
                            print("  ⚠️  커스텀 게임이 아니거나 데이터 불완전 (10명 아님)")
                    else:
                        pass  # 이미 처리한 게임
                else:
                    print("  ⚠️  EOG 데이터를 가져올 수 없습니다")

                was_in_game = False
            time.sleep(GAME_CHECK_INTERVAL)
            continue

        # 대기 상태
        was_in_game = False
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  종료합니다.")

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
            # Riot ID 체계 대응: 여러 필드에서 닉네임 찾기
            nickname = (
                p.get("summonerName")
                or p.get("riotIdGameName")
                or p.get("gameName")
                or p.get("puuid", "")[:8]
            )
            champion = (
                p.get("championName")
                or p.get("skinName")
                or ""
            )
            player = {
                "nickname": nickname,
                "champion": champion,
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

                            # 플레이어 닉네임 확인
                            for mp in match_data["players"]:
                                print(f"    {mp['team']:4s} | {mp['nickname']:20s} | {mp['champion']}")

                            # 닉네임 누락 체크
                            empty_names = [p for p in match_data["players"] if not p["nickname"]]
                            if empty_names:
                                print(f"  ⚠️  닉네임 누락 {len(empty_names)}명! EOG 원본 키 덤프:")
                                for p in eog.get("teams", [{}])[0].get("players", [])[:1]:
                                    print(f"    플레이어 키: {list(p.keys())}")

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


def get_match_history(lock_info, count=50):
    """과거 매치 히스토리 가져오기"""
    data = lcu_request(
        lock_info,
        f"/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex={count}"
    )
    if not data or "games" not in data:
        return []
    return data["games"].get("games", [])


def format_history_match(game):
    """매치 히스토리 데이터를 서버 포맷으로 변환"""
    game_duration = game.get("gameDuration", 0)
    minutes = game_duration // 60
    seconds = game_duration % 60
    duration = f"{minutes}:{seconds:02d}"

    participants = game.get("participants", [])
    identities = game.get("participantIdentities", [])

    # participantId → player info 매핑
    id_map = {}
    for ident in identities:
        pid = ident.get("participantId")
        player_info = ident.get("player", {})
        id_map[pid] = (
            player_info.get("summonerName")
            or player_info.get("gameName")
            or player_info.get("riotIdGameName")
            or f"Player{pid}"
        )

    players = []
    for p in participants:
        pid = p.get("participantId")
        stats = p.get("stats", {})
        team_id = p.get("teamId", 100)
        team_side = "blue" if team_id == 100 else "red"

        player = {
            "nickname": id_map.get(pid, f"Player{pid}"),
            "champion": p.get("championName", "") or game.get("participants", [{}])[0].get("championId", ""),
            "team": team_side,
            "win": stats.get("win", False),
            "kills": stats.get("kills", 0),
            "deaths": stats.get("deaths", 0),
            "assists": stats.get("assists", 0),
            "cs": stats.get("totalMinionsKilled", 0) + stats.get("neutralMinionsKilled", 0),
            "gold": stats.get("goldEarned", 0),
            "damageDealt": stats.get("totalDamageDealtToChampions", 0),
            "damageTaken": stats.get("totalDamageTaken", 0),
            "visionScore": stats.get("visionScore", 0),
            "wardsPlaced": stats.get("wardsPlaced", 0),
            "wardsDestroyed": stats.get("wardsKilled", 0),
            "objectiveDamage": stats.get("damageDealtToObjectives", 0),
            "ccScore": stats.get("totalTimeCrowdControlDealt", 0),
            "healingDone": stats.get("totalHeal", 0),
            "shieldingDone": stats.get("totalDamageShieldedOnTeammates", 0),
        }
        players.append(player)

    return {
        "gameDuration": duration,
        "players": players,
        "gameMode": game.get("gameMode", "CLASSIC"),
    }


def history_mode():
    """과거 커스텀 게임 조회 → 선택 업로드"""
    print("=" * 50)
    print("  컴학내전 — 과거 경기 가져오기")
    print("=" * 50)

    lockfile_path = find_lockfile()
    if not lockfile_path:
        print("  ❌ 롤 클라이언트를 찾을 수 없습니다. 클라이언트를 먼저 실행해주세요.")
        return

    lock_info = parse_lockfile(lockfile_path)
    if not lock_info:
        print("  ❌ lockfile 파싱 실패")
        return

    print("  클라이언트 감지 완료. 매치 히스토리 조회 중...")
    games = get_match_history(lock_info, 100)

    if not games:
        print("  ❌ 매치 히스토리를 가져올 수 없습니다.")
        return

    # 커스텀 게임만 필터 (queueId=0 또는 gameType="CUSTOM_GAME")
    custom_games = [
        g for g in games
        if g.get("queueId", -1) == 0 or g.get("gameType") == "CUSTOM_GAME"
    ]

    if not custom_games:
        print(f"  최근 {len(games)}경기 중 커스텀 게임이 없습니다.")
        return

    print(f"\n  커스텀 게임 {len(custom_games)}개 발견:\n")

    for i, game in enumerate(custom_games):
        game_duration = game.get("gameDuration", 0)
        minutes = game_duration // 60
        seconds = game_duration % 60

        # 참가자 정보
        identities = game.get("participantIdentities", [])
        participants = game.get("participants", [])
        player_names = []
        for ident in identities:
            info = ident.get("player", {})
            name = info.get("summonerName") or info.get("gameName") or "?"
            player_names.append(name)

        # 날짜
        from datetime import datetime
        timestamp = game.get("gameCreation", 0) / 1000
        date_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M") if timestamp else "?"

        # 팀 구분
        blue_players = []
        red_players = []
        for idx, p in enumerate(participants):
            name = player_names[idx] if idx < len(player_names) else "?"
            if p.get("teamId", 100) == 100:
                blue_players.append(name)
            else:
                red_players.append(name)

        # 승리팀
        blue_win = any(p.get("stats", {}).get("win", False) for p in participants if p.get("teamId") == 100)

        print(f"  [{i+1:2d}] {date_str}  ({minutes}:{seconds:02d})")
        print(f"       {'🔵 승' if blue_win else '🔵 패'}: {', '.join(blue_players)}")
        print(f"       {'🔴 승' if not blue_win else '🔴 패'}: {', '.join(red_players)}")
        print()

    # 사용자 선택
    print("  ─────────────────────────────────")
    print("  업로드할 게임 번호를 입력하세요.")
    print("  여러 개: 1,3,5  |  범위: 1-5  |  전체: all  |  취소: q")
    print()
    choice = input("  선택: ").strip()

    if choice.lower() == "q":
        print("  취소합니다.")
        return

    # 선택 파싱
    selected = set()
    if choice.lower() == "all":
        selected = set(range(len(custom_games)))
    else:
        for part in choice.split(","):
            part = part.strip()
            if "-" in part:
                start, end = part.split("-", 1)
                for n in range(int(start) - 1, int(end)):
                    selected.add(n)
            else:
                selected.add(int(part) - 1)

    selected = sorted([s for s in selected if 0 <= s < len(custom_games)])

    if not selected:
        print("  선택된 게임이 없습니다.")
        return

    print(f"\n  {len(selected)}개 게임 업로드 시작...\n")

    success = 0
    for idx in selected:
        game = custom_games[idx]
        match_data = format_history_match(game)

        if not match_data or len(match_data["players"]) < 2:
            print(f"  [{idx+1}] ⚠️  데이터 불완전, 건너뜀")
            continue

        # 플레이어 확인
        blue = [p for p in match_data["players"] if p["team"] == "blue"]
        red = [p for p in match_data["players"] if p["team"] == "red"]
        blue_names = ", ".join(p["nickname"] for p in blue)
        red_names = ", ".join(p["nickname"] for p in red)
        print(f"  [{idx+1}] {match_data['gameDuration']} | {blue_names} vs {red_names}")

        result = upload_match(match_data)
        if result:
            print(f"       ✅ 업로드 성공!")
            success += 1
        else:
            print(f"       ❌ 업로드 실패")

    print(f"\n  완료: {success}/{len(selected)} 업로드됨")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--history":
            history_mode()
        else:
            main()
    except KeyboardInterrupt:
        print("\n  종료합니다.")

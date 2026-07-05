"""
컴학내전 데이터 수집기
- 롤 클라이언트 자동 감지
- 게임 종료 시 상세 데이터 추출
- 서버로 자동 업로드

설치: Python 3만 있으면 됨 (외부 패키지 불필요)
실행: python collector.py
"""

import json
import time
import os
import re
import sys
import ssl
import base64
import subprocess
import urllib.request
import urllib.error
from datetime import datetime

# ─── 설정 ───
SERVER_URL = "https://your-site.vercel.app"  # 배포 후 수정
UPLOAD_SECRET = "naejeon-upload-2024"  # 서버와 동일한 시크릿
POLL_INTERVAL = 5  # 클라이언트 감지 간격 (초)
GAME_CHECK_INTERVAL = 10  # 게임 상태 체크 간격 (초)
EOG_RETRY_COUNT = 5  # 게임 종료 후 데이터 조회 재시도 횟수
EOG_RETRY_INTERVAL = 3  # 재시도 간격 (초)

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


def find_credentials_from_process():
    """실행 중인 롤 클라이언트 프로세스에서 접속 정보 추출
    (설치 경로가 어디든 동작 — lockfile을 못 찾을 때의 폴백)"""
    try:
        out = subprocess.run(
            [
                "powershell", "-NoProfile", "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\""
                " | ForEach-Object { $_.CommandLine }",
            ],
            capture_output=True,
            timeout=20,
        ).stdout.decode("utf-8", errors="ignore")
    except Exception:
        return None

    port = re.search(r"--app-port=(\d+)", out)
    token = re.search(r"--remoting-auth-token=([\w-]+)", out)
    if port and token:
        return {"port": port.group(1), "password": token.group(1), "protocol": "https"}
    return None


def get_credentials():
    """LCU 접속 정보: lockfile 우선, 실패 시 프로세스에서 추출"""
    path = find_lockfile()
    if path:
        info = parse_lockfile(path)
        if info:
            return info
    return find_credentials_from_process()


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
    except Exception:
        return None


def get_game_phase(lock_info):
    """현재 게임 상태 확인"""
    result = lcu_request(lock_info, "/lol-gameflow/v1/gameflow-phase")
    return result if isinstance(result, str) else None


def get_eog_stats(lock_info):
    """게임 종료 후 상세 스탯 가져오기"""
    return lcu_request(lock_info, "/lol-end-of-game/v1/eog-stats-block")


def is_custom_game(lock_info):
    """현재 게임이 커스텀 게임인지 확인
    True/False = 확인됨, None = 확인 불가"""
    session = lcu_request(lock_info, "/lol-gameflow/v1/session")
    if not session:
        return None
    game_data = session.get("gameData", {})
    if game_data.get("isCustomGame"):
        return True
    queue = game_data.get("queue", {})
    if queue.get("id") == 0 or queue.get("gameTypeConfig", {}).get("name") == "GAME_CFG_CUSTOM":
        return True
    if queue.get("id") is not None:
        return False
    return None


# ─── 챔피언 ID → 이름 매핑 (Data Dragon) ───

_champion_map = None


def get_champion_map():
    """championId(숫자) → 영문 이름 매핑. 최초 1회 Data Dragon에서 로드"""
    global _champion_map
    if _champion_map is not None:
        return _champion_map
    try:
        with urllib.request.urlopen(
            "https://ddragon.leagueoflegends.com/api/versions.json", timeout=10
        ) as resp:
            version = json.loads(resp.read().decode())[0]
        url = f"https://ddragon.leagueoflegends.com/cdn/{version}/data/en_US/champion.json"
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        _champion_map = {int(v["key"]): v["id"] for v in data["data"].values()}
    except Exception as e:
        print(f"  ⚠️  챔피언 목록 로드 실패 ({e}) — 챔피언이 숫자로 표시될 수 있습니다")
        _champion_map = {}
    return _champion_map


def champion_id_to_name(champion_id):
    """championId → 영문 이름 (실패 시 숫자 문자열)"""
    if not champion_id:
        return ""
    try:
        return get_champion_map().get(int(champion_id), str(champion_id))
    except (TypeError, ValueError):
        return str(champion_id)


def lane_from_timeline(participant):
    """매치 상세의 timeline에서 포지션 추출 (top/jungle/mid/adc/support, 불명이면 None)"""
    tl = participant.get("timeline", {}) or {}
    lane = tl.get("lane", "")
    role = tl.get("role", "")
    if lane == "TOP":
        return "top"
    if lane == "JUNGLE":
        return "jungle"
    if lane in ("MIDDLE", "MID"):
        return "mid"
    if lane in ("BOTTOM", "BOT"):
        return "support" if role == "DUO_SUPPORT" else "adc"
    return None


def format_duration(total_seconds):
    minutes = int(total_seconds) // 60
    seconds = int(total_seconds) % 60
    return f"{minutes}:{seconds:02d}"


def format_match_data(eog_data):
    """LCU EOG 데이터를 서버 포맷으로 변환"""
    if not eog_data or "teams" not in eog_data:
        return None

    teams = eog_data.get("teams", [])
    if len(teams) < 2:
        return None

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
                or champion_id_to_name(p.get("championId"))
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
        "gameId": eog_data.get("gameId"),
        "gameDuration": format_duration(eog_data.get("gameLength", 0)),
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


def print_match_summary(match_data):
    """매치 플레이어/팀 요약 출력"""
    for mp in match_data["players"]:
        print(f"    {mp['team']:4s} | {mp['nickname']:20s} | {mp['champion']}")

    blue = [p for p in match_data["players"] if p["team"] == "blue"]
    red = [p for p in match_data["players"] if p["team"] == "red"]
    blue_win = blue[0]["win"] if blue else False

    print(f"  {'🔵 승' if blue_win else '🔵 패'}: {', '.join(p['champion'] for p in blue)}")
    print(f"  {'🔴 승' if not blue_win else '🔴 패'}: {', '.join(p['champion'] for p in red)}")


def enrich_lanes_from_history(lock_info, match_data, game_id):
    """EOG 데이터에는 포지션이 없어서, 매치 히스토리 상세에서 라인 정보를 보강.
    게임 직후라 히스토리에 아직 없을 수 있음 — 실패해도 무시 (서버가 폴백 처리)"""
    full = get_full_game(lock_info, game_id)
    if not full:
        return
    ident_map = {
        i.get("participantId"): (i.get("player", {}) or {})
        for i in full.get("participantIdentities", [])
    }
    lane_by_name = {}
    for p in full.get("participants", []):
        info = ident_map.get(p.get("participantId"), {})
        name = (
            info.get("summonerName")
            or info.get("gameName")
            or info.get("riotIdGameName")
        )
        lane = lane_from_timeline(p)
        if name and lane:
            lane_by_name[name] = lane
    for mp in match_data["players"]:
        if mp["nickname"] in lane_by_name:
            mp["lane"] = lane_by_name[mp["nickname"]]


def handle_end_of_game(lock_info, last_game_id):
    """게임 종료 처리. 처리한 game_id를 반환 (처리 실패/스킵 시 last_game_id 그대로)"""
    # EOG 데이터가 준비될 때까지 재시도
    eog = None
    for attempt in range(EOG_RETRY_COUNT):
        eog = get_eog_stats(lock_info)
        if eog and eog.get("teams"):
            break
        if attempt < EOG_RETRY_COUNT - 1:
            time.sleep(EOG_RETRY_INTERVAL)

    if not eog:
        print("  ⚠️  EOG 데이터를 가져올 수 없습니다")
        return last_game_id

    game_id = eog.get("gameId")
    if game_id == last_game_id:
        return last_game_id  # 이미 처리한 게임

    # 커스텀 게임 확인
    custom = is_custom_game(lock_info)
    if custom is False:
        print("  ⏭️  커스텀 게임이 아니므로 건너뜁니다 (일반/랭크 게임)")
        return game_id  # 같은 게임을 반복 체크하지 않도록 기록

    match_data = format_match_data(eog)
    if not match_data or len(match_data["players"]) < 2:
        print("  ⚠️  데이터 불완전, 건너뜁니다")
        return game_id

    if custom is None and len(match_data["players"]) != 10:
        print("  ⚠️  커스텀 여부 확인 불가 + 10명이 아니므로 건너뜁니다")
        return game_id

    print(f"  📊 {len(match_data['players'])}명 데이터 추출 완료")
    print(f"  ⏱️  게임 시간: {match_data['gameDuration']}")

    # 닉네임 누락 체크
    empty_names = [p for p in match_data["players"] if not p["nickname"]]
    if empty_names:
        print(f"  ⚠️  닉네임 누락 {len(empty_names)}명! EOG 원본 키 덤프:")
        for p in eog.get("teams", [{}])[0].get("players", [])[:1]:
            print(f"    플레이어 키: {list(p.keys())}")

    print_match_summary(match_data)

    # 포지션 정보 보강 (골드차이 스탯용)
    try:
        enrich_lanes_from_history(lock_info, match_data, game_id)
    except Exception:
        pass

    # 업로드
    print("  📤 서버에 업로드 중...")
    result = upload_match(match_data)
    if result:
        if result.get("duplicate"):
            print("  ℹ️  이미 등록된 게임입니다 (중복 업로드 방지)")
        else:
            print("  ✅ 업로드 성공!")
    else:
        # 로컬 백업 저장
        backup_path = f"match_backup_{game_id}.json"
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(match_data, f, ensure_ascii=False, indent=2)
        print(f"  ⚠️  업로드 실패. 로컬 백업 저장: {backup_path}")

    return game_id


def main():
    print("=" * 50)
    print("  컴학내전 데이터 수집기")
    print("=" * 50)
    print(f"  서버: {SERVER_URL}")
    print(f"  클라이언트 감지 간격: {POLL_INTERVAL}초")
    print()

    last_game_id = None
    was_in_game = False
    client_found = False
    last_phase = "__init__"

    while True:
        # 1. 클라이언트 접속 정보 찾기 (lockfile → 프로세스 순)
        lock_info = get_credentials()
        if not lock_info:
            print("  롤 클라이언트를 찾는 중... (로그인된 롤 클라이언트가 켜져 있어야 합니다)")
            client_found = False
            time.sleep(POLL_INTERVAL)
            continue

        if not client_found:
            print("  ✅ 롤 클라이언트 감지 완료")
            client_found = True

        # 2. 게임 상태 확인
        phase = get_game_phase(lock_info)

        # 대기 상태가 바뀔 때마다 한 줄씩 출력 (멈춘 것처럼 보이지 않게)
        in_game_phases = ("InProgress", "WaitingForStats", "PreEndOfGame", "Reconnect", "EndOfGame")
        if phase != last_phase:
            if phase not in in_game_phases:
                phase_names = {
                    None: "클라이언트 응답 대기",
                    "None": "대기",
                    "Lobby": "로비",
                    "Matchmaking": "매칭 중",
                    "ReadyCheck": "수락 대기",
                    "ChampSelect": "챔피언 선택",
                    "GameStart": "게임 시작",
                }
                print(f"  ⏳ 게임 시작을 기다리는 중... (현재: {phase_names.get(phase, phase)})")
            last_phase = phase

        # 게임 중 (종료 대기 화면 포함 — WaitingForStats/PreEndOfGame에서
        # 플래그를 리셋하면 EndOfGame을 놓치므로 반드시 '게임 중'으로 취급)
        if phase in ("InProgress", "WaitingForStats", "PreEndOfGame", "Reconnect"):
            if not was_in_game:
                print("  🎮 게임 진행 중... 종료를 기다리는 중")
                was_in_game = True
            time.sleep(GAME_CHECK_INTERVAL)
            continue

        if phase == "EndOfGame":
            # 수집기를 게임 종료 후에 켰어도 처리되도록 was_in_game과 무관하게 시도
            # (중복은 game_id + 서버 측 중복 방지로 걸러짐)
            if was_in_game:
                print("  ✅ 게임 종료 감지! 데이터 추출 중...")
            last_game_id = handle_end_of_game(lock_info, last_game_id)
            was_in_game = False
            time.sleep(GAME_CHECK_INTERVAL)
            continue

        # 대기 상태
        was_in_game = False
        time.sleep(POLL_INTERVAL)


def get_current_puuid(lock_info):
    """현재 로그인한 소환사의 puuid"""
    me = lcu_request(lock_info, "/lol-summoner/v1/current-summoner")
    return (me or {}).get("puuid")


def get_match_history(lock_info, count=200):
    """과거 매치 히스토리 가져오기 (puuid 우선, 구버전 엔드포인트 폴백)"""
    endpoints = []
    puuid = get_current_puuid(lock_info)
    if puuid:
        endpoints.append(
            f"/lol-match-history/v1/products/lol/{puuid}/matches?begIndex=0&endIndex={count}"
        )
    endpoints.append(
        f"/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex={count}"
    )

    for endpoint in endpoints:
        data = lcu_request(lock_info, endpoint)
        if data and "games" in data:
            return data["games"].get("games", [])
    return []


def get_full_game(lock_info, game_id):
    """특정 게임의 10명 전체 상세 데이터 조회
    (히스토리 목록에는 본인 참가자 정보만 들어있음)"""
    return lcu_request(lock_info, f"/lol-match-history/v1/games/{game_id}")


def format_history_match(game):
    """매치 히스토리 상세 데이터를 서버 포맷으로 변환"""
    participants = game.get("participants", [])
    identities = game.get("participantIdentities", [])

    # participantId → 닉네임 매핑
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
            "champion": champion_id_to_name(p.get("championId")),
            "lane": lane_from_timeline(p),
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
        "gameId": game.get("gameId"),
        "gameDuration": format_duration(game.get("gameDuration", 0)),
        "players": players,
        "gameMode": game.get("gameMode", "CLASSIC"),
    }


def parse_selection(choice, total):
    """선택 입력 파싱: '1,3,5' / '1-5' / 'all' → 인덱스 리스트 (실패 시 None)"""
    if choice.lower() == "all":
        return list(range(total))

    selected = set()
    try:
        for part in choice.split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                start, end = part.split("-", 1)
                for n in range(int(start) - 1, int(end)):
                    selected.add(n)
            else:
                selected.add(int(part) - 1)
    except ValueError:
        return None

    return sorted(s for s in selected if 0 <= s < total)


def history_mode():
    """과거 커스텀 게임 조회 → 선택 업로드"""
    print("=" * 50)
    print("  컴학내전 — 과거 경기 가져오기")
    print("=" * 50)

    lock_info = get_credentials()
    if not lock_info:
        print("  ❌ 롤 클라이언트를 찾을 수 없습니다.")
        print("     리엇 런처 말고, 로그인 후 뜨는 롤 클라이언트(로비 화면)가 켜져 있어야 합니다.")
        return

    print("  클라이언트 감지 완료. 매치 히스토리 조회 중...")
    games = get_match_history(lock_info, 200)

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
    print("  (목록에는 내 정보만 표시됩니다. 전체 명단은 선택 후 조회됩니다)\n")

    for i, game in enumerate(custom_games):
        duration = format_duration(game.get("gameDuration", 0))

        timestamp = game.get("gameCreation", 0) / 1000
        date_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M") if timestamp else "?"

        # 히스토리 목록에는 본인 참가자만 들어있음 → 내 챔피언/승패만 표시
        me = (game.get("participants") or [{}])[0]
        my_champ = champion_id_to_name(me.get("championId"))
        my_win = me.get("stats", {}).get("win", False)

        print(f"  [{i+1:2d}] {date_str}  ({duration})  {my_champ:15s} {'✅ 승' if my_win else '❌ 패'}")

    # 사용자 선택
    print()
    print("  ─────────────────────────────────")
    print("  업로드할 게임 번호를 입력하세요.")
    print("  여러 개: 1,3,5  |  범위: 1-5  |  전체: all  |  취소: q")
    print()

    while True:
        choice = input("  선택: ").strip()
        if choice.lower() == "q":
            print("  취소합니다.")
            return
        selected = parse_selection(choice, len(custom_games))
        if selected is None:
            print("  ⚠️  잘못된 입력입니다. 예: 1,3,5 또는 1-5 또는 all")
            continue
        if not selected:
            print("  ⚠️  선택된 게임이 없습니다. 다시 입력해주세요.")
            continue
        break

    print(f"\n  {len(selected)}개 게임 업로드 시작...\n")

    success = 0
    for idx in selected:
        game_id = custom_games[idx].get("gameId")
        if not game_id:
            print(f"  [{idx+1}] ⚠️  gameId 없음, 건너뜀")
            continue

        # 전체 10명 데이터 조회 (목록에는 본인만 들어있음)
        full_game = get_full_game(lock_info, game_id)
        if not full_game:
            print(f"  [{idx+1}] ⚠️  상세 데이터 조회 실패, 건너뜀")
            continue

        match_data = format_history_match(full_game)

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
            if result.get("duplicate"):
                print("       ℹ️  이미 등록된 게임 (건너뜀)")
            else:
                print("       ✅ 업로드 성공!")
                success += 1
        else:
            print("       ❌ 업로드 실패")

    print(f"\n  완료: {success}/{len(selected)} 업로드됨")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--history":
            history_mode()
        else:
            main()
    except KeyboardInterrupt:
        print("\n  종료합니다.")

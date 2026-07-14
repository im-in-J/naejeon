"""
컴학내전 데이터 수집기 (GUI)
- 롤 클라이언트 자동 감지
- 게임 종료 시 상세 데이터 추출 → 서버 자동 업로드
- 과거 커스텀 게임 조회 → 선택 업로드

설치: Python 3만 있으면 됨 (외부 패키지 불필요, GUI는 내장 tkinter 사용)
실행: 내전수집기.bat 더블클릭  (또는 python collector.py)
콘솔 모드: python collector.py --cli / --history
"""

import json
import time
import os
import re
import sys
import ssl
import base64
import threading
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

# 모듈 전역 로거 — GUI 모드에서 큐에 넣는 함수로 교체됨
log = print


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
        flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
        out = subprocess.run(
            [
                "powershell", "-NoProfile", "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\""
                " | ForEach-Object { $_.CommandLine }",
            ],
            capture_output=True,
            timeout=20,
            creationflags=flags,
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
        log(f"  HTTP 에러: {e.code}")
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
        log(f"  ⚠️  챔피언 목록 로드 실패 ({e}) — 챔피언이 숫자로 표시될 수 있습니다")
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


def extract_bans(game):
    """매치 상세의 teams[].bans에서 밴 챔피언 추출 (드래프트 모드만 존재)"""
    bans = {"blue": [], "red": []}
    for team in game.get("teams", []):
        side = "blue" if team.get("teamId", 100) == 100 else "red"
        team_bans = sorted(team.get("bans", []) or [], key=lambda b: b.get("pickTurn", 0))
        for b in team_bans:
            cid = b.get("championId", -1)
            if cid and cid != -1:  # -1 = 밴 안 함
                bans[side].append(champion_id_to_name(cid))
    return bans if (bans["blue"] or bans["red"]) else None


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
                "turretDamage": stats.get("TOTAL_DAMAGE_DEALT_TO_TURRETS", 0),
                "firstBlood": bool(stats.get("FIRST_BLOOD", 0)),
                "largestMultiKill": stats.get("LARGEST_MULTI_KILL", 0),
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
        log(f"  업로드 실패: {e.code} - {body}")
        return None
    except Exception as e:
        log(f"  업로드 에러: {e}")
        return None


def print_match_summary(match_data):
    """매치 플레이어/팀 요약 출력"""
    blue = [p for p in match_data["players"] if p["team"] == "blue"]
    red = [p for p in match_data["players"] if p["team"] == "red"]
    blue_win = blue[0]["win"] if blue else False

    log(f"  {'🔵 승' if blue_win else '🔵 패'}: {', '.join(p['nickname'] for p in blue)}")
    log(f"  {'🔴 승' if not blue_win else '🔴 패'}: {', '.join(p['nickname'] for p in red)}")


def enrich_from_history(lock_info, match_data, game_id):
    """EOG에 없거나 불확실한 정보(포지션, 포탑딜, 선취점, 멀티킬)를
    매치 히스토리 상세로 보강. 게임 직후라 히스토리에 아직 없을 수
    있음 — 실패해도 무시 (서버가 폴백 처리)"""
    full = get_full_game(lock_info, game_id)
    if not full:
        return
    bans = extract_bans(full)
    if bans:
        match_data["bans"] = bans
    if full.get("gameCreation"):
        match_data["gameCreation"] = full["gameCreation"]
    ident_map = {
        i.get("participantId"): (i.get("player", {}) or {})
        for i in full.get("participantIdentities", [])
    }
    extra_by_name = {}
    for p in full.get("participants", []):
        info = ident_map.get(p.get("participantId"), {})
        name = (
            info.get("summonerName")
            or info.get("gameName")
            or info.get("riotIdGameName")
        )
        if not name:
            continue
        stats = p.get("stats", {})
        extra_by_name[name] = {
            "lane": lane_from_timeline(p),
            "turretDamage": stats.get("damageDealtToTurrets", 0),
            "firstBlood": stats.get("firstBloodKill", False),
            "largestMultiKill": stats.get("largestMultiKill", 0),
        }
    for mp in match_data["players"]:
        extra = extra_by_name.get(mp["nickname"])
        if not extra:
            continue
        if extra["lane"]:
            mp["lane"] = extra["lane"]
        if extra["turretDamage"]:
            mp["turretDamage"] = extra["turretDamage"]
        if extra["firstBlood"]:
            mp["firstBlood"] = True
        if extra["largestMultiKill"]:
            mp["largestMultiKill"] = extra["largestMultiKill"]


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
        log("  ⚠️  EOG 데이터를 가져올 수 없습니다")
        return last_game_id

    game_id = eog.get("gameId")
    if game_id == last_game_id:
        return last_game_id  # 이미 처리한 게임

    # 커스텀 게임 확인
    custom = is_custom_game(lock_info)
    if custom is False:
        log("  ⏭️  커스텀 게임이 아니므로 건너뜁니다 (일반/랭크 게임)")
        return game_id  # 같은 게임을 반복 체크하지 않도록 기록

    match_data = format_match_data(eog)
    if not match_data or len(match_data["players"]) < 2:
        log("  ⚠️  데이터 불완전, 건너뜁니다")
        return game_id

    if custom is None and len(match_data["players"]) != 10:
        log("  ⚠️  커스텀 여부 확인 불가 + 10명이 아니므로 건너뜁니다")
        return game_id

    log(f"  📊 {len(match_data['players'])}명 데이터 추출 완료")
    log(f"  ⏱️  게임 시간: {match_data['gameDuration']}")

    # 닉네임 누락 체크
    empty_names = [p for p in match_data["players"] if not p["nickname"]]
    if empty_names:
        log(f"  ⚠️  닉네임 누락 {len(empty_names)}명!")

    print_match_summary(match_data)

    # 포지션·포탑딜·선취점·멀티킬 보강
    try:
        enrich_from_history(lock_info, match_data, game_id)
    except Exception:
        pass

    # 업로드
    log("  📤 서버에 업로드 중...")
    result = upload_match(match_data)
    if result:
        if result.get("updated"):
            log("  🔄 기존 경기 갱신 완료 (날짜·스탯 덮어쓰기)")
        elif result.get("duplicate"):
            log("  ℹ️  이미 등록된 게임입니다 (중복 업로드 방지)")
        else:
            log("  ✅ 업로드 성공!")
    else:
        # 로컬 백업 저장
        backup_path = f"match_backup_{game_id}.json"
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(match_data, f, ensure_ascii=False, indent=2)
        log(f"  ⚠️  업로드 실패. 로컬 백업 저장: {backup_path}")

    return game_id


PHASE_NAMES = {
    None: "클라이언트 응답 대기",
    "None": "대기",
    "Lobby": "로비",
    "Matchmaking": "매칭 중",
    "ReadyCheck": "수락 대기",
    "ChampSelect": "챔피언 선택",
    "GameStart": "게임 시작",
}

IN_GAME_PHASES = ("InProgress", "WaitingForStats", "PreEndOfGame", "Reconnect")


def realtime_loop(stop_event, set_status):
    """실시간 수집 루프. stop_event가 set되면 종료.
    set_status(text)로 현재 상태를 한 줄로 알림 (GUI 상태 표시줄 / 콘솔 출력)"""
    last_game_id = None
    was_in_game = False
    client_found = False
    last_phase = "__init__"

    while not stop_event.is_set():
        # 1. 클라이언트 접속 정보 찾기 (lockfile → 프로세스 순)
        lock_info = get_credentials()
        if not lock_info:
            set_status("롤 클라이언트를 찾는 중... (로그인된 롤 클라이언트가 켜져 있어야 합니다)")
            client_found = False
            if stop_event.wait(POLL_INTERVAL):
                break
            continue

        if not client_found:
            log("  ✅ 롤 클라이언트 감지 완료")
            client_found = True

        # 2. 게임 상태 확인
        phase = get_game_phase(lock_info)

        if phase != last_phase:
            if phase not in IN_GAME_PHASES and phase != "EndOfGame":
                set_status(f"게임 시작을 기다리는 중 (현재: {PHASE_NAMES.get(phase, phase)})")
            last_phase = phase

        # 게임 중 (종료 대기 화면 포함 — WaitingForStats/PreEndOfGame에서
        # 플래그를 리셋하면 EndOfGame을 놓치므로 반드시 '게임 중'으로 취급)
        if phase in IN_GAME_PHASES:
            if not was_in_game:
                log("  🎮 게임 진행 중... 종료를 기다리는 중")
                was_in_game = True
            set_status("게임 진행 중 — 종료를 기다리는 중")
            if stop_event.wait(GAME_CHECK_INTERVAL):
                break
            continue

        if phase == "EndOfGame":
            # 수집기를 게임 종료 후에 켰어도 처리되도록 was_in_game과 무관하게 시도
            # (중복은 game_id + 서버 측 중복 방지로 걸러짐)
            if was_in_game:
                log("  ✅ 게임 종료 감지! 데이터 추출 중...")
            set_status("게임 종료 — 데이터 추출/업로드 중")
            last_game_id = handle_end_of_game(lock_info, last_game_id)
            was_in_game = False
            if stop_event.wait(GAME_CHECK_INTERVAL):
                break
            continue

        # 대기 상태
        was_in_game = False
        if stop_event.wait(POLL_INTERVAL):
            break


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
            "turretDamage": stats.get("damageDealtToTurrets", 0),
            "firstBlood": stats.get("firstBloodKill", False),
            "largestMultiKill": stats.get("largestMultiKill", 0),
        }
        players.append(player)

    return {
        "gameId": game.get("gameId"),
        "gameCreation": game.get("gameCreation"),  # 실제 게임 시작 시각 (epoch ms)
        "gameDuration": format_duration(game.get("gameDuration", 0)),
        "players": players,
        "gameMode": game.get("gameMode", "CLASSIC"),
        "bans": extract_bans(game),
    }


def fetch_custom_games(lock_info):
    """매치 히스토리에서 커스텀 게임만 필터해 반환"""
    games = get_match_history(lock_info, 200)
    return [
        g for g in games
        if g.get("queueId", -1) == 0 or g.get("gameType") == "CUSTOM_GAME"
    ]


def upload_history_game(lock_info, game, label=""):
    """과거 게임 1개 상세 조회 → 업로드. 성공 여부 반환"""
    game_id = game.get("gameId")
    if not game_id:
        log(f"  {label} ⚠️  gameId 없음, 건너뜀")
        return False

    # 전체 10명 데이터 조회 (목록에는 본인만 들어있음)
    full_game = get_full_game(lock_info, game_id)
    if not full_game:
        log(f"  {label} ⚠️  상세 데이터 조회 실패, 건너뜀")
        return False

    match_data = format_history_match(full_game)
    if not match_data or len(match_data["players"]) < 2:
        log(f"  {label} ⚠️  데이터 불완전, 건너뜀")
        return False

    blue = [p for p in match_data["players"] if p["team"] == "blue"]
    red = [p for p in match_data["players"] if p["team"] == "red"]
    blue_names = ", ".join(p["nickname"] for p in blue)
    red_names = ", ".join(p["nickname"] for p in red)
    log(f"  {label} {match_data['gameDuration']} | {blue_names} vs {red_names}")

    result = upload_match(match_data)
    if result:
        if result.get("updated"):
            log("       🔄 기존 경기 갱신 (날짜·스탯 덮어쓰기)")
            return True
        if result.get("duplicate"):
            log("       ℹ️  이미 등록된 게임 (건너뜀)")
            return False
        log("       ✅ 업로드 성공!")
        return True
    log("       ❌ 업로드 실패")
    return False


def history_game_summary(game):
    """히스토리 목록 한 줄 요약: (날짜, 시간, 내 챔피언, 승패)"""
    duration = format_duration(game.get("gameDuration", 0))
    timestamp = game.get("gameCreation", 0) / 1000
    date_str = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M") if timestamp else "?"
    # 히스토리 목록에는 본인 참가자만 들어있음 → 내 챔피언/승패만 표시
    me = (game.get("participants") or [{}])[0]
    my_champ = champion_id_to_name(me.get("championId"))
    my_win = me.get("stats", {}).get("win", False)
    return date_str, duration, my_champ, my_win


# ═══════════════════════════════════════════════
#  GUI (tkinter — 파이썬 기본 내장)
# ═══════════════════════════════════════════════

# 다크 테마 색상
C_BG = "#16171c"
C_PANEL = "#1e2027"
C_PANEL2 = "#262933"
C_FG = "#e7e9ee"
C_MUTED = "#9aa0ad"
C_ACCENT = "#5b8cff"
C_ACCENT_HOVER = "#6f9aff"
C_GREEN = "#3ecf8e"
C_RED = "#f06a6a"
C_BORDER = "#33363f"


class CollectorGUI:
    def __init__(self, root):
        import tkinter as tk
        from tkinter import ttk
        import queue

        self.tk = tk
        self.ttk = ttk
        self.root = root
        self.ui_queue = queue.Queue()
        self.stop_event = None
        self.worker = None
        self.custom_games = []
        self.lock_info_for_history = None
        self.busy = False

        # 전역 log를 GUI 큐로 교체 (워커 스레드에서 호출됨)
        global log
        log = self.log_from_thread

        root.title("컴학내전 데이터 수집기")
        root.geometry("760x600")
        root.minsize(620, 480)
        root.configure(bg=C_BG)
        root.protocol("WM_DELETE_WINDOW", self.on_close)

        self._setup_style()
        self._build_layout()

        self.log(f"서버: {SERVER_URL}")
        self.log("[실시간 수집 시작] 버튼을 누르면 게임 종료 시 자동으로 업로드됩니다.")
        root.after(100, self._poll_queue)

    # ─── 스타일 ───

    def _setup_style(self):
        ttk = self.ttk
        style = ttk.Style(self.root)
        try:
            style.theme_use("clam")
        except Exception:
            pass

        style.configure(".", background=C_BG, foreground=C_FG, fieldbackground=C_PANEL)
        style.configure("TNotebook", background=C_BG, borderwidth=0)
        style.configure("TNotebook.Tab", background=C_PANEL, foreground=C_MUTED,
                        padding=(18, 8), borderwidth=0, font=("맑은 고딕", 10))
        style.map("TNotebook.Tab",
                  background=[("selected", C_PANEL2)],
                  foreground=[("selected", C_FG)])
        style.configure("TFrame", background=C_BG)
        style.configure("Panel.TFrame", background=C_PANEL)

        style.configure("Treeview", background=C_PANEL, foreground=C_FG,
                        fieldbackground=C_PANEL, borderwidth=0, rowheight=26,
                        font=("맑은 고딕", 9))
        style.configure("Treeview.Heading", background=C_PANEL2, foreground=C_MUTED,
                        borderwidth=0, font=("맑은 고딕", 9, "bold"))
        style.map("Treeview",
                  background=[("selected", C_ACCENT)],
                  foreground=[("selected", "#ffffff")])
        style.configure("Vertical.TScrollbar", background=C_PANEL2,
                        troughcolor=C_BG, borderwidth=0, arrowcolor=C_MUTED)

    def _button(self, parent, text, command, primary=False, **kw):
        tk = self.tk
        btn = tk.Button(
            parent, text=text, command=command,
            bg=C_ACCENT if primary else C_PANEL2,
            fg="#ffffff" if primary else C_FG,
            activebackground=C_ACCENT_HOVER if primary else C_BORDER,
            activeforeground="#ffffff",
            relief="flat", bd=0, cursor="hand2",
            font=("맑은 고딕", 10, "bold" if primary else "normal"),
            padx=16, pady=7, **kw,
        )
        return btn

    # ─── 레이아웃 ───

    def _build_layout(self):
        tk, ttk = self.tk, self.ttk

        # 헤더
        header = tk.Frame(self.root, bg=C_BG)
        header.pack(fill="x", padx=16, pady=(14, 8))
        tk.Label(header, text="컴학내전 데이터 수집기", bg=C_BG, fg=C_FG,
                 font=("맑은 고딕", 14, "bold")).pack(side="left")
        self.server_label = tk.Label(header, text=SERVER_URL.replace("https://", ""),
                                     bg=C_BG, fg=C_MUTED, font=("맑은 고딕", 9))
        self.server_label.pack(side="right")

        # 탭
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True, padx=16, pady=(0, 8))

        self._build_realtime_tab()
        self._build_history_tab()

        # 로그 (공용)
        log_frame = tk.Frame(self.root, bg=C_BG)
        log_frame.pack(fill="both", expand=True, padx=16, pady=(0, 12))
        tk.Label(log_frame, text="로그", bg=C_BG, fg=C_MUTED,
                 font=("맑은 고딕", 9)).pack(anchor="w")
        text_wrap = tk.Frame(log_frame, bg=C_BORDER)
        text_wrap.pack(fill="both", expand=True, pady=(4, 0))
        self.log_text = tk.Text(
            text_wrap, height=9, bg=C_PANEL, fg=C_FG, bd=0,
            insertbackground=C_FG, wrap="word", state="disabled",
            font=("Consolas", 9), padx=10, pady=8,
        )
        scroll = tk.Scrollbar(text_wrap, command=self.log_text.yview,
                              bg=C_PANEL2, troughcolor=C_BG, bd=0)
        self.log_text.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y", padx=(0, 1), pady=1)
        self.log_text.pack(fill="both", expand=True, padx=1, pady=1)

    def _build_realtime_tab(self):
        tk = self.tk
        tab = tk.Frame(self.notebook, bg=C_PANEL2)
        self.notebook.add(tab, text="  실시간 수집  ")

        inner = tk.Frame(tab, bg=C_PANEL2)
        inner.pack(fill="both", expand=True, padx=24, pady=20)

        tk.Label(inner, text="게임이 끝나면 자동으로 서버에 업로드합니다.",
                 bg=C_PANEL2, fg=C_MUTED, font=("맑은 고딕", 10)).pack(anchor="w")
        tk.Label(inner, text="내전 하는 동안 켜두기만 하면 됩니다. (커스텀 게임만 업로드)",
                 bg=C_PANEL2, fg=C_MUTED, font=("맑은 고딕", 10)).pack(anchor="w", pady=(2, 14))

        row = tk.Frame(inner, bg=C_PANEL2)
        row.pack(fill="x")
        self.start_btn = self._button(row, "▶  실시간 수집 시작", self.toggle_realtime, primary=True)
        self.start_btn.pack(side="left")

        status_row = tk.Frame(inner, bg=C_PANEL2)
        status_row.pack(fill="x", pady=(16, 0))
        self.status_dot = tk.Label(status_row, text="●", bg=C_PANEL2, fg=C_MUTED,
                                   font=("맑은 고딕", 11))
        self.status_dot.pack(side="left")
        self.status_label = tk.Label(status_row, text="대기 중 — 시작 버튼을 눌러주세요",
                                     bg=C_PANEL2, fg=C_MUTED, font=("맑은 고딕", 10))
        self.status_label.pack(side="left", padx=(6, 0))

    def _build_history_tab(self):
        tk, ttk = self.tk, self.ttk
        tab = tk.Frame(self.notebook, bg=C_PANEL2)
        self.notebook.add(tab, text="  과거 경기 가져오기  ")

        inner = tk.Frame(tab, bg=C_PANEL2)
        inner.pack(fill="both", expand=True, padx=24, pady=16)

        toolbar = tk.Frame(inner, bg=C_PANEL2)
        toolbar.pack(fill="x", pady=(0, 10))
        self.load_btn = self._button(toolbar, "경기 불러오기", self.load_history)
        self.load_btn.pack(side="left")
        self.select_all_btn = self._button(toolbar, "전체 선택", self.select_all_games)
        self.select_all_btn.pack(side="left", padx=(8, 0))
        self.upload_btn = self._button(toolbar, "선택한 경기 업로드", self.upload_selected, primary=True)
        self.upload_btn.pack(side="right")

        hint = tk.Label(inner, text="Ctrl/Shift 클릭으로 여러 경기를 선택할 수 있습니다. (목록에는 내 챔피언/승패만 표시)",
                        bg=C_PANEL2, fg=C_MUTED, font=("맑은 고딕", 9))
        hint.pack(anchor="w", pady=(0, 6))

        tree_wrap = tk.Frame(inner, bg=C_BORDER)
        tree_wrap.pack(fill="both", expand=True)
        columns = ("no", "date", "duration", "champ", "result")
        self.tree = ttk.Treeview(tree_wrap, columns=columns, show="headings",
                                 selectmode="extended")
        self.tree.heading("no", text="#")
        self.tree.heading("date", text="날짜")
        self.tree.heading("duration", text="게임 시간")
        self.tree.heading("champ", text="내 챔피언")
        self.tree.heading("result", text="결과")
        self.tree.column("no", width=44, anchor="center", stretch=False)
        self.tree.column("date", width=150, anchor="center")
        self.tree.column("duration", width=90, anchor="center", stretch=False)
        self.tree.column("champ", width=140, anchor="center")
        self.tree.column("result", width=70, anchor="center", stretch=False)
        self.tree.tag_configure("win", foreground=C_GREEN)
        self.tree.tag_configure("loss", foreground=C_RED)

        tree_scroll = ttk.Scrollbar(tree_wrap, orient="vertical", command=self.tree.yview)
        self.tree.configure(yscrollcommand=tree_scroll.set)
        tree_scroll.pack(side="right", fill="y", padx=(0, 1), pady=1)
        self.tree.pack(fill="both", expand=True, padx=1, pady=1)

    # ─── 로그/상태 (스레드 → UI 큐) ───

    def log_from_thread(self, *args):
        self.ui_queue.put(("log", " ".join(str(a) for a in args)))

    def log(self, text):
        self.log_text.configure(state="normal")
        stamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{stamp}] {text.strip()}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def set_status_from_thread(self, text):
        self.ui_queue.put(("status", text))

    def _poll_queue(self):
        try:
            while True:
                kind, payload = self.ui_queue.get_nowait()
                if kind == "log":
                    self.log(payload)
                elif kind == "status":
                    self.status_label.configure(text=payload)
                elif kind == "games":
                    self._show_games(payload)
                elif kind == "busy_done":
                    self._set_busy(False)
        except Exception:
            pass
        self.root.after(100, self._poll_queue)

    def _set_busy(self, busy):
        self.busy = busy
        state = "disabled" if busy else "normal"
        for btn in (self.load_btn, self.upload_btn, self.select_all_btn):
            btn.configure(state=state)

    # ─── 실시간 수집 ───

    def toggle_realtime(self):
        if self.stop_event is None:
            self.stop_event = threading.Event()
            self.worker = threading.Thread(
                target=self._realtime_worker, daemon=True)
            self.worker.start()
            self.start_btn.configure(text="■  실시간 수집 중지", bg=C_RED,
                                     activebackground="#ff8080")
            self.status_dot.configure(fg=C_GREEN)
            self.status_label.configure(text="시작됨 — 롤 클라이언트를 찾는 중...")
            self.log("실시간 수집을 시작합니다.")
        else:
            self.stop_event.set()
            self.stop_event = None
            self.start_btn.configure(text="▶  실시간 수집 시작", bg=C_ACCENT,
                                     activebackground=C_ACCENT_HOVER)
            self.status_dot.configure(fg=C_MUTED)
            self.status_label.configure(text="대기 중 — 시작 버튼을 눌러주세요")
            self.log("실시간 수집을 중지했습니다.")

    def _realtime_worker(self):
        stop = self.stop_event
        try:
            realtime_loop(stop, self.set_status_from_thread)
        except Exception as e:
            self.log_from_thread(f"⚠️  수집 루프 오류: {e}")

    # ─── 과거 경기 ───

    def load_history(self):
        if self.busy:
            return
        self._set_busy(True)
        self.log("매치 히스토리 조회 중...")
        threading.Thread(target=self._load_history_worker, daemon=True).start()

    def _load_history_worker(self):
        try:
            lock_info = get_credentials()
            if not lock_info:
                self.log_from_thread("❌ 롤 클라이언트를 찾을 수 없습니다. 리엇 런처 말고, 로그인 후 뜨는 롤 클라이언트(로비 화면)가 켜져 있어야 합니다.")
                self.ui_queue.put(("games", []))
                return
            self.lock_info_for_history = lock_info
            games = fetch_custom_games(lock_info)
            if not games:
                self.log_from_thread("최근 200경기 중 커스텀 게임이 없습니다.")
            self.ui_queue.put(("games", games))
        except Exception as e:
            self.log_from_thread(f"⚠️  조회 실패: {e}")
            self.ui_queue.put(("games", []))
        finally:
            self.ui_queue.put(("busy_done", None))

    def _show_games(self, games):
        self.custom_games = games
        self.tree.delete(*self.tree.get_children())
        for i, game in enumerate(games):
            date_str, duration, my_champ, my_win = history_game_summary(game)
            self.tree.insert(
                "", "end", iid=str(i),
                values=(i + 1, date_str, duration, my_champ, "승" if my_win else "패"),
                tags=("win" if my_win else "loss",),
            )
        if games:
            self.log(f"커스텀 게임 {len(games)}개를 찾았습니다. 업로드할 경기를 선택하세요.")
            self.notebook.select(1)

    def select_all_games(self):
        self.tree.selection_set(self.tree.get_children())

    def upload_selected(self):
        if self.busy:
            return
        selected = [int(i) for i in self.tree.selection()]
        if not selected:
            self.log("⚠️  선택된 경기가 없습니다. 목록에서 경기를 클릭해 선택하세요.")
            return
        self._set_busy(True)
        threading.Thread(target=self._upload_worker, args=(sorted(selected),), daemon=True).start()

    def _upload_worker(self, indices):
        try:
            lock_info = self.lock_info_for_history or get_credentials()
            if not lock_info:
                self.log_from_thread("❌ 롤 클라이언트를 찾을 수 없습니다.")
                return
            self.log_from_thread(f"{len(indices)}개 경기 업로드 시작...")
            success = 0
            for idx in indices:
                if upload_history_game(lock_info, self.custom_games[idx], label=f"[{idx + 1}]"):
                    success += 1
            self.log_from_thread(f"완료: {success}/{len(indices)} 업로드됨")
        except Exception as e:
            self.log_from_thread(f"⚠️  업로드 실패: {e}")
        finally:
            self.ui_queue.put(("busy_done", None))

    def on_close(self):
        if self.stop_event is not None:
            self.stop_event.set()
        self.root.destroy()


def run_gui():
    try:
        import tkinter as tk
    except ImportError:
        # tkinter가 없는 환경(임베디드 파이썬 등) — 안내 후 콘솔 모드로
        _show_windows_alert(
            "이 파이썬에는 tkinter(GUI)가 없습니다.\n"
            "python.org 설치 파이썬을 사용하거나,\n"
            "콘솔 모드로 실행하세요: python collector.py --cli"
        )
        return cli_main()

    try:
        # 고해상도 모니터에서 흐릿하게 보이는 것 방지
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass

    root = tk.Tk()
    CollectorGUI(root)
    root.mainloop()


def _show_windows_alert(message):
    """콘솔 없이(pythonw) 실행됐을 때도 보이는 안내창"""
    try:
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, message, "컴학내전 수집기", 0x10)
    except Exception:
        print(message)


# ═══════════════════════════════════════════════
#  콘솔 모드 (--cli / --history)
# ═══════════════════════════════════════════════


def cli_main():
    print("=" * 50)
    print("  컴학내전 데이터 수집기")
    print("=" * 50)
    print(f"  서버: {SERVER_URL}")
    print(f"  클라이언트 감지 간격: {POLL_INTERVAL}초")
    print()

    stop_event = threading.Event()

    def set_status(text):
        print(f"  ⏳ {text}")

    realtime_loop(stop_event, set_status)


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
    """과거 커스텀 게임 조회 → 선택 업로드 (콘솔)"""
    print("=" * 50)
    print("  컴학내전 — 과거 경기 가져오기")
    print("=" * 50)

    lock_info = get_credentials()
    if not lock_info:
        print("  ❌ 롤 클라이언트를 찾을 수 없습니다.")
        print("     리엇 런처 말고, 로그인 후 뜨는 롤 클라이언트(로비 화면)가 켜져 있어야 합니다.")
        return

    print("  클라이언트 감지 완료. 매치 히스토리 조회 중...")
    custom_games = fetch_custom_games(lock_info)

    if not custom_games:
        print("  커스텀 게임이 없거나 매치 히스토리를 가져올 수 없습니다.")
        return

    print(f"\n  커스텀 게임 {len(custom_games)}개 발견:\n")
    print("  (목록에는 내 정보만 표시됩니다. 전체 명단은 선택 후 조회됩니다)\n")

    for i, game in enumerate(custom_games):
        date_str, duration, my_champ, my_win = history_game_summary(game)
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
        if upload_history_game(lock_info, custom_games[idx], label=f"[{idx+1}]"):
            success += 1

    print(f"\n  완료: {success}/{len(selected)} 업로드됨")


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--history":
            history_mode()
        elif len(sys.argv) > 1 and sys.argv[1] == "--cli":
            cli_main()
        else:
            run_gui()
    except KeyboardInterrupt:
        print("\n  종료합니다.")

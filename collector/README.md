# 컴학내전 데이터 수집기

게임 종료 시 자동으로 상세 데이터를 추출해서 서버에 업로드합니다.
GUI 프로그램으로 동작합니다 (tkinter — 파이썬 기본 내장).

## 설치

Python 3.8+만 있으면 됩니다. 외부 패키지 설치 불필요 (표준 라이브러리만 사용).

## 설정

`collector.py` 상단의 설정값 수정:

```python
SERVER_URL = "https://your-site.vercel.app"  # 실제 배포 URL
UPLOAD_SECRET = "naejeon-upload-2024"         # 서버와 동일하게
```

> 사이트의 `/api/collector`에서 다운로드하면 위 두 값이 자동으로 채워진 zip이 내려갑니다.

롤 설치 경로가 기본이 아닌 경우:
```bash
set LOL_PATH=D:\Games\League of Legends
```

## 실행

```bash
내전수집기.bat 더블클릭          # GUI 실행 (콘솔 창 없음)
python collector.py            # GUI 직접 실행
python collector.py --cli      # 콘솔 모드: 실시간 수집
python collector.py --history  # 콘솔 모드: 과거 커스텀 게임 선택 업로드
```

## GUI 구성

- **실시간 수집 탭** — 시작 버튼 하나. 게임 끝나면 자동 업로드, 상태 표시줄로 진행 상황 확인
- **과거 경기 가져오기 탭** — 경기 불러오기 → 목록에서 선택(Ctrl/Shift 다중 선택) → 업로드
- **로그 창** — 감지/추출/업로드 진행 내역 표시

## 동작 방식

1. 롤 클라이언트 lockfile 자동 감지 (실패 시 프로세스에서 접속 정보 추출)
2. 게임 진행 중 → 종료 대기 (전적 화면 로딩 중에도 놓치지 않음)
3. 게임 종료 → LCU API로 상세 스탯 추출 (준비 안 됐으면 3초 간격 재시도)
4. 커스텀 게임만 서버에 자동 업로드 (gameId로 중복 업로드 방지)
5. 업로드 실패 시 로컬 JSON 백업

## 추출 데이터

킬/데스/어시, CS, 골드, 딜량, 받은 피해, 시야 점수, 와드 설치/제거, 오브젝트 피해, CC 점수, 힐/쉴드량

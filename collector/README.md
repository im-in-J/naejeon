# 컴학내전 데이터 수집기

게임 종료 시 자동으로 상세 데이터를 추출해서 서버에 업로드합니다.

## 설치

```bash
# Python 3.8+ 필요
pip install requests psutil
```

## 설정

`collector.py` 상단의 설정값 수정:

```python
SERVER_URL = "https://your-site.vercel.app"  # 실제 배포 URL
UPLOAD_SECRET = "naejeon-upload-2024"         # 서버와 동일하게
```

롤 설치 경로가 기본이 아닌 경우:
```bash
set LOL_PATH=D:\Games\League of Legends
```

## 실행

```bash
python collector.py
```

## 동작 방식

1. 롤 클라이언트 lockfile 자동 감지
2. 게임 진행 중 → 종료 대기
3. 게임 종료 → LCU API로 상세 스탯 추출
4. 서버에 자동 업로드
5. 업로드 실패 시 로컬 JSON 백업

## 추출 데이터

킬/데스/어시, CS, 골드, 딜량, 받은 피해, 시야 점수, 와드 설치/제거, 오브젝트 피해, CC 점수, 힐/쉴드량

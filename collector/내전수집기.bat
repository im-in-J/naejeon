@echo off
chcp 65001 >nul
title 컴학내전 수집기
echo.
echo  ==========================================
echo   컴학내전 데이터 수집기
echo  ==========================================
echo.
echo   1. 실시간 수집 (게임 끝나면 자동 업로드)
echo   2. 과거 경기 가져오기
echo   3. 종료
echo.
set /p choice=  선택 (1/2/3):

if "%choice%"=="1" (
    python "%~dp0naejeon-collector.py"
) else if "%choice%"=="2" (
    python "%~dp0naejeon-collector.py" --history
) else (
    exit
)
pause

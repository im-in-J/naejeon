@echo off
chcp 65001 >nul
title 컴학내전 수집기

:menu
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
    echo.
    echo  실시간 수집을 시작합니다...
    echo.
    python "%~dp0naejeon-collector.py"
    if errorlevel 1 (
        echo.
        echo  ========================================
        echo   오류 발생! Python이 설치되어 있는지 확인하세요.
        echo   https://python.org/downloads 에서 설치 후
        echo   설치 시 "Add Python to PATH" 반드시 체크!
        echo  ========================================
    )
) else if "%choice%"=="2" (
    echo.
    echo  과거 경기를 조회합니다...
    echo.
    python "%~dp0naejeon-collector.py" --history
    if errorlevel 1 (
        echo.
        echo  ========================================
        echo   오류 발생! Python이 설치되어 있는지 확인하세요.
        echo   https://python.org/downloads 에서 설치 후
        echo   설치 시 "Add Python to PATH" 반드시 체크!
        echo  ========================================
    )
) else if "%choice%"=="3" (
    exit
) else (
    echo  잘못된 입력입니다. 1, 2, 3 중 선택하세요.
    goto menu
)

echo.
echo  아무 키나 누르면 메뉴로 돌아갑니다...
pause >nul
goto menu

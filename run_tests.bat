@echo off
echo ===================================================
echo [NEURO//TREE] Executing Acceptance Tests (A - J)
echo ===================================================
cd /d "%~dp0backend"
python -m pytest tests/test_acceptance.py -v
pause

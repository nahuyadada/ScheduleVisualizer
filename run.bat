@echo off
echo Starting Schedule Visualizer...
start "" http://localhost:8080
python -m http.server 8080

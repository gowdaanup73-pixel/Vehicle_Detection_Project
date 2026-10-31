"""
Backend Server Entrypoint
Starts Uvicorn server on port 8000.
"""
import sys
from pathlib import Path
import uvicorn

# Ensure repository root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if __name__ == "__main__":
    uvicorn.run("backend.api.app:app", host="127.0.0.1", port=8000, reload=False)

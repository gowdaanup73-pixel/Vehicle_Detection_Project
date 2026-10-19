"""
Launch Script for Improved CenterNet Vehicle Intelligence Platform
Starts both the FastAPI Backend (port 8000) and the Vite Frontend (port 5173).
"""
import os
import subprocess
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")


def main():
    print("=" * 70)
    print("  IMPROVED CENTERNET // VEHICLE INTELLIGENCE PLATFORM")
    print("  ResNet-18 + CBAM Attention + BiFPN Neck // UA-DETRAC")
    print("=" * 70)

    # 1. Start Backend Uvicorn Process
    print("\n[+] Launching FastAPI Inference Backend on http://127.0.0.1:8000 ...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "backend.api.app:app", "--host", "127.0.0.1", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd, cwd=BASE_DIR)

    time.sleep(1.5)

    # 2. Start Frontend Vite Dev Server
    print("[+] Launching Industrial Command Center UI on http://localhost:5173 ...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=FRONTEND_DIR)

    print("\n" + "-" * 70)
    print("  COMMAND CENTER READY:")
    print("  -> Application UI: http://localhost:5173")
    print("  -> Backend API:    http://127.0.0.1:8000/api/health")
    print("  -> API Docs:       http://127.0.0.1:8000/docs")
    print("-" * 70)
    print("Press Ctrl+C to terminate both servers.\n")

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("[-] Backend process terminated unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("[-] Frontend process terminated unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\n[*] Shutting down servers...")
    finally:
        backend_proc.terminate()
        frontend_proc.terminate()
        print("[*] Shutdown complete.")


if __name__ == "__main__":
    main()

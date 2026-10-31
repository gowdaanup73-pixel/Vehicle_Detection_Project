"""Unit test suite for the frontend demo generator verifying determinism, bounds, and metrics integrity."""

import subprocess
from pathlib import Path


def test_demo_generator_unit_tests():
    frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
    test_file = frontend_dir / "src" / "demo" / "generator.test.js"
    assert test_file.exists(), f"Demo test file not found: {test_file}"

    res = subprocess.run(
        ["node", "--test", str(test_file)],
        cwd=str(frontend_dir),
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0, f"Node unit tests failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
    assert "fail 0" in res.stdout

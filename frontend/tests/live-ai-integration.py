"""Production Next route -> unified FastAPI smoke test. Run from repository root after npm build."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
CREATE_NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

def port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0)); return listener.getsockname()[1]

def request(url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urlopen(req, timeout=55) as response:
            body = response.read()
            return response.status, json.loads(body) if "application/json" in response.headers.get("Content-Type", "") else body.decode()
    except HTTPError as error: return error.code, json.load(error)

def wait(url, process):
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None: raise RuntimeError(f"Server exited: {process.returncode}")
        try:
            if request(url)[0] == 200: return
        except OSError: pass
        time.sleep(.1)
    raise RuntimeError("Server startup timeout")

def stop(process):
    if process.poll() is None: process.terminate()
    try: process.wait(timeout=5)
    except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)

def main():
    backend_port, frontend_port = port(), port()
    while frontend_port == backend_port: frontend_port = port()
    backend = subprocess.Popen([sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1",
        "--port", str(backend_port), "--log-level", "warning"], cwd=ROOT, creationflags=CREATE_NO_WINDOW)
    env = os.environ.copy(); env.update({"SPONTAN_BACKEND_URL": f"http://127.0.0.1:{backend_port}", "VERCEL": "1", "NEXT_TELEMETRY_DISABLED": "1"})
    next_bin = ROOT / "frontend" / "node_modules" / "next" / "dist" / "bin" / "next"
    frontend = subprocess.Popen(["node", str(next_bin), "start", "--hostname", "127.0.0.1", "--port", str(frontend_port)],
        cwd=ROOT / "frontend", env=env, creationflags=CREATE_NO_WINDOW, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        wait(f"http://127.0.0.1:{backend_port}/health", backend)
        wait(f"http://127.0.0.1:{frontend_port}/", frontend)
        status, catalog = request(f"http://127.0.0.1:{frontend_port}/api/ai-reformulation/products")
        assert status == 200 and len(catalog["products"]) == 22
        product, second = catalog["products"][:2]
        base = {factor["key"]: factor["baseline"] for factor in product["factors"]}
        predict_body = {"product_id": product["product_id"], "composition": base}
        status, predicted = request(f"http://127.0.0.1:{frontend_port}/api/ai-reformulation/predict", predict_body)
        backend_status, direct = request(f"http://127.0.0.1:{backend_port}/ai-reformulation/predict", predict_body)
        assert status == backend_status == 200 and predicted == direct
        status, second_prediction = request(f"http://127.0.0.1:{frontend_port}/api/ai-reformulation/predict",
            {"product_id": second["product_id"], "composition": base})
        assert status == 200 and second_prediction["predicted_responses"] != predicted["predicted_responses"]
        common = {"product_id": product["product_id"], "baseline": base, "bounds": {}, "fixed": [], "top_k": 3, "seed": 42, "min_distance": .03}
        status, optimized = request(f"http://127.0.0.1:{frontend_port}/api/ai-reformulation/optimize",
            {**common, "target_constraints": {"hydration_ratio_min": 1.25, "stickiness_score_0_10_max": 4.5}})
        assert status == 200 and optimized["status"] == "CANDIDATES_FOUND" and len(optimized["candidates"]) == 3
        assert all(all(c["constraint_checks"].values()) for c in optimized["candidates"])
        status, empty = request(f"http://127.0.0.1:{frontend_port}/api/ai-reformulation/optimize",
            {**common, "fixed": list(base), "target_constraints": {"hydration_ratio_min": 100.0}})
        assert status == 200 and empty["status"] == "NO_FEASIBLE_ALTERNATIVE_FOUND" and empty["candidates"] == []
        status, invalid = request(f"http://127.0.0.1:{frontend_port}/api/ai-reformulation/predict",
            {"product_id": product["product_id"], "composition": {**base, "factor_a_pct": 11}})
        assert status == 422 and "Traceback" not in json.dumps(invalid)
        if "--browser" in sys.argv:
            try:
                browser_result = subprocess.run(["node", str(ROOT / "frontend" / "tests" / "browser-ai-flow.mjs"),
                    f"http://127.0.0.1:{frontend_port}"], cwd=ROOT, check=True, timeout=180,
                    creationflags=CREATE_NO_WINDOW, text=True, capture_output=True)
            except subprocess.CalledProcessError as error:
                raise RuntimeError(f"Browser UI test failed:\n{error.stdout}\n{error.stderr}") from error
            assert '"real headless Chromium UI"' in browser_result.stdout, browser_result.stderr
            print(browser_result.stdout.strip())
        print(json.dumps({"status": "PASS", "transport": "browser-facing Next production route -> bound FastAPI",
            "checked": ["catalog", "prediction", "product_specific_predictions", "top_3", "empty_search", "invalid_input"],
            "model_version": optimized["model_version"], "candidate_ids": [c["candidate_id"] for c in optimized["candidates"]]}))
    finally:
        stop(frontend); stop(backend)

if __name__ == "__main__": main()

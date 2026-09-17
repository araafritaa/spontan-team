"""Run from repository root. Starts a loopback-only child and always stops it."""
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
from urllib.request import Request, urlopen


def main():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    root = Path(__file__).resolve().parents[2]
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    server = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.main:app',
        '--host', '127.0.0.1', '--port', str(port), '--log-level', 'warning'],
        cwd=root, creationflags=flags)
    base = f'http://127.0.0.1:{port}'
    def call(path, body=None):
        request = Request(base+path, data=json.dumps(body).encode() if body is not None else None,
                          headers={'Content-Type': 'application/json'})
        with urlopen(request, timeout=20) as response:
            assert response.status == 200, response.status
            return json.load(response)
    try:
        deadline = time.monotonic()+20
        while True:
            if server.poll() is not None:
                raise RuntimeError('Local server exited before startup')
            try:
                health = call('/health')
                break
            except OSError:
                if time.monotonic() > deadline:
                    raise RuntimeError('Local server startup timed out') from None
                time.sleep(.1)
        assert health['status'] == 'ok'
        ready = call('/ready')
        assert ready['status'] == 'ready'
        catalog = call('/formulas?limit=1')
        assert catalog['total'] == 294
        rescue = call('/reformulate', {'formula_id': 7, 'constraint': {
            'type': 'ingredient_unavailable', 'ingredient': 'Plantacare 818'}, 'top_k': 3})
        assert [c['formula_id'] for c in rescue['candidates']] == [288, 292, 190]
        baseline = {'phytantriol_pct': 1.5, 'soy_lecithin_pct': 2.5, 'cct_pct': 3.0}
        prediction = call('/ai-reformulation/predict', {'composition': baseline})
        assert abs(prediction['predicted_responses']['hydration_ratio']-1.56236) < 1e-7
        optimized = call('/ai-reformulation/optimize', {'baseline': baseline,
            'target_constraints': {'hydration_ratio_min': 1.55, 'stickiness_score_0_10_max': 3.5}})
        assert len(optimized['candidates']) == 3
        assert all(all(c['constraint_checks'].values()) for c in optimized['candidates'])
        print(json.dumps({'status': 'PASS', 'transport': 'actual loopback HTTP',
            'checked_endpoints': 6, 'formula_rescue_top3': [288, 292, 190],
            'sensory_prediction': prediction['predicted_responses'],
            'optimization_process': optimized['process']}, indent=2))
    finally:
        if server.poll() is None:
            server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)


if __name__ == '__main__':
    main()

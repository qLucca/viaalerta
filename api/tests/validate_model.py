"""Smoke test com checkpoint real; lê amostras existentes sem alterar o dataset.

--offline-auth substitui APENAS a sessão durante inferência; não valida login real.
Sem essa opção, informe VIAALERTA_TEST_ACCESS_TOKEN de uma conta existente.
"""
import argparse
from io import BytesIO
import json
import os
from pathlib import Path
import statistics
import sys
import threading
import time

import psutil
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--device', choices=['cpu', '0'], default='cpu')
parser.add_argument('--offline-auth', action='store_true')
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
load_dotenv(root / 'api/.env')
model_path = os.getenv('MODEL_PATH')
if model_path and not Path(model_path).is_absolute():
    os.environ['MODEL_PATH'] = str(root / model_path)
os.environ['DEVICE'] = args.device
from api.app import app, exigir_usuario
import torch

token = os.getenv('VIAALERTA_TEST_ACCESS_TOKEN')
if not args.offline_auth and not token:
    parser.error('Informe VIAALERTA_TEST_ACCESS_TOKEN ou use --offline-auth explicitamente.')
report = {'device': args.device, 'authentication': 'substituída somente nas inferências' if args.offline_auth else 'sessão real Supabase', 'samples': []}
peak = [0]
stop = threading.Event()
process = psutil.Process()

def memory():
    while not stop.wait(.02):
        peak[0] = max(peak[0], process.memory_info().rss)

thread = threading.Thread(target=memory, daemon=True)
thread.start()
started = time.perf_counter()
try:
    with TestClient(app) as client:
        report['startup_seconds'] = time.perf_counter() - started
        report['health'] = client.get('/health').json()
        buf = BytesIO()
        Image.new('RGB', (640, 480), 'gray').save(buf, format='JPEG')
        blank = buf.getvalue()
        files = {'file': ('blank.jpg', blank, 'image/jpeg')}
        assert client.post('/detect', files=files).status_code == 401
        invalid = client.post('/detect', files=files, headers={'Authorization': 'Bearer invalid-test-token'})
        assert invalid.status_code == 401, invalid.text
        report['real_auth_missing_invalid'] = [401, invalid.status_code]
        if args.offline_auth:
            app.dependency_overrides[exigir_usuario] = lambda: 'teste-local-sem-persistencia'
        headers = {'Authorization': f'Bearer {token}'} if token else {}
        response = client.post('/detect', files=files, headers=headers)
        assert response.status_code == 200, response.text
        assert response.json()['detections'] == [], response.text
        report['blank_detections'] = []
        assert client.post('/detect', files={'file': ('broken.jpg', b'broken', 'image/jpeg')}, headers=headers).status_code == 400
        assert client.post('/detect', files={'file': ('bad.txt', b'bad', 'text/plain')}, headers=headers).status_code == 415
        data = root / 'notebooks/dados/preparados_buracos'
        images = data / 'images/teste'
        positive, negative = [], []
        for path in sorted(images.iterdir()):
            if path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
                continue
            label = data / 'labels/teste' / (path.stem + '.txt')
            if not label.is_file():
                raise FileNotFoundError(f'Label ausente para a amostra {path.name}.')
            bucket = positive if label.read_text().strip() else negative
            if len(bucket) < 3:
                bucket.append(path)
            if len(positive) == 3 and len(negative) == 3:
                break
        samples = [(p, True) for p in positive] + [(p, False) for p in negative]
        for path, annotated in samples:
            elapsed = []
            content = path.read_bytes()
            for _ in range(2 if args.offline_auth else 1):
                before = time.perf_counter()
                response = client.post('/detect', files={'file': (path.name, content, 'image/jpeg')}, headers=headers)
                elapsed.append(time.perf_counter() - before)
                assert response.status_code == 200, response.text
            result = response.json()
            with Image.open(path) as image:
                from PIL import ImageOps
                with ImageOps.exif_transpose(image) as oriented:
                    assert (result['image_width'], result['image_height']) == oriented.size
            for d in result['detections']:
                x1, y1, x2, y2 = d['bbox']
                assert 0 <= x1 < x2 <= result['image_width']
                assert 0 <= y1 < y2 <= result['image_height']
                assert d['class_id'] == 0 and 0 <= d['confidence'] <= 1
            report['samples'].append({'file': path.name, 'annotated_positive': annotated, 'bytes': len(content), 'seconds': elapsed, 'response': result})
        assert len(positive) == len(negative) == 3, 'Necessárias três amostras positivas e três backgrounds existentes.'
        assert any(s['response']['detections'] for s in report['samples']), 'Nenhuma detecção real nas amostras.'
        report['latency_median_seconds'] = statistics.median(t for s in report['samples'] for t in s['seconds'])
        report['latency_max_seconds'] = max(t for s in report['samples'] for t in s['seconds'])
        if args.device == '0':
            report['gpu_peak_allocated_mib'] = torch.cuda.max_memory_allocated() / 1024**2
finally:
    app.dependency_overrides.clear()
    stop.set()
    thread.join()
report['rss_peak_mib'] = peak[0] / 1024**2
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'samples'}, ensure_ascii=False, indent=2))

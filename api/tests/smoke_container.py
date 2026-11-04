"""Confere o container com pesos reais e imagens sintéticas, sem treinar ou persistir dados."""
from io import BytesIO
import json
import os
import statistics
import sys
import time


def main():
    sys.path.insert(0, '/app')
    from fastapi.testclient import TestClient
    from PIL import Image
    import psutil
    import httpx
    from app import app, exigir_usuario

    settings = httpx.get(os.environ['SUPABASE_URL'].rstrip('/') + '/auth/v1/settings',
                         headers={'apikey': os.environ['SUPABASE_PUBLISHABLE_KEY']}, timeout=15)
    assert settings.status_code == 200, f'Configuração Supabase retornou HTTP {settings.status_code}'
    started = time.perf_counter()
    with TestClient(app) as client:
        startup = time.perf_counter() - started
        health = client.get('/health').json()
        assert health['model_sha256'] == os.environ['EXPECTED_MODEL_SHA256']
        assert health['device'] == 'cpu'
        image = BytesIO()
        Image.new('RGB', (640, 480), 'gray').save(image, format='PNG')
        files = {'file': ('blank.png', image.getvalue(), 'image/png')}
        assert client.post('/detect', files=files).status_code == 401
        invalid = client.post('/detect', files=files, headers={'Authorization': 'Bearer invalid-container-test-token'})
        assert invalid.status_code == 401, f'Autenticação real retornou HTTP {invalid.status_code}'
        # A substituição existe somente neste processo de teste; não entra no servidor publicado.
        app.dependency_overrides[exigir_usuario] = lambda: 'smoke-test-local'
        timings = []
        try:
            for _ in range(3):
                before = time.perf_counter()
                response = client.post('/detect', files=files)
                timings.append(time.perf_counter() - before)
                assert response.status_code == 200
                data = response.json()
                assert (data['image_width'], data['image_height']) == (640, 480)
                assert data['detections'] == []
            assert client.post('/detect', files={'file': ('broken.jpg', b'broken', 'image/jpeg')}).status_code == 400
        finally:
            app.dependency_overrides.clear()
        report = {
            'health': health, 'startup_seconds': round(startup, 3),
            'inference_median_seconds': round(statistics.median(timings), 4),
            'rss_mib': round(psutil.Process().memory_info().rss / 1024**2, 1),
            'missing_invalid_token': [401, 401], 'real_inference': True,
            'supabase_configuration_status': settings.status_code,
            'valid_session': 'substituída somente no processo de teste',
        }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

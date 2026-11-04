import { leafletCSS, leafletJS } from "./vendor";
export const mapHTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>${leafletCSS}
html,body,#map{height:100%;width:100%;margin:0;background:#eaf0e9;font-family:Arial,sans-serif} .pin{width:23px;height:23px;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px #0003;display:grid;place-items:center}.pin i{width:6px;height:6px;border-radius:50%;background:white}.cluster{background:#277e5f;border:5px solid #b4dac2;border-radius:50%;color:white;display:grid;place-items:center;font-size:12px;font-weight:700}.leaflet-control-attribution{font-size:8px!important}.dark .leaflet-tile-pane{filter:brightness(.65) saturate(.6)}#tile-error{position:absolute;left:12px;right:12px;top:12px;z-index:700;background:#fffef0;color:#68572c;font-size:11px;padding:10px;border-radius:8px;display:none;pointer-events:none}</style></head><body><div id="map" role="application" aria-label="Mapa colaborativo"></div><div id="tile-error">Fundo do mapa indisponível. Verifique a internet; os pontos continuam disponíveis.</div><script>${leafletJS.replace(/<\/script/gi, "<\\/script")}

;(function () {
  var map = L.map('map', {
      zoomControl: true,
      maxZoom: 19,
      minZoom: 3,
    }).setView([-23.552, -46.65], 14),
    selected = null,
    oldPoint = null,
    focusKey = null;
  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    iconCreateFunction: function (g) {
      return L.divIcon({
        className: 'cluster',
        html: String(g.getChildCount()),
        iconSize: [37, 37],
      });
    },
  });
  map.addLayer(cluster);
  var tiles = L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    },
  ).addTo(map);
  tiles.on('tileerror', function () {
    document.getElementById('tile-error').style.display = 'block';
  });
  tiles.on('tileload', function () {
    document.getElementById('tile-error').style.display = 'none';
  });
  function send(payload) {
    var text = JSON.stringify(
      Object.assign({ source: 'viaalerta-map' }, payload),
    );
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else if (window.parent !== window) window.parent.postMessage(text, '*');
  }
  function icon(color) {
    return L.divIcon({
      className: '',
      html: '<span class="pin" style="background:' + color + '"><i></i></span>',
      iconSize: [29, 36],
      iconAnchor: [14, 33],
    });
  }
  var picking = false;
  function pick(latlng) {
    oldPoint = [latlng.lat, latlng.lng];
    if (selected) selected.setLatLng(latlng);
    send({ type: 'point', point: oldPoint });
  }
  map.on('click', function (e) {
    if (picking) pick(e.latlng);
  });
  var timer;
  function bounds() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      var b = map.getBounds();
      send({
        type: 'bounds',
        bounds: {
          south: b.getSouth(),
          west: b.getWest(),
          north: b.getNorth(),
          east: b.getEast(),
        },
      });
    }, 250);
  }
  map.on('moveend', bounds);
  window.setViaData = function (data) {
    document.body.classList.toggle('dark', !!data.dark);
    picking = !!data.picking;
    cluster.clearLayers();
    (data.records || []).forEach(function (r) {
      var color =
        r.status === 'resolvido'
          ? '#278365'
          : r.status === 'em_analise'
            ? '#dea04b'
            : '#dd6b5e';
      var marker = L.marker([r.latitude, r.longitude], {
        icon: icon(color),
        title: r.description || 'Ocorrência',
        alt: 'Abrir ocorrência',
      });
      marker.on('click', function () {
        send({ type: 'select', id: r.id });
      });
      cluster.addLayer(marker);
    });
    if (data.point) {
      if (!selected) {
        selected = L.marker(data.point, {
          icon: icon('#277e5f'),
          draggable: picking,
          title: picking ? 'Arraste para ajustar o local' : 'Local selecionado',
          alt: 'Local selecionado',
        }).addTo(map);
        selected.on('dragend', function () {
          pick(selected.getLatLng());
        });
      }
      if (picking) selected.dragging.enable();
      else selected.dragging.disable();
      if (
        !oldPoint ||
        Math.abs(oldPoint[0] - data.point[0]) > 0.000001 ||
        Math.abs(oldPoint[1] - data.point[1]) > 0.000001
      ) {
        selected.setLatLng(data.point);
        map.panTo(data.point);
        oldPoint = data.point;
      }
    } else if (selected) {
      map.removeLayer(selected);
      selected = null;
      oldPoint = null;
    }
    if (data.focus && JSON.stringify(data.focus) !== focusKey) {
      focusKey = JSON.stringify(data.focus);
      map.setView(data.focus, 15);
    }
    setTimeout(function () {
      map.invalidateSize();
    }, 0);
  };
  window.addEventListener('message', function (e) {
    if (e.source !== window.parent) return;
    try {
      var message = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (message.source === 'viaalerta-app')
        window.setViaData(message.payload);
    } catch (_) {}
  });
  send({ type: 'ready' });
  bounds();
})();
</script></body></html>`;

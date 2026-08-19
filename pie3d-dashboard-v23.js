(() => {
  if (window.__melatiPie3dReadyV23) return;
  window.__melatiPie3dReadyV23 = true;

  const PALETTES = {
    pembayaran: ['#2563EB', '#F59E0B', '#16A34A', '#9333EA', '#DC2626', '#0891B2'],
    status: ['#2563EB', '#F59E0B', '#16A34A', '#DC2626', '#9333EA', '#0891B2'],
    default: ['#2563EB', '#F59E0B', '#16A34A', '#9333EA', '#DC2626', '#0891B2']
  };

  function injectStyles() {
    if (document.getElementById('pie3d-dashboard-css-v23')) return;
    const style = document.createElement('style');
    style.id = 'pie3d-dashboard-css-v23';
    style.textContent = `
      .pie3d-wrap{display:flex;align-items:center;justify-content:center;gap:18px;width:100%;min-height:200px}
      .pie3d-stage{width:168px;height:168px;display:grid;place-items:center;perspective:650px;flex:0 0 auto}
      .pie3d{position:relative;width:150px;height:150px;transform-style:preserve-3d;transform:perspective(650px) rotateX(58deg) rotateZ(-8deg);border-radius:50%}
      .pie3d-depth,.pie3d-top{position:absolute;inset:0;border-radius:50%;background:var(--pie-bg)}
      .pie3d-depth{transform:translateY(11px);filter:brightness(.72)}
      .pie3d-top{box-shadow:0 9px 18px rgba(16,24,40,.16)}
      .pie3d-highlight{position:absolute;inset:8px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.24),transparent 34%);pointer-events:none}
      .pie3d-total{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotateZ(8deg) rotateX(-58deg);text-align:center;z-index:3;pointer-events:none;white-space:nowrap}
      .pie3d-total b{display:block;font-size:21px;line-height:1.05;color:#172033}
      .pie3d-total span{display:block;font-size:9px;color:#667085;margin-top:3px;text-transform:uppercase;letter-spacing:.08em}
      .pie3d-legend{display:grid;gap:7px;font-size:11px;min-width:150px;max-width:230px}
      .pie3d-legend-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:7px;align-items:start}
      .pie3d-dot{width:10px;height:10px;border-radius:50%;margin-top:3px;box-shadow:0 0 0 1px rgba(16,24,40,.08)}
      .pie3d-name{line-height:1.25;color:#344054}
      .pie3d-value{white-space:nowrap;font-weight:800;color:#172033}
      @media(max-width:760px){.pie3d-wrap{gap:10px}.pie3d-stage{width:145px;height:145px}.pie3d{width:128px;height:128px}.pie3d-legend{min-width:135px;font-size:10px}.pie3d-total b{font-size:18px}}
    `;
    document.head.appendChild(style);
  }

  function escapeValue(value) {
    return typeof window.esc === 'function'
      ? window.esc(value)
      : String(value ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function counts(data, key) {
    const map = {};
    data.forEach(row => {
      const value = row[key] || 'Tidak diisi';
      map[value] = (map[value] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function paletteFor(key) {
    return PALETTES[key] || PALETTES.default;
  }

  function renderPie3D(id, data, key) {
    const host = document.getElementById(id);
    if (!host) return;
    injectStyles();

    const rows = counts(data, key);
    const total = rows.reduce((sum, row) => sum + row[1], 0);
    if (!rows.length || !total) {
      host.innerHTML = '<div class="empty">Tidak ada data</div>';
      return;
    }

    const colors = paletteFor(key);
    let cursor = 0;
    const parts = rows.map(([, value], index) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${colors[index % colors.length]} ${start}% ${cursor}%`;
    });
    const gradient = `conic-gradient(${parts.join(',')})`;

    const legendRows = rows.slice(0, 7).map(([name, value], index) => {
      const pct = (value / total * 100).toFixed(1).replace('.', ',');
      return `<div class="pie3d-legend-row"><i class="pie3d-dot" style="background:${colors[index % colors.length]}"></i><span class="pie3d-name">${escapeValue(name)}</span><span class="pie3d-value">${value} · ${pct}%</span></div>`;
    }).join('');

    host.innerHTML = `
      <div class="pie3d-wrap">
        <div class="pie3d-stage" aria-label="Grafik pie 3D">
          <div class="pie3d" style="--pie-bg:${gradient}">
            <div class="pie3d-depth"></div>
            <div class="pie3d-top"></div>
            <div class="pie3d-highlight"></div>
            <div class="pie3d-total"><b>${total}</b><span>Total</span></div>
          </div>
        </div>
        <div class="pie3d-legend">${legendRows}</div>
      </div>`;
  }

  function patchRenderers() {
    if (typeof window.renderDonut === 'function' && !window.renderDonut.__pie3dPatchedV23) {
      const renderPie = function(id, data, key) { renderPie3D(id, data, key); };
      renderPie.__pie3dPatchedV23 = true;
      window.renderDonut = renderPie;
    }
  }

  injectStyles();
  const timer = setInterval(() => {
    patchRenderers();
    if (typeof window.renderDonut === 'function' && window.renderDonut.__pie3dPatchedV23) {
      clearInterval(timer);
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
    }
  }, 100);
  setTimeout(() => clearInterval(timer), 10000);
})();

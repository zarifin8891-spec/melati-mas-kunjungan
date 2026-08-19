(() => {
  if (window.__melatiPie3dReady) return;
  window.__melatiPie3dReady = true;

  const COLORS = ['#176b5d', '#65a99e', '#9ccbc1', '#c8dfda', '#e4efed', '#8b9a97'];

  function injectStyles() {
    if (document.getElementById('pie3d-dashboard-css')) return;
    const style = document.createElement('style');
    style.id = 'pie3d-dashboard-css';
    style.textContent = `
      .pie3d-wrap{display:flex;align-items:center;justify-content:center;gap:18px;width:100%;min-height:200px}
      .pie3d-stage{width:168px;height:168px;display:grid;place-items:center;perspective:650px;flex:0 0 auto}
      .pie3d{position:relative;width:150px;height:150px;transform-style:preserve-3d;transform:perspective(650px) rotateX(58deg) rotateZ(-8deg);border-radius:50%}
      .pie3d-depth,.pie3d-top{position:absolute;inset:0;border-radius:50%;background:var(--pie-bg);}
      .pie3d-depth{transform:translateY(11px);filter:brightness(.72);}
      .pie3d-top{box-shadow:0 9px 18px rgba(16,24,40,.16);}
      .pie3d-highlight{position:absolute;inset:8px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.25),transparent 34%);pointer-events:none}
      .pie3d-total{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotateZ(8deg) rotateX(-58deg);text-align:center;z-index:3;pointer-events:none;white-space:nowrap}
      .pie3d-total b{display:block;font-size:21px;line-height:1.05;color:#172033}
      .pie3d-total span{display:block;font-size:9px;color:#667085;margin-top:3px;text-transform:uppercase;letter-spacing:.08em}
      .pie3d-legend{display:grid;gap:7px;font-size:11px;min-width:150px;max-width:230px}
      .pie3d-legend-row{display:grid;grid-template-columns:9px minmax(0,1fr) auto;gap:7px;align-items:start}
      .pie3d-dot{width:9px;height:9px;border-radius:50%;margin-top:3px}
      .pie3d-name{line-height:1.25;color:#344054}
      .pie3d-value{white-space:nowrap;font-weight:800;color:#172033}
      .bar-value{align-self:end;text-align:center;font-size:10px;font-weight:800;color:#172033;min-height:13px}
      .bar-stack{display:grid;grid-template-rows:auto 1fr;height:100%;gap:2px}
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

    let cursor = 0;
    const parts = rows.map(([, value], index) => {
      const start = cursor;
      cursor += (value / total) * 100;
      return `${COLORS[index % COLORS.length]} ${start}% ${cursor}%`;
    });
    const gradient = `conic-gradient(${parts.join(',')})`;

    const legendRows = rows.slice(0, 7).map(([name, value], index) => {
      const pct = (value / total * 100).toFixed(1).replace('.', ',');
      return `<div class="pie3d-legend-row"><i class="pie3d-dot" style="background:${COLORS[index % COLORS.length]}"></i><span class="pie3d-name">${escapeValue(name)}</span><span class="pie3d-value">${value} · ${pct}%</span></div>`;
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

  function renderBarsPrecise(id, data, key) {
    const host = document.getElementById(id);
    if (!host) return;
    const rows = counts(data, key).slice(0, 7);
    const max = Math.max(1, ...rows.map(row => row[1]));
    const total = rows.reduce((sum, row) => sum + row[1], 0) || 1;
    host.classList.add('bars');
    host.innerHTML = rows.length ? rows.map(([name, value]) => {
      const pct = (value / total * 100).toFixed(1).replace('.', ',');
      const height = Math.max(3, value / max * 82);
      return `<div class="bar-item"><div class="bar-stack"><div class="bar-value">${value} · ${pct}%</div><div class="bar" style="height:${height}%" title="${escapeValue(name)}: ${value}"></div></div><div class="bar-label" title="${escapeValue(name)}">${escapeValue(name)}</div></div>`;
    }).join('') : '<div class="empty">Tidak ada data</div>';
  }

  function patchRenderers() {
    if (typeof window.renderDonut === 'function' && !window.renderDonut.__pie3dPatched) {
      const renderPie = function(id, data, key) { renderPie3D(id, data, key); };
      renderPie.__pie3dPatched = true;
      window.renderDonut = renderPie;
    }
    if (typeof window.renderBars === 'function' && !window.renderBars.__precisePatched) {
      const renderBars = function(id, data, key) { renderBarsPrecise(id, data, key); };
      renderBars.__precisePatched = true;
      window.renderBars = renderBars;
    }
  }

  injectStyles();
  const timer = setInterval(() => {
    patchRenderers();
    if (typeof window.renderDonut === 'function' && window.renderDonut.__pie3dPatched && typeof window.renderBars === 'function' && window.renderBars.__precisePatched) {
      clearInterval(timer);
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
    }
  }, 100);
  setTimeout(() => clearInterval(timer), 10000);
})();

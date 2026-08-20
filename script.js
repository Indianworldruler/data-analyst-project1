/* ─────────────────────────────────────────────────
   BI Command Centre — script.js
   All API calls go through fetchAPI(). Charts are
   managed in a registry so they're destroyed before
   re-render. Filters are read once on Apply.
───────────────────────────────────────────────── */

const API_BASE = '';  // e.g. 'https://your-backend.com' for production

/* ── Chart.js global defaults ────────────────── */
Chart.defaults.color = '#8a90a8';
Chart.defaults.borderColor = '#242837';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 11;

/* ── Chart registry (destroy before re-render) ── */
const charts = {};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* ── Colour palette ──────────────────────────── */
const C = {
  accent:   '#5b6af8',
  positive: '#34d17a',
  negative: '#f05252',
  amber:    '#f5a623',
  c4:       '#e056b0',
  c5:       '#56c9e0',
  accentDim:   'rgba(91,106,248,0.15)',
  positiveDim: 'rgba(52,209,122,0.15)',
  amberDim:    'rgba(245,166,35,0.15)',
  negativeDim: 'rgba(240,82,82,0.15)',
};

const PALETTE = [C.accent, C.positive, C.amber, C.c4, C.c5, C.negative];

/* ════════════════════════════════════════════════
   FETCH HELPER
════════════════════════════════════════════════ */
async function fetchAPI(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  ).toString();
  const url = `${API_BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ════════════════════════════════════════════════
   FILTERS
════════════════════════════════════════════════ */
function getFilters() {
  return {
    year:     document.getElementById('filterYear').value,
    region:   document.getElementById('filterRegion').value,
    category: document.getElementById('filterCategory').value,
  };
}

async function loadFilterOptions() {
  try {
    const data = await fetchAPI('/api/filters');
    populateSelect('filterYear',     data.years,      'Year');
    populateSelect('filterRegion',   data.regions,    'Region');
    populateSelect('filterCategory', data.categories, 'Category');
  } catch (e) {
    console.error('Could not load filter options:', e);
  }
}

function populateSelect(id, items, label) {
  const sel = document.getElementById(id);
  if (!sel || !Array.isArray(items)) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">All ${label}s</option>` +
    items.map(v => `<option value="${v}">${v}</option>`).join('');
  if (items.includes(current)) sel.value = current;
}

/* ════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════ */
const SECTION_LABELS = {
  overview:   'Executive Overview',
  sales:      'Sales Trend',
  products:   'Product Analysis',
  categories: 'Category Analysis',
  regions:    'Regional Analysis',
  insights:   'Business Insights',
  forecast:   'Sales Forecast',
};

function activateSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));

  const section = document.getElementById(`section-${name}`);
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (section) section.classList.add('active');
  if (navItem) navItem.classList.add('active');

  document.getElementById('topbarTitle').textContent = SECTION_LABELS[name] || '';
  loadSection(name);
}

/* ════════════════════════════════════════════════
   SECTION LOADERS — dispatch to the right loader
════════════════════════════════════════════════ */
function loadSection(name) {
  const f = getFilters();
  switch (name) {
    case 'overview':   loadOverview(f);    break;
    case 'sales':      loadSales(f);       break;
    case 'products':   loadProducts(f);    break;
    case 'categories': loadCategories(f);  break;
    case 'regions':    loadRegions(f);     break;
    case 'insights':   loadInsights(f);    break;
    case 'forecast':   loadForecast();     break;
  }
}

/* ════════════════════════════════════════════════
   1. OVERVIEW
════════════════════════════════════════════════ */
async function loadOverview(f) {
  setKPISkeletons();
  try {
    const [ov, trend, cat] = await Promise.all([
      fetchAPI('/api/overview', f),
      fetchAPI('/api/sales-trend', f),
      fetchAPI('/api/category-performance', f),
    ]);
    renderKPIs(ov);
    renderOverviewChart(trend);
    renderCategoryMixChart(cat);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function setKPISkeletons() {
  ['kpiRevenue','kpiProfit','kpiOrders','kpiQty','kpiAOV','kpiPM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
  document.querySelectorAll('#kpiGrid .kpi-card').forEach(c => c.classList.add('skeleton'));
}

function renderKPIs(d) {
  document.querySelectorAll('#kpiGrid .kpi-card').forEach(c => c.classList.remove('skeleton'));

  setText('kpiRevenue', fmt.currency(d.total_revenue));
  setText('kpiProfit',  fmt.currency(d.total_profit));
  setText('kpiOrders',  fmt.number(d.total_orders));
  setText('kpiQty',     fmt.number(d.total_quantity));
  setText('kpiAOV',     fmt.currency(d.avg_order_value));
  setText('kpiPM',      fmt.pct(d.profit_margin));

  const growthEl = document.getElementById('kpiRevenueGrowth');
  if (growthEl && d.revenue_growth != null) {
    const up = d.revenue_growth >= 0;
    growthEl.textContent = `${up ? '▲' : '▼'} ${fmt.pct(Math.abs(d.revenue_growth))} vs prior period`;
    growthEl.className = `kpi-meta ${up ? 'up' : 'down'}`;
  }

  const marginEl = document.getElementById('kpiMargin');
  if (marginEl) marginEl.textContent = `Margin: ${fmt.pct(d.profit_margin)}`;
}

function renderOverviewChart(trend) {
  destroyChart('overview');
  const ctx = document.getElementById('chartOverview');
  if (!ctx || !trend?.labels?.length) return;

  charts.overview = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trend.labels,
      datasets: [
        {
          label: 'Revenue',
          data: trend.revenue,
          backgroundColor: C.accentDim,
          borderColor: C.accent,
          borderWidth: 1.5,
          borderRadius: 3,
          yAxisID: 'y',
        },
        {
          label: 'Profit',
          data: trend.profit,
          type: 'line',
          borderColor: C.positive,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: C.positive,
          tension: 0.35,
          yAxisID: 'y',
        },
      ],
    },
    options: chartOpts({ legend: true }),
  });
}

function renderCategoryMixChart(cat) {
  destroyChart('categoryMix');
  const ctx = document.getElementById('chartCategoryMix');
  if (!ctx || !cat?.categories?.length) return;

  charts.categoryMix = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cat.categories,
      datasets: [{
        data: cat.revenue,
        backgroundColor: PALETTE,
        borderColor: '#13161d',
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, padding: 12, color: '#8a90a8', font: { size: 11 } },
        },
        tooltip: tooltipStyle(),
      },
    },
  });
}

/* ════════════════════════════════════════════════
   2. SALES TREND
════════════════════════════════════════════════ */
async function loadSales(f) {
  try {
    const data = await fetchAPI('/api/sales-trend', f);
    renderSalesTrendChart(data);
    renderBestWorstTable(data.best_worst);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderSalesTrendChart(data) {
  destroyChart('salesTrend');
  const ctx = document.getElementById('chartSalesTrend');
  if (!ctx || !data?.labels?.length) return;

  charts.salesTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [
        {
          label: 'Revenue',
          data: data.revenue,
          borderColor: C.accent,
          backgroundColor: C.accentDim,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: C.accent,
        },
        {
          label: 'Profit',
          data: data.profit,
          borderColor: C.positive,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: C.positive,
          borderDash: [4, 3],
        },
      ],
    },
    options: chartOpts({ legend: true }),
  });
}

function renderBestWorstTable(rows) {
  const tbody = document.getElementById('tbodyBestWorst');
  if (!tbody) return;
  if (!rows?.length) { tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No data</td></tr>'; return; }

  tbody.innerHTML = rows.map((r, i) => {
    const isTop = i < rows.length / 2;
    const badge = isTop
      ? `<span class="badge positive">Best</span>`
      : `<span class="badge negative">Worst</span>`;
    return `<tr>
      <td>${badge}</td>
      <td>${r.period}</td>
      <td class="mono">${fmt.currency(r.revenue)}</td>
      <td class="mono">${fmt.currency(r.profit)}</td>
      <td class="mono">${fmt.pct(r.margin)}</td>
    </tr>`;
  }).join('');
}

/* ════════════════════════════════════════════════
   3. PRODUCTS
════════════════════════════════════════════════ */
let productData = null;
let productTab = 'top';

async function loadProducts(f) {
  try {
    productData = await fetchAPI('/api/product-performance', f);
    renderTopRevenueChart(productData);
    renderTopProfitChart(productData);
    renderProductTable(productTab);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderTopRevenueChart(data) {
  destroyChart('topRevenue');
  const ctx = document.getElementById('chartTopRevenue');
  if (!ctx || !data?.top_revenue?.length) return;

  const items = data.top_revenue.slice(0, 10);
  charts.topRevenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(r => truncate(r.product, 20)),
      datasets: [{
        label: 'Revenue',
        data: items.map(r => r.revenue),
        backgroundColor: C.accentDim,
        borderColor: C.accent,
        borderWidth: 1.5,
        borderRadius: 3,
      }],
    },
    options: chartOpts({ indexAxis: 'y' }),
  });
}

function renderTopProfitChart(data) {
  destroyChart('topProfit');
  const ctx = document.getElementById('chartTopProfit');
  if (!ctx || !data?.top_profit?.length) return;

  const items = data.top_profit.slice(0, 10);
  charts.topProfit = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(r => truncate(r.product, 20)),
      datasets: [{
        label: 'Profit',
        data: items.map(r => r.profit),
        backgroundColor: C.positiveDim,
        borderColor: C.positive,
        borderWidth: 1.5,
        borderRadius: 3,
      }],
    },
    options: chartOpts({ indexAxis: 'y' }),
  });
}

function renderProductTable(tab) {
  const tbody = document.getElementById('tbodyProducts');
  if (!tbody || !productData) return;

  const rows = tab === 'top' ? productData.top_revenue : productData.bottom;
  if (!rows?.length) { tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No data</td></tr>'; return; }

  tbody.innerHTML = rows.map((r, i) => `<tr>
    <td>${i + 1}</td>
    <td>${r.product}</td>
    <td class="mono">${fmt.currency(r.revenue)}</td>
    <td class="mono">${fmt.currency(r.profit)}</td>
    <td class="mono">${fmt.number(r.quantity)}</td>
    <td>${marginBadge(r.margin)}</td>
  </tr>`).join('');
}

/* ════════════════════════════════════════════════
   4. CATEGORIES
════════════════════════════════════════════════ */
async function loadCategories(f) {
  try {
    const data = await fetchAPI('/api/category-performance', f);
    renderCatRevenueChart(data);
    renderCatProfitChart(data);
    renderCatContribChart(data);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderCatRevenueChart(data) {
  destroyChart('catRevenue');
  const ctx = document.getElementById('chartCatRevenue');
  if (!ctx || !data?.categories?.length) return;

  charts.catRevenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.categories,
      datasets: [{
        label: 'Revenue',
        data: data.revenue,
        backgroundColor: PALETTE,
        borderRadius: 4,
      }],
    },
    options: chartOpts({}),
  });
}

function renderCatProfitChart(data) {
  destroyChart('catProfit');
  const ctx = document.getElementById('chartCatProfit');
  if (!ctx || !data?.categories?.length) return;

  charts.catProfit = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.categories,
      datasets: [{
        label: 'Profit',
        data: data.profit,
        backgroundColor: PALETTE.map(c => c + '33'),
        borderColor: PALETTE,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: chartOpts({}),
  });
}

function renderCatContribChart(data) {
  destroyChart('catContrib');
  const ctx = document.getElementById('chartCatContrib');
  if (!ctx || !data?.categories?.length) return;

  const total = data.revenue.reduce((s, v) => s + v, 0);
  const pcts  = data.revenue.map(v => +((v / total) * 100).toFixed(1));

  charts.catContrib = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.categories,
      datasets: [{
        label: '% Revenue Contribution',
        data: pcts,
        backgroundColor: PALETTE,
        borderRadius: 4,
      }],
    },
    options: chartOpts({ yLabel: '%' }),
  });
}

/* ════════════════════════════════════════════════
   5. REGIONS
════════════════════════════════════════════════ */
async function loadRegions(f) {
  try {
    const data = await fetchAPI('/api/region-performance', f);
    renderRegionKPIs(data);
    renderRegRevChart(data);
    renderRegProfitChart(data);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderRegionKPIs(data) {
  const grid = document.getElementById('regionKpis');
  if (!grid || !data?.regions?.length) return;

  grid.innerHTML = data.regions.map((reg, i) => `
    <div class="kpi-card region-kpi">
      <div class="kpi-label">${reg}</div>
      <div class="kpi-value" style="color:${PALETTE[i % PALETTE.length]}">${fmt.currency(data.revenue[i])}</div>
      <div class="kpi-meta">${fmt.number(data.orders[i])} orders · ${fmt.pct(data.margin[i])} margin</div>
    </div>`).join('');
}

function renderRegRevChart(data) {
  destroyChart('regRevenue');
  const ctx = document.getElementById('chartRegRevenue');
  if (!ctx || !data?.regions?.length) return;

  charts.regRevenue = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.regions,
      datasets: [{
        label: 'Revenue',
        data: data.revenue,
        backgroundColor: PALETTE,
        borderRadius: 4,
      }],
    },
    options: chartOpts({}),
  });
}

function renderRegProfitChart(data) {
  destroyChart('regProfit');
  const ctx = document.getElementById('chartRegProfit');
  if (!ctx || !data?.regions?.length) return;

  charts.regProfit = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.regions,
      datasets: [{
        label: 'Profit',
        data: data.profit,
        backgroundColor: PALETTE.map(c => c + '33'),
        borderColor: PALETTE,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: chartOpts({}),
  });
}

/* ════════════════════════════════════════════════
   6. INSIGHTS
════════════════════════════════════════════════ */
async function loadInsights(f) {
  const grid = document.getElementById('insightsGrid');
  if (!grid) return;
  grid.innerHTML = Array(6).fill('<div class="insight-skeleton"></div>').join('');

  try {
    const data = await fetchAPI('/api/insights', f);
    if (!data?.insights?.length) {
      grid.innerHTML = '<p style="color:var(--text-muted);padding:20px">No insights available.</p>';
      return;
    }
    grid.innerHTML = data.insights.map(ins => `
      <div class="insight-card ${ins.type}">
        <div class="insight-type">${ins.tag}</div>
        <div class="insight-title">${ins.title}</div>
        <div class="insight-detail">${ins.detail}</div>
        <div class="insight-value">${ins.value}</div>
      </div>`).join('');
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--negative);padding:20px">${e.message}</p>`;
  }
}

/* ════════════════════════════════════════════════
   7. FORECAST
════════════════════════════════════════════════ */
async function loadForecast() {
  try {
    const data = await fetchAPI('/api/forecast');
    renderForecastMeta(data);
    renderForecastChart(data);
    renderForecastTable(data);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderForecastMeta(data) {
  const el = document.getElementById('forecastMeta');
  if (!el) return;
  el.innerHTML = `
    <div class="forecast-tag">Model: <strong>${data.model || 'Linear Trend'}</strong></div>
    <div class="forecast-tag">Periods: <strong>${data.periods || 6} months</strong></div>
    <div class="forecast-tag">RMSE: <strong>${data.rmse != null ? fmt.currency(data.rmse) : '—'}</strong></div>
    <div class="forecast-tag">R²: <strong>${data.r2 != null ? data.r2.toFixed(3) : '—'}</strong></div>`;
}

function renderForecastChart(data) {
  destroyChart('forecast');
  const ctx = document.getElementById('chartForecast');
  if (!ctx) return;

  const histLabels = data.historical?.map(r => r.period) || [];
  const histVals   = data.historical?.map(r => r.revenue) || [];
  const fcLabels   = data.forecast?.map(r => r.period) || [];
  const fcVals     = data.forecast?.map(r => r.predicted) || [];
  const fcLow      = data.forecast?.map(r => r.lower) || [];
  const fcHigh     = data.forecast?.map(r => r.upper) || [];

  const allLabels = [...histLabels, ...fcLabels];
  const histFull  = [...histVals, ...Array(fcLabels.length).fill(null)];
  const fcFull    = [...Array(histLabels.length).fill(null), ...fcVals];
  const lowFull   = [...Array(histLabels.length).fill(null), ...fcLow];
  const highFull  = [...Array(histLabels.length).fill(null), ...fcHigh];

  charts.forecast = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Historical',
          data: histFull,
          borderColor: C.accent,
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: C.accent,
          tension: 0.35,
          spanGaps: false,
        },
        {
          label: 'Forecast',
          data: fcFull,
          borderColor: C.amber,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 4,
          pointBackgroundColor: C.amber,
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: 'Upper',
          data: highFull,
          borderColor: 'transparent',
          backgroundColor: 'rgba(245,166,35,0.12)',
          fill: '+1',
          pointRadius: 0,
          tension: 0.3,
          spanGaps: false,
        },
        {
          label: 'Lower',
          data: lowFull,
          borderColor: 'transparent',
          backgroundColor: 'rgba(245,166,35,0.12)',
          fill: false,
          pointRadius: 0,
          tension: 0.3,
          spanGaps: false,
        },
      ],
    },
    options: chartOpts({ legend: false }),
  });
}

function renderForecastTable(data) {
  const tbody = document.getElementById('tbodyForecast');
  if (!tbody) return;

  const hist = (data.historical || []).map(r => ({
    period: r.period, type: 'Historical',
    predicted: r.revenue, lower: '—', upper: '—',
  }));
  const fc = (data.forecast || []).map(r => ({
    period: r.period, type: 'Forecast',
    predicted: r.predicted, lower: r.lower, upper: r.upper,
  }));

  const rows = [...hist, ...fc];
  tbody.innerHTML = rows.map(r => `<tr>
    <td>${r.period}</td>
    <td><span class="badge ${r.type === 'Forecast' ? 'amber' : 'neutral'}">${r.type}</span></td>
    <td class="mono">${fmt.currency(r.predicted)}</td>
    <td class="mono">${typeof r.lower === 'number' ? fmt.currency(r.lower) : r.lower}</td>
    <td class="mono">${typeof r.upper === 'number' ? fmt.currency(r.upper) : r.upper}</td>
  </tr>`).join('');
}

/* ════════════════════════════════════════════════
   CHART OPTION FACTORY
════════════════════════════════════════════════ */
function chartOpts({ legend = false, indexAxis = 'x', yLabel = '' } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: legend,
        position: 'top',
        align: 'end',
        labels: { boxWidth: 10, padding: 14, color: '#8a90a8', usePointStyle: true, pointStyleWidth: 8 },
      },
      tooltip: tooltipStyle(),
    },
    scales: {
      x: {
        grid: { color: '#242837', drawBorder: false },
        ticks: { color: '#525770', maxRotation: 40 },
      },
      y: {
        grid: { color: '#242837', drawBorder: false },
        ticks: {
          color: '#525770',
          callback: v => yLabel === '%' ? v + '%' : fmt.shortCurrency(v),
        },
      },
    },
  };
}

function tooltipStyle() {
  return {
    backgroundColor: '#191d27',
    borderColor: '#2d3245',
    borderWidth: 1,
    titleColor: '#e8eaf0',
    bodyColor: '#8a90a8',
    padding: 10,
    callbacks: {
      label: ctx => {
        const v = ctx.parsed.y ?? ctx.parsed.x;
        if (v == null) return '';
        const label = ctx.dataset.label || '';
        return ` ${label}: ${fmt.currency(v)}`;
      },
    },
  };
}

/* ════════════════════════════════════════════════
   FORMATTERS
════════════════════════════════════════════════ */
const fmt = {
  currency: v => v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v),
  shortCurrency: v => {
    if (v == null) return '—';
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v.toFixed(0);
  },
  number:   v => v == null ? '—' : new Intl.NumberFormat('en-US').format(v),
  pct:      v => v == null ? '—' : (v * (Math.abs(v) <= 1 ? 100 : 1)).toFixed(1) + '%',
};

/* ════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function truncate(str, n) {
  return str && str.length > n ? str.slice(0, n) + '…' : str;
}

function marginBadge(m) {
  if (m == null) return '—';
  const pct = (m * (Math.abs(m) <= 1 ? 100 : 1)).toFixed(1);
  const cls = m >= 0.2 ? 'positive' : m >= 0 ? 'amber' : 'negative';
  return `<span class="badge ${cls}">${pct}%</span>`;
}

let toastTimer;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = 'toast', 3500);
}

function setStatus(ok) {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  if (!dot || !text) return;
  dot.className  = `status-dot ${ok ? 'ok' : 'error'}`;
  text.textContent = ok ? 'Backend connected' : 'Backend offline';
}

/* ════════════════════════════════════════════════
   EVENT WIRING
════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  /* Sidebar navigation */
  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const sec = a.dataset.section;
      if (sec) activateSection(sec);

      // close sidebar on mobile
      if (window.innerWidth < 900) {
        document.getElementById('sidebar').classList.remove('open');
      }
    });
  });

  /* Mobile sidebar toggle */
  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  /* Apply filters */
  document.getElementById('btnApply')?.addEventListener('click', () => {
    const active = document.querySelector('.nav-item.active')?.dataset.section || 'overview';
    loadSection(active);
  });

  /* Reset filters */
  document.getElementById('btnReset')?.addEventListener('click', () => {
    ['filterYear','filterRegion','filterCategory'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const active = document.querySelector('.nav-item.active')?.dataset.section || 'overview';
    loadSection(active);
  });

  /* Product table tabs */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      productTab = tab.dataset.tab;
      renderProductTable(productTab);
    });
  });

  /* Check backend health then boot */
  try {
    await fetchAPI('/api/filters');
    setStatus(true);
    await loadFilterOptions();
  } catch {
    setStatus(false);
    showToast('Cannot reach backend. Start Flask with: python app.py', 'error');
  }

  activateSection('overview');
});

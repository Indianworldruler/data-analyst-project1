/*
 * BUSINESS INTELLIGENCE COMMAND CENTRE
 * Frontend application logic
 *
 * Backend expected:
 * Flask REST API
 *
 * API_BASE_URL can be changed when deploying the frontend
 * separately from the Flask backend.
 */

"use strict";


/* =========================================================
   CONFIGURATION
========================================================= */

const API_BASE_URL = "http://127.0.0.1:5000";


/* =========================================================
   APPLICATION STATE
========================================================= */

const state = {
    charts: {},
    filters: {
        year: "",
        month: "",
        region: "",
        category: "",
        product: ""
    },
    productData: [],
    regionData: [],
    isLoading: false
};


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

const appLoader = $("app-loader");
const globalError = $("global-error");
const globalErrorMessage = $("global-error-message");

const yearFilter = $("year-filter");
const monthFilter = $("month-filter");
const regionFilter = $("region-filter");
const categoryFilter = $("category-filter");
const productFilter = $("product-filter");

const sidebar = $("sidebar");
const sidebarToggle = $("sidebar-toggle");
const sidebarOverlay = $("sidebar-overlay");


/* =========================================================
   API HELPER
========================================================= */

async function apiRequest(endpoint, options = {}) {
    const url = new URL(`${API_BASE_URL}${endpoint}`);

    Object.entries(options.params || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, value);
        }
    });

    const response = await fetch(url.toString(), {
        method: options.method || "GET",
        headers: {
            "Accept": "application/json",
            ...(options.headers || {})
        }
    });

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("The server returned an invalid JSON response.");
    }

    if (!response.ok) {
        throw new Error(
            data.error ||
            data.message ||
            `API request failed with status ${response.status}.`
        );
    }

    if (data && data.success === false) {
        throw new Error(
            data.error ||
            data.message ||
            "The API returned an error."
        );
    }

    return data;
}


/* =========================================================
   FILTER QUERY
========================================================= */

function getFilterParams() {
    return {
        year: state.filters.year,
        month: state.filters.month,
        region: state.filters.region,
        category: state.filters.category,
        product: state.filters.product
    };
}


/* =========================================================
   ERROR HANDLING
========================================================= */

function showError(message) {
    if (!globalError) {
        return;
    }

    globalErrorMessage.textContent = message;

    globalError.hidden = false;
}

function hideError() {
    if (!globalError) {
        return;
    }

    globalError.hidden = true;
}

function showLoader() {
    if (appLoader) {
        appLoader.classList.remove("hidden");
    }
}

function hideLoader() {
    if (appLoader) {
        setTimeout(() => {
            appLoader.classList.add("hidden");
        }, 300);
    }
}


/* =========================================================
   FORMATTERS
========================================================= */

function formatCurrency(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(number);
}

function formatNumber(value) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 0
    }).format(number);
}

function formatDecimal(value, digits = 2) {
    const number = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    }).format(number);
}

function formatPercentage(value) {
    const number = Number(value) || 0;

    return `${number.toFixed(2)}%`;
}

function formatCompactCurrency(value) {
    const number = Number(value) || 0;

    if (Math.abs(number) >= 10000000) {
        return `₹${(number / 10000000).toFixed(1)}Cr`;
    }

    if (Math.abs(number) >= 100000) {
        return `₹${(number / 100000).toFixed(1)}L`;
    }

    if (Math.abs(number) >= 1000) {
        return `₹${(number / 1000).toFixed(1)}K`;
    }

    return `₹${number.toFixed(0)}`;
}

function formatDateTime(date = new Date()) {
    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


/* =========================================================
   DATA EXTRACTION HELPERS
========================================================= */

function getValue(object, possibleKeys, fallback = 0) {
    if (!object || typeof object !== "object") {
        return fallback;
    }

    for (const key of possibleKeys) {
        if (
            Object.prototype.hasOwnProperty.call(object, key) &&
            object[key] !== null &&
            object[key] !== undefined
        ) {
            return object[key];
        }
    }

    return fallback;
}

function getArray(data, possibleKeys = []) {
    if (Array.isArray(data)) {
        return data;
    }

    for (const key of possibleKeys) {
        if (data && Array.isArray(data[key])) {
            return data[key];
        }
    }

    return [];
}


/* =========================================================
   CHART DEFAULTS
========================================================= */

function getChartDefaults() {
    return {
        responsive: true,
        maintainAspectRatio: false,

        animation: {
            duration: 500
        },

        interaction: {
            intersect: false,
            mode: "index"
        },

        plugins: {
            legend: {
                position: "top",

                labels: {
                    usePointStyle: true,
                    pointStyle: "circle",

                    color: "#667085",

                    font: {
                        size: 10,
                        family:
                            "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
                    },

                    padding: 15
                }
            },

            tooltip: {
                backgroundColor: "#172033",

                titleColor: "#ffffff",
                bodyColor: "#e5e7eb",

                borderWidth: 0,

                padding: 10,

                titleFont: {
                    size: 11,
                    weight: "600"
                },

                bodyFont: {
                    size: 10
                },

                displayColors: true
            }
        },

        scales: {
            x: {
                grid: {
                    display: false
                },

                ticks: {
                    color: "#98a2b3",
                    font: {
                        size: 9
                    }
                },

                border: {
                    display: false
                }
            },

            y: {
                beginAtZero: true,

                grid: {
                    color: "#eef1f4"
                },

                ticks: {
                    color: "#98a2b3",

                    font: {
                        size: 9
                    }
                },

                border: {
                    display: false
                }
            }
        }
    };
}


/* =========================================================
   DESTROY EXISTING CHART
========================================================= */

function destroyChart(name) {
    if (state.charts[name]) {
        state.charts[name].destroy();
        delete state.charts[name];
    }
}


/* =========================================================
   CHART LOADING STATES
========================================================= */

function setChartLoading(id, loading) {
    const element = $(id);

    if (!element) {
        return;
    }

    element.style.display = loading ? "flex" : "none";
}


/* =========================================================
   LINE CHART
========================================================= */

function createLineChart(
    canvasId,
    chartName,
    labels,
    datasets,
    options = {}
) {
    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    destroyChart(chartName);

    const chartOptions = {
        ...getChartDefaults(),
        ...options
    };

    state.charts[chartName] = new Chart(
        canvas.getContext("2d"),
        {
            type: "line",

            data: {
                labels,
                datasets
            },

            options: chartOptions
        }
    );
}


/* =========================================================
   BAR CHART
========================================================= */

function createBarChart(
    canvasId,
    chartName,
    labels,
    datasets,
    options = {}
) {
    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    destroyChart(chartName);

    state.charts[chartName] = new Chart(
        canvas.getContext("2d"),
        {
            type: "bar",

            data: {
                labels,
                datasets
            },

            options: {
                ...getChartDefaults(),
                ...options
            }
        }
    );
}


/* =========================================================
   DOUGHNUT CHART
========================================================= */

function createDoughnutChart(
    canvasId,
    chartName,
    labels,
    values
) {
    const canvas = $(canvasId);

    if (!canvas) {
        return;
    }

    destroyChart(chartName);

    state.charts[chartName] = new Chart(
        canvas.getContext("2d"),
        {
            type: "doughnut",

            data: {
                labels,

                datasets: [
                    {
                        data: values,

                        backgroundColor: [
                            "#2563eb",
                            "#475467",
                            "#667085",
                            "#98a2b3",
                            "#cbd5e1",
                            "#1d4ed8",
                            "#344054",
                            "#d0d5dd"
                        ],

                        borderColor: "#ffffff",

                        borderWidth: 2
                    }
                ]
            },

            options: {
                responsive: true,
                maintainAspectRatio: false,

                cutout: "65%",

                plugins: {
                    legend: {
                        position: "right",

                        labels: {
                            usePointStyle: true,
                            pointStyle: "circle",

                            color: "#667085",

                            font: {
                                size: 10
                            }
                        }
                    },

                    tooltip: {
                        backgroundColor: "#172033",

                        callbacks: {
                            label(context) {
                                const value = Number(context.raw) || 0;

                                return ` ${formatCompactCurrency(value)}`;
                            }
                        }
                    }
                }
            }
        }
    );
}


/* =========================================================
   FILTER SETUP
========================================================= */

async function loadFilters() {
    const data = await apiRequest("/api/filters");

    const filters = data.filters || data;

    populateSelect(
        yearFilter,
        filters.years || [],
        "All Years"
    );

    populateSelect(
        monthFilter,
        filters.months || [],
        "All Months"
    );

    populateSelect(
        regionFilter,
        filters.regions || [],
        "All Regions"
    );

    populateSelect(
        categoryFilter,
        filters.categories || [],
        "All Categories"
    );

    populateSelect(
        productFilter,
        filters.products || [],
        "All Products"
    );
}

function populateSelect(select, values, defaultText) {
    if (!select) {
        return;
    }

    select.innerHTML = "";

    const defaultOption = document.createElement("option");

    defaultOption.value = "";
    defaultOption.textContent = defaultText;

    select.appendChild(defaultOption);

    values.forEach((value) => {
        const option = document.createElement("option");

        option.value = value;
        option.textContent = value;

        select.appendChild(option);
    });
}


/* =========================================================
   FILTER EVENTS
========================================================= */

function setupFilterEvents() {
    const filterElements = [
        yearFilter,
        monthFilter,
        regionFilter,
        categoryFilter,
        productFilter
    ];

    filterElements.forEach((element) => {
        if (!element) {
            return;
        }

        element.addEventListener("change", async () => {

            state.filters.year = yearFilter.value;
            state.filters.month = monthFilter.value;
            state.filters.region = regionFilter.value;
            state.filters.category = categoryFilter.value;
            state.filters.product = productFilter.value;

            await refreshDashboard();
        });
    });

    $("reset-filters")?.addEventListener(
        "click",
        resetFilters
    );
}

async function resetFilters() {
    state.filters = {
        year: "",
        month: "",
        region: "",
        category: "",
        product: ""
    };

    yearFilter.value = "";
    monthFilter.value = "";
    regionFilter.value = "";
    categoryFilter.value = "";
    productFilter.value = "";

    await refreshDashboard();
}


/* =========================================================
   EXECUTIVE OVERVIEW
========================================================= */

async function loadOverview() {
    const data = await apiRequest(
        "/api/overview",
        {
            params: getFilterParams()
        }
    );

    const overview = data.overview || data;

    $("total-revenue").textContent =
        formatCurrency(
            getValue(
                overview,
                ["total_revenue", "revenue", "Total Revenue"]
            )
        );

    $("total-profit").textContent =
        formatCurrency(
            getValue(
                overview,
                ["total_profit", "profit", "Total Profit"]
            )
        );

    $("total-orders").textContent =
        formatNumber(
            getValue(
                overview,
                ["total_orders", "orders", "Total Orders"]
            )
        );

    $("total-quantity").textContent =
        formatNumber(
            getValue(
                overview,
                ["total_quantity", "quantity", "Total Quantity"]
            )
        );

    $("average-order-value").textContent =
        formatCurrency(
            getValue(
                overview,
                ["average_order_value", "aov", "Average Order Value"]
            )
        );

    const margin = getValue(
        overview,
        ["profit_margin", "margin", "Profit Margin"]
    );

    $("profit-margin").textContent =
        formatPercentage(margin);

    const growth = getValue(
        overview,
        ["revenue_growth", "growth", "Revenue Growth"]
    );

    $("revenue-growth").textContent =
        `${Number(growth) >= 0 ? "+" : ""}${formatPercentage(growth)}`;

    $("revenue-growth-value").textContent =
        `${Number(growth) >= 0 ? "+" : ""}${formatPercentage(growth)}`;

    $("revenue-growth").classList.toggle(
        "negative",
        Number(growth) < 0
    );
}


/* =========================================================
   SALES ANALYSIS
========================================================= */

async function loadSalesTrend() {
    setChartLoading(
        "monthly-revenue-loading",
        true
    );

    setChartLoading(
        "monthly-profit-loading",
        true
    );

    setChartLoading(
        "revenue-profit-loading",
        true
    );

    setChartLoading(
        "yearly-comparison-loading",
        true
    );

    try {
        const data = await apiRequest(
            "/api/sales-trend",
            {
                params: getFilterParams()
            }
        );

        const rows = getArray(
            data,
            ["data", "trend", "sales"]
        );

        renderSalesCharts(rows);

    } finally {
        setChartLoading(
            "monthly-revenue-loading",
            false
        );

        setChartLoading(
            "monthly-profit-loading",
            false
        );

        setChartLoading(
            "revenue-profit-loading",
            false
        );

        setChartLoading(
            "yearly-comparison-loading",
            false
        );
    }
}

function renderSalesCharts(rows) {
    const labels = rows.map((row) =>
        getValue(
            row,
            ["month", "period", "date", "label"],
            ""
        )
    );

    const revenue = rows.map((row) =>
        Number(
            getValue(
                row,
                ["revenue", "total_revenue"],
                0
            )
        )
    );

    const profit = rows.map((row) =>
        Number(
            getValue(
                row,
                ["profit", "total_profit"],
                0
            )
        )
    );

    createLineChart(
        "monthly-revenue-chart",
        "monthlyRevenue",
        labels,
        [
            {
                label: "Revenue",

                data: revenue,

                borderColor: "#2563eb",
                backgroundColor: "rgba(37, 99, 235, 0.08)",

                borderWidth: 2,

                fill: true,

                tension: 0.35,

                pointRadius: 2,
                pointHoverRadius: 5
            }
        ],
        {
            plugins: {
                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },

            scales: {
                ...getChartDefaults().scales,

                y: {
                    ...getChartDefaults().scales.y,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    );


    createLineChart(
        "monthly-profit-chart",
        "monthlyProfit",
        labels,
        [
            {
                label: "Profit",

                data: profit,

                borderColor: "#16803c",
                backgroundColor: "rgba(22, 128, 60, 0.07)",

                borderWidth: 2,

                fill: true,

                tension: 0.35,

                pointRadius: 2,
                pointHoverRadius: 5
            }
        ],
        {
            plugins: {
                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` Profit: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },

            scales: {
                ...getChartDefaults().scales,

                y: {
                    ...getChartDefaults().scales.y,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    );


    createLineChart(
        "revenue-profit-chart",
        "revenueProfit",
        labels,
        [
            {
                label: "Revenue",
                data: revenue,

                borderColor: "#2563eb",

                borderWidth: 2,

                tension: 0.35,

                pointRadius: 2
            },

            {
                label: "Profit",
                data: profit,

                borderColor: "#475467",

                borderWidth: 2,

                tension: 0.35,

                pointRadius: 2
            }
        ],
        {
            scales: {
                ...getChartDefaults().scales,

                y: {
                    ...getChartDefaults().scales.y,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    );


    const yearlyMap = {};

    rows.forEach((row) => {
        const year =
            getValue(row, ["year"], "") ||
            String(
                getValue(
                    row,
                    ["month", "period"],
                    ""
                )
            ).substring(0, 4);

        if (!year) {
            return;
        }

        if (!yearlyMap[year]) {
            yearlyMap[year] = {
                revenue: 0,
                profit: 0
            };
        }

        yearlyMap[year].revenue +=
            Number(
                getValue(
                    row,
                    ["revenue", "total_revenue"],
                    0
                )
            );

        yearlyMap[year].profit +=
            Number(
                getValue(
                    row,
                    ["profit", "total_profit"],
                    0
                )
            );
    });

    const years = Object.keys(yearlyMap).sort();

    createBarChart(
        "yearly-comparison-chart",
        "yearlyComparison",
        years,
        [
            {
                label: "Revenue",

                data: years.map(
                    (year) =>
                        yearlyMap[year].revenue
                ),

                backgroundColor: "#2563eb",

                borderRadius: 4
            },

            {
                label: "Profit",

                data: years.map(
                    (year) =>
                        yearlyMap[year].profit
                ),

                backgroundColor: "#475467",

                borderRadius: 4
            }
        ],
        {
            scales: {
                ...getChartDefaults().scales,

                y: {
                    ...getChartDefaults().scales.y,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    );


    renderBestWorstMonths(
        labels,
        revenue
    );
}

function renderBestWorstMonths(labels, values) {
    if (!values.length) {
        $("best-month").textContent = "—";
        $("worst-month").textContent = "—";
        $("best-month-value").textContent = "—";
        $("worst-month-value").textContent = "—";

        return;
    }

    let bestIndex = 0;
    let worstIndex = 0;

    values.forEach((value, index) => {
        if (value > values[bestIndex]) {
            bestIndex = index;
        }

        if (value < values[worstIndex]) {
            worstIndex = index;
        }
    });

    $("best-month").textContent =
        labels[bestIndex] || "—";

    $("best-month-value").textContent =
        formatCurrency(values[bestIndex]);

    $("worst-month").textContent =
        labels[worstIndex] || "—";

    $("worst-month-value").textContent =
        formatCurrency(values[worstIndex]);
}


/* =========================================================
   PRODUCT ANALYSIS
========================================================= */

async function loadProductPerformance() {
    setChartLoading(
        "top-products-revenue-loading",
        true
    );

    setChartLoading(
        "top-products-profit-loading",
        true
    );

    setChartLoading(
        "top-products-quantity-loading",
        true
    );

    try {
        const data = await apiRequest(
            "/api/product-performance",
            {
                params: getFilterParams()
            }
        );

        const rows = getArray(
            data,
            ["data", "products", "performance"]
        );

        state.productData = rows;

        renderProductCharts(rows);
        renderProductTable(rows);

    } finally {
        setChartLoading(
            "top-products-revenue-loading",
            false
        );

        setChartLoading(
            "top-products-profit-loading",
            false
        );

        setChartLoading(
            "top-products-quantity-loading",
            false
        );
    }
}

function getProductName(row) {
    return String(
        getValue(
            row,
            [
                "product",
                "product_name",
                "Product",
                "Product Name",
                "name"
            ],
            "Unknown Product"
        )
    );
}

function renderProductCharts(rows) {
    const revenueRows = [...rows]
        .sort(
            (a, b) =>
                Number(
                    getValue(b, ["revenue", "total_revenue"], 0)
                ) -
                Number(
                    getValue(a, ["revenue", "total_revenue"], 0)
                )
        )
        .slice(0, 10);

    const profitRows = [...rows]
        .sort(
            (a, b) =>
                Number(
                    getValue(b, ["profit", "total_profit"], 0)
                ) -
                Number(
                    getValue(a, ["profit", "total_profit"], 0)
                )
        )
        .slice(0, 10);

    const quantityRows = [...rows]
        .sort(
            (a, b) =>
                Number(
                    getValue(b, ["quantity", "total_quantity"], 0)
                ) -
                Number(
                    getValue(a, ["quantity", "total_quantity"], 0)
                )
        )
        .slice(0, 10);


    createBarChart(
        "top-products-revenue-chart",
        "topProductsRevenue",
        revenueRows.map(getProductName),
        [
            {
                label: "Revenue",

                data: revenueRows.map(
                    (row) =>
                        Number(
                            getValue(
                                row,
                                ["revenue", "total_revenue"],
                                0
                            )
                        )
                ),

                backgroundColor: "#2563eb",

                borderRadius: 4
            }
        ],
        {
            indexAxis: "y",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },

            scales: {
                x: {
                    beginAtZero: true,

                    grid: {
                        color: "#eef1f4"
                    },

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                },

                y: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createBarChart(
        "top-products-profit-chart",
        "topProductsProfit",
        profitRows.map(getProductName),
        [
            {
                label: "Profit",

                data: profitRows.map(
                    (row) =>
                        Number(
                            getValue(
                                row,
                                ["profit", "total_profit"],
                                0
                            )
                        )
                ),

                backgroundColor: "#16803c",

                borderRadius: 4
            }
        ],
        {
            indexAxis: "y",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` Profit: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },

            scales: {
                x: {
                    beginAtZero: true,

                    grid: {
                        color: "#eef1f4"
                    },

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                },

                y: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createBarChart(
        "top-products-quantity-chart",
        "topProductsQuantity",
        quantityRows.map(getProductName),
        [
            {
                label: "Quantity",

                data: quantityRows.map(
                    (row) =>
                        Number(
                            getValue(
                                row,
                                ["quantity", "total_quantity"],
                                0
                            )
                        )
                ),

                backgroundColor: "#475467",

                borderRadius: 4
            }
        ],
        {
            indexAxis: "y",

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                x: {
                    beginAtZero: true,

                    grid: {
                        color: "#eef1f4"
                    },

                    ticks: {
                        color: "#98a2b3"
                    }
                },

                y: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );
}

function renderProductTable(rows) {
    const body = $("product-table-body");

    if (!body) {
        return;
    }

    body.innerHTML = "";

    if (!rows.length) {
        $("product-table-empty").hidden = false;
        return;
    }

    $("product-table-empty").hidden = true;

    const sortedRows = [...rows].sort(
        (a, b) =>
            Number(
                getValue(b, ["revenue", "total_revenue"], 0)
            ) -
            Number(
                getValue(a, ["revenue", "total_revenue"], 0)
            )
    );

    sortedRows.forEach((row, index) => {
        const revenue = Number(
            getValue(
                row,
                ["revenue", "total_revenue"],
                0
            )
        );

        const profit = Number(
            getValue(
                row,
                ["profit", "total_profit"],
                0
            )
        );

        const quantity = Number(
            getValue(
                row,
                ["quantity", "total_quantity"],
                0
            )
        );

        const category = getValue(
            row,
            ["category", "Category"],
            "—"
        );

        const margin =
            revenue !== 0
                ? (profit / revenue) * 100
                : 0;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>

            <td class="product-name-cell">
                ${escapeHTML(getProductName(row))}
            </td>

            <td>
                ${escapeHTML(String(category))}
            </td>

            <td>
                ${formatCurrency(revenue)}
            </td>

            <td>
                ${formatCurrency(profit)}
            </td>

            <td>
                ${formatNumber(quantity)}
            </td>

            <td class="${margin >= 0 ? "margin-positive" : "margin-negative"}">
                ${formatPercentage(margin)}
            </td>
        `;

        body.appendChild(tr);
    });
}


/* =========================================================
   PRODUCT SEARCH
========================================================= */

function setupProductSearch() {
    const searchInput = $("product-search");

    if (!searchInput) {
        return;
    }

    searchInput.addEventListener("input", () => {
        const searchTerm =
            searchInput.value
                .trim()
                .toLowerCase();

        const rows =
            state.productData.filter((row) => {
                const product =
                    getProductName(row).toLowerCase();

                const category =
                    String(
                        getValue(
                            row,
                            ["category", "Category"],
                            ""
                        )
                    ).toLowerCase();

                return (
                    product.includes(searchTerm) ||
                    category.includes(searchTerm)
                );
            });

        renderProductTable(rows);
    });
}


/* =========================================================
   CATEGORY ANALYSIS
========================================================= */

async function loadCategoryPerformance() {
    const data = await apiRequest(
        "/api/category-performance",
        {
            params: getFilterParams()
        }
    );

    const rows = getArray(
        data,
        ["data", "categories", "performance"]
    );

    renderCategoryCharts(rows);
    renderCategorySummary(rows);
}

function renderCategoryCharts(rows) {
    const labels = rows.map((row) =>
        getValue(
            row,
            ["category", "Category", "name"],
            "Unknown"
        )
    );

    const revenue = rows.map((row) =>
        Number(
            getValue(
                row,
                ["revenue", "total_revenue"],
                0
            )
        )
    );

    const profit = rows.map((row) =>
        Number(
            getValue(
                row,
                ["profit", "total_profit"],
                0
            )
        )
    );

    const quantity = rows.map((row) =>
        Number(
            getValue(
                row,
                ["quantity", "total_quantity"],
                0
            )
        )
    );


    createBarChart(
        "category-revenue-chart",
        "categoryRevenue",
        labels,
        [
            {
                label: "Revenue",
                data: revenue,

                backgroundColor: "#2563eb",

                borderRadius: 4
            }
        ],
        {
            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    grid: {
                        color: "#eef1f4"
                    },

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                },

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createBarChart(
        "category-profit-chart",
        "categoryProfit",
        labels,
        [
            {
                label: "Profit",
                data: profit,

                backgroundColor: "#16803c",

                borderRadius: 4
            }
        ],
        {
            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    grid: {
                        color: "#eef1f4"
                    },

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                },

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createBarChart(
        "category-quantity-chart",
        "categoryQuantity",
        labels,
        [
            {
                label: "Quantity",
                data: quantity,

                backgroundColor: "#475467",

                borderRadius: 4
            }
        ],
        {
            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    grid: {
                        color: "#eef1f4"
                    }
                },

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createDoughnutChart(
        "category-contribution-chart",
        "categoryContribution",
        labels,
        revenue
    );
}

function renderCategorySummary(rows) {
    const container = $("category-summary");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!rows.length) {
        return;
    }

    const sorted = [...rows].sort(
        (a, b) =>
            Number(
                getValue(
                    b,
                    ["revenue", "total_revenue"],
                    0
                )
            ) -
            Number(
                getValue(
                    a,
                    ["revenue", "total_revenue"],
                    0
                )
            )
    );

    sorted.slice(0, 4).forEach((row) => {
        const category = getValue(
            row,
            ["category", "Category", "name"],
            "Unknown"
        );

        const revenue = Number(
            getValue(
                row,
                ["revenue", "total_revenue"],
                0
            )
        );

        const profit = Number(
            getValue(
                row,
                ["profit", "total_profit"],
                0
            )
        );

        const margin =
            revenue !== 0
                ? (profit / revenue) * 100
                : 0;

        const card = document.createElement("article");

        card.className =
            "category-summary-card";

        card.innerHTML = `
            <span>${escapeHTML(String(category))}</span>

            <strong>
                ${formatCurrency(revenue)}
            </strong>

            <small>
                Profit ${formatCurrency(profit)}
                · Margin ${formatPercentage(margin)}
            </small>
        `;

        container.appendChild(card);
    });
}


/* =========================================================
   REGIONAL ANALYSIS
========================================================= */

async function loadRegionPerformance() {
    const data = await apiRequest(
        "/api/region-performance",
        {
            params: getFilterParams()
        }
    );

    const rows = getArray(
        data,
        ["data", "regions", "performance"]
    );

    state.regionData = rows;

    renderRegionCharts(rows);
    renderRegionTable(rows);
}

function getRegionName(row) {
    return String(
        getValue(
            row,
            ["region", "Region", "name"],
            "Unknown Region"
        )
    );
}

function renderRegionCharts(rows) {
    const labels = rows.map(getRegionName);

    const revenue = rows.map((row) =>
        Number(
            getValue(
                row,
                ["revenue", "total_revenue"],
                0
            )
        )
    );

    const profit = rows.map((row) =>
        Number(
            getValue(
                row,
                ["profit", "total_profit"],
                0
            )
        )
    );

    const orders = rows.map((row) =>
        Number(
            getValue(
                row,
                ["orders", "total_orders"],
                0
            )
        )
    );


    createBarChart(
        "region-revenue-chart",
        "regionRevenue",
        labels,
        [
            {
                label: "Revenue",
                data: revenue,

                backgroundColor: "#2563eb",

                borderRadius: 4
            }
        ],
        {
            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    },

                    grid: {
                        color: "#eef1f4"
                    }
                },

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createBarChart(
        "region-profit-chart",
        "regionProfit",
        labels,
        [
            {
                label: "Profit",
                data: profit,

                backgroundColor: "#16803c",

                borderRadius: 4
            }
        ],
        {
            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    },

                    grid: {
                        color: "#eef1f4"
                    }
                },

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );


    createBarChart(
        "region-orders-chart",
        "regionOrders",
        labels,
        [
            {
                label: "Orders",
                data: orders,

                backgroundColor: "#475467",

                borderRadius: 4
            }
        ],
        {
            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        color: "#98a2b3"
                    },

                    grid: {
                        color: "#eef1f4"
                    }
                },

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#667085",
                        font: {
                            size: 9
                        }
                    }
                }
            }
        }
    );
}

function renderRegionTable(rows) {
    const body = $("region-table-body");

    if (!body) {
        return;
    }

    body.innerHTML = "";

    if (!rows.length) {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td colspan="6" class="table-empty">
                No regional data matches the selected filters.
            </td>
        `;

        body.appendChild(tr);

        return;
    }

    rows.forEach((row) => {
        const revenue = Number(
            getValue(
                row,
                ["revenue", "total_revenue"],
                0
            )
        );

        const profit = Number(
            getValue(
                row,
                ["profit", "total_profit"],
                0
            )
        );

        const orders = Number(
            getValue(
                row,
                ["orders", "total_orders"],
                0
            )
        );

        const quantity = Number(
            getValue(
                row,
                ["quantity", "total_quantity"],
                0
            )
        );

        const margin =
            revenue !== 0
                ? (profit / revenue) * 100
                : 0;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td class="product-name-cell">
                ${escapeHTML(getRegionName(row))}
            </td>

            <td>
                ${formatCurrency(revenue)}
            </td>

            <td>
                ${formatCurrency(profit)}
            </td>

            <td>
                ${formatNumber(orders)}
            </td>

            <td>
                ${formatNumber(quantity)}
            </td>

            <td class="${margin >= 0 ? "margin-positive" : "margin-negative"}">
                ${formatPercentage(margin)}
            </td>
        `;

        body.appendChild(tr);
    });
}


/* =========================================================
   BUSINESS INSIGHTS
========================================================= */

async function loadInsights() {
    const data = await apiRequest(
        "/api/insights",
        {
            params: getFilterParams()
        }
    );

    const insights = getArray(
        data,
        ["insights", "data", "findings"]
    );

    renderInsights(insights);
}

function renderInsights(insights) {
    const container = $("insights-grid");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!insights.length) {
        container.innerHTML = `
            <article class="insight-card">

                <div class="insight-icon">
                    —
                </div>

                <div>
                    <span>Business Insight</span>

                    <h3>
                        No insights available
                    </h3>

                    <p>
                        There is not enough data for the
                        selected filters to generate insights.
                    </p>
                </div>

            </article>
        `;

        return;
    }

    insights.forEach((insight, index) => {
        const title =
            getValue(
                insight,
                ["title", "heading", "name"],
                `Insight ${index + 1}`
            );

        const description =
            getValue(
                insight,
                ["description", "text", "message"],
                ""
            );

        const type =
            getValue(
                insight,
                ["type", "category"],
                "Business Insight"
            );

        const icon =
            getValue(
                insight,
                ["icon"],
                "✦"
            );

        const card = document.createElement("article");

        card.className = "insight-card";

        card.innerHTML = `
            <div class="insight-icon">
                ${escapeHTML(String(icon))}
            </div>

            <div>
                <span>
                    ${escapeHTML(String(type))}
                </span>

                <h3>
                    ${escapeHTML(String(title))}
                </h3>

                <p>
                    ${escapeHTML(String(description))}
                </p>
            </div>
        `;

        container.appendChild(card);
    });
}


/* =========================================================
   FORECASTING
========================================================= */

async function loadForecast() {
    setChartLoading(
        "forecast-loading",
        true
    );

    if ($("forecast-empty")) {
        $("forecast-empty").hidden = true;
    }

    try {
        const period =
            $("forecast-period")?.value || "6";

        const params = {
            ...getFilterParams(),
            periods: period
        };

        const data = await apiRequest(
            "/api/forecast",
            {
                params
            }
        );

        renderForecast(data);

    } finally {
        setChartLoading(
            "forecast-loading",
            false
        );
    }
}

function renderForecast(data) {
    const historical = getArray(
        data,
        ["historical", "history", "historical_data"]
    );

    const forecast = getArray(
        data,
        ["forecast", "forecast_data", "predictions"]
    );

    const historicalLabels =
        historical.map((row) =>
            getValue(
                row,
                ["period", "month", "date", "label"],
                ""
            )
        );

    const historicalValues =
        historical.map((row) =>
            Number(
                getValue(
                    row,
                    ["revenue", "sales", "value", "actual"],
                    0
                )
            )
        );

    const forecastLabels =
        forecast.map((row) =>
            getValue(
                row,
                ["period", "month", "date", "label"],
                ""
            )
        );

    const forecastValues =
        forecast.map((row) =>
            Number(
                getValue(
                    row,
                    ["forecast", "prediction", "value", "revenue"],
                    0
                )
            )
        );

    const combinedLabels = [
        ...historicalLabels,
        ...forecastLabels
    ];

    const actualData = [
        ...historicalValues,
        ...new Array(forecastValues.length).fill(null)
    ];

    const forecastData = [
        ...new Array(
            Math.max(historicalValues.length - 1, 0)
        ).fill(null),

        historicalValues.length
            ? historicalValues[historicalValues.length - 1]
            : null,

        ...forecastValues
    ];

    createLineChart(
        "forecast-chart",
        "forecast",
        combinedLabels,
        [
            {
                label: "Historical",

                data: actualData,

                borderColor: "#2563eb",

                backgroundColor:
                    "rgba(37, 99, 235, 0.06)",

                borderWidth: 2,

                tension: 0.35,

                pointRadius: 2,

                fill: true
            },

            {
                label: "Forecast",

                data: forecastData,

                borderColor: "#475467",

                borderWidth: 2,

                borderDash: [6, 5],

                tension: 0.35,

                pointRadius: 2
            }
        ],
        {
            scales: {
                ...getChartDefaults().scales,

                y: {
                    ...getChartDefaults().scales.y,

                    ticks: {
                        color: "#98a2b3",

                        callback(value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            },

            plugins: {
                tooltip: {
                    callbacks: {
                        label(context) {
                            return ` ${context.dataset.label}: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    );


    $("forecast-model-name").textContent =
        getValue(
            data,
            ["model", "model_name", "algorithm"],
            "Lightweight forecasting model"
        );

    $("forecast-description").textContent =
        getValue(
            data,
            ["description", "message"],
            "Forecast generated from historical sales data."
        );

    const confidence =
        getValue(
            data,
            ["confidence", "uncertainty", "confidence_level"],
            "—"
        );

    $("forecast-confidence-value").textContent =
        typeof confidence === "number"
            ? formatPercentage(confidence)
            : confidence;

    $("forecast-historical-period").textContent =
        historical.length
            ? `${historicalLabels[0]} – ${historicalLabels[historicalLabels.length - 1]}`
            : "—";

    $("forecast-period-display").textContent =
        forecast.length
            ? `${forecastLabels[0]} – ${forecastLabels[forecastLabels.length - 1]}`
            : "—";

    const forecastTotal =
        forecastValues.reduce(
            (sum, value) => sum + value,
            0
        );

    $("forecast-total").textContent =
        formatCurrency(forecastTotal);

    const lastHistorical =
        historicalValues[historicalValues.length - 1] || 0;

    const firstForecast =
        forecastValues[0] || 0;

    const forecastGrowth =
        lastHistorical !== 0
            ? ((firstForecast - lastHistorical) /
                lastHistorical) * 100
            : 0;

    $("forecast-growth").textContent =
        `${forecastGrowth >= 0 ? "+" : ""}${formatPercentage(forecastGrowth)}`;
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {
    const navigationItems =
        document.querySelectorAll(
            ".navigation-item"
        );

    navigationItems.forEach((item) => {
        item.addEventListener("click", () => {

            navigationItems.forEach(
                (navigationItem) => {
                    navigationItem.classList.remove(
                        "active"
                    );
                }
            );

            item.classList.add("active");

            closeMobileSidebar();
        });
    });


    const sections =
        document.querySelectorAll(
            ".dashboard-section"
        );

    const observer = new IntersectionObserver(
        (entries) => {

            const visibleSections =
                entries
                    .filter(
                        (entry) =>
                            entry.isIntersecting
                    )
                    .sort(
                        (a, b) =>
                            b.intersectionRatio -
                            a.intersectionRatio
                    );

            if (!visibleSections.length) {
                return;
            }

            const sectionId =
                visibleSections[0]
                    .target
                    .id;

            navigationItems.forEach(
                (item) => {
                    item.classList.toggle(
                        "active",
                        item.dataset.section ===
                            sectionId
                    );
                }
            );
        },
        {
            threshold: [0.2, 0.4, 0.6],
            rootMargin: "-90px 0px -45% 0px"
        }
    );

    sections.forEach((section) =>
        observer.observe(section)
    );
}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function setupSidebar() {
    sidebarToggle?.addEventListener(
        "click",
        () => {
            const isOpen =
                sidebar.classList.toggle(
                    "mobile-open"
                );

            sidebarOverlay.hidden = !isOpen;
        }
    );

    sidebarOverlay?.addEventListener(
        "click",
        closeMobileSidebar
    );
}

function closeMobileSidebar() {
    sidebar?.classList.remove(
        "mobile-open"
    );

    if (sidebarOverlay) {
        sidebarOverlay.hidden = true;
    }
}


/* =========================================================
   REFRESH DASHBOARD
========================================================= */

async function refreshDashboard() {
    if (state.isLoading) {
        return;
    }

    state.isLoading = true;

    hideError();

    const refreshButton =
        $("refresh-dashboard");

    refreshButton?.classList.add(
        "loading"
    );

    try {
        await Promise.all([
            loadOverview(),
            loadSalesTrend(),
            loadProductPerformance(),
            loadCategoryPerformance(),
            loadRegionPerformance(),
            loadInsights(),
            loadForecast()
        ]);

        $("last-updated").textContent =
            formatDateTime();

    } catch (error) {
        console.error(error);

        showError(
            error.message ||
            "Unable to load dashboard data."
        );

    } finally {
        state.isLoading = false;

        refreshButton?.classList.remove(
            "loading"
        );

        hideLoader();
    }
}


/* =========================================================
   RETRY
========================================================= */

function setupRetry() {
    $("retry-dashboard")?.addEventListener(
        "click",
        refreshDashboard
    );

    $("refresh-dashboard")?.addEventListener(
        "click",
        refreshDashboard
    );
}


/* =========================================================
   FORECAST BUTTON
========================================================= */

function setupForecastControls() {
    $("run-forecast")?.addEventListener(
        "click",
        loadForecast
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* =========================================================
   APPLICATION INITIALISATION
========================================================= */

async function initialiseApplication() {
    showLoader();

    try {
        setupNavigation();
        setupSidebar();
        setupFilterEvents();
        setupProductSearch();
        setupRetry();
        setupForecastControls();

        await loadFilters();

        await refreshDashboard();

    } catch (error) {
        console.error(error);

        showError(
            error.message ||
            "Unable to initialise the dashboard."
        );

        hideLoader();
    }
}


/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initialiseApplication
);

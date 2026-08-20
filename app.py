# ─────────────────────────────────────────────────
# BI Command Centre — app.py
# Flask + Pandas + SQLite + Scikit-learn
# Place your CSV at: data/ecommerce.csv
# Run: python app.py
# ─────────────────────────────────────────────────

import os
import math
import warnings
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

warnings.filterwarnings('ignore')

# ── App & DB setup ────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'data', 'bi_data.sqlite')
CSV_PATH = os.path.join(BASE_DIR, 'data', 'ecommerce.csv')

os.makedirs(os.path.join(BASE_DIR, 'data'), exist_ok=True)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI']        = f'sqlite:///{DB_PATH}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JSON_SORT_KEYS']                 = False

db = SQLAlchemy(app)

# ── CORS for local frontend dev ───────────────────
@app.after_request
def add_cors(response):
    response.headers['Access-Control-Allow-Origin']  = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# ════════════════════════════════════════════════
# DB INITIALISATION
# ════════════════════════════════════════════════

COLUMN_MAP = {
    # common column aliases from the Kaggle dataset
    'Order ID':        'order_id',
    'Order Date':      'order_date',
    'Ship Date':       'ship_date',
    'Ship Mode':       'ship_mode',
    'Customer ID':     'customer_id',
    'Customer Name':   'customer_name',
    'Segment':         'segment',
    'Country':         'country',
    'City':            'city',
    'State':           'state',
    'Postal Code':     'postal_code',
    'Region':          'region',
    'Product ID':      'product_id',
    'Category':        'category',
    'Sub-Category':    'sub_category',
    'Product Name':    'product_name',
    'Sales':           'sales',
    'Quantity':        'quantity',
    'Discount':        'discount',
    'Profit':          'profit',
}

def load_csv_to_db():
    """Read CSV, clean it, persist to SQLite."""
    if not os.path.exists(CSV_PATH):
        raise FileNotFoundError(
            f"Dataset not found at {CSV_PATH}. "
            "Download from Kaggle and place the CSV at data/ecommerce.csv"
        )

    df = pd.read_csv(CSV_PATH, encoding='latin-1')

    # Normalise column names
    df.columns = [c.strip() for c in df.columns]
    df.rename(columns={k: v for k, v in COLUMN_MAP.items() if k in df.columns}, inplace=True)

    # Ensure required columns exist
    required = ['order_date', 'sales', 'profit', 'quantity', 'region', 'category', 'product_name']
    missing  = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing columns: {missing}. Found: {list(df.columns)}")

    # Parse & clean
    df['order_date'] = pd.to_datetime(df['order_date'], infer_datetime_format=True, errors='coerce')
    df.dropna(subset=['order_date', 'sales', 'profit'], inplace=True)

    df['sales']    = pd.to_numeric(df['sales'],    errors='coerce').fillna(0)
    df['profit']   = pd.to_numeric(df['profit'],   errors='coerce').fillna(0)
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce').fillna(0)
    df['discount'] = pd.to_numeric(df.get('discount', 0), errors='coerce').fillna(0)

    df['year']  = df['order_date'].dt.year
    df['month'] = df['order_date'].dt.month
    df['period'] = df['order_date'].dt.to_period('M').astype(str)

    # Ensure string cols
    for col in ['region', 'category', 'product_name', 'sub_category', 'segment']:
        if col in df.columns:
            df[col] = df[col].fillna('Unknown').astype(str).str.strip()

    df.to_sql('orders', con=db.engine, if_exists='replace', index=False)
    print(f"  Loaded {len(df):,} rows into SQLite.")
    return df


def init_db():
    with app.app_context():
        if not os.path.exists(DB_PATH):
            print("Building database from CSV…")
            load_csv_to_db()
        else:
            # Quick sanity check
            try:
                with db.engine.connect() as con:
                    con.execute(text("SELECT 1 FROM orders LIMIT 1"))
            except Exception:
                print("Rebuilding database…")
                load_csv_to_db()


# ════════════════════════════════════════════════
# QUERY HELPERS
# ════════════════════════════════════════════════

def parse_filters():
    """Extract and validate query-string filters."""
    year     = request.args.get('year', '').strip()
    region   = request.args.get('region', '').strip()
    category = request.args.get('category', '').strip()

    # Only allow integers for year
    if year and not year.isdigit():
        year = ''

    return year, region, category


def build_where(year, region, category, alias=''):
    """Return (where_clause, params_dict) for SQL."""
    clauses, params = [], {}
    a = f"{alias}." if alias else ""

    if year:
        clauses.append(f"{a}year = :year")
        params['year'] = int(year)
    if region:
        clauses.append(f"{a}region = :region")
        params['region'] = region
    if category:
        clauses.append(f"{a}category = :category")
        params['category'] = category

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def query_df(sql, params=None):
    """Run a SQL query, return DataFrame."""
    with db.engine.connect() as con:
        return pd.read_sql(text(sql), con=con, params=params or {})


def safe_float(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    return float(v)


def safe_int(v):
    if v is None:
        return None
    return int(v)


# ════════════════════════════════════════════════
# ROUTES — FRONTEND
# ════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


# ════════════════════════════════════════════════
# API — FILTERS
# ════════════════════════════════════════════════

@app.route('/api/filters')
def api_filters():
    try:
        years      = query_df("SELECT DISTINCT year FROM orders WHERE year IS NOT NULL ORDER BY year")
        regions    = query_df("SELECT DISTINCT region FROM orders WHERE region IS NOT NULL ORDER BY region")
        categories = query_df("SELECT DISTINCT category FROM orders WHERE category IS NOT NULL ORDER BY category")

        return jsonify({
            'years':      [int(y) for y in years['year'].tolist()],
            'regions':    regions['region'].tolist(),
            'categories': categories['category'].tolist(),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — OVERVIEW
# ════════════════════════════════════════════════

@app.route('/api/overview')
def api_overview():
    try:
        year, region, category = parse_filters()
        where, params = build_where(year, region, category)

        sql = f"""
            SELECT
                SUM(sales)           AS total_revenue,
                SUM(profit)          AS total_profit,
                COUNT(DISTINCT COALESCE(order_id, rowid)) AS total_orders,
                SUM(quantity)        AS total_quantity,
                AVG(sales)           AS avg_order_value,
                SUM(profit) / NULLIF(SUM(sales), 0) AS profit_margin
            FROM orders {where}
        """
        row = query_df(sql, params).iloc[0]

        # Revenue growth: compare last full year vs prior year (ignore filter year)
        growth = None
        try:
            gdf = query_df("""
                SELECT year, SUM(sales) AS rev FROM orders
                GROUP BY year ORDER BY year DESC LIMIT 2
            """)
            if len(gdf) == 2:
                curr, prev = gdf.iloc[0]['rev'], gdf.iloc[1]['rev']
                if prev and prev != 0:
                    growth = (curr - prev) / prev
        except Exception:
            pass

        return jsonify({
            'total_revenue':   safe_float(row['total_revenue']),
            'total_profit':    safe_float(row['total_profit']),
            'total_orders':    safe_int(row['total_orders']),
            'total_quantity':  safe_int(row['total_quantity']),
            'avg_order_value': safe_float(row['avg_order_value']),
            'profit_margin':   safe_float(row['profit_margin']),
            'revenue_growth':  safe_float(growth),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — SALES TREND
# ════════════════════════════════════════════════

@app.route('/api/sales-trend')
def api_sales_trend():
    try:
        year, region, category = parse_filters()
        where, params = build_where(year, region, category)

        df = query_df(f"""
            SELECT period,
                   SUM(sales)  AS revenue,
                   SUM(profit) AS profit
            FROM orders {where}
            GROUP BY period
            ORDER BY period
        """, params)

        if df.empty:
            return jsonify({'labels': [], 'revenue': [], 'profit': [], 'best_worst': []})

        df['margin'] = df['profit'] / df['revenue'].replace(0, np.nan)

        # Best 3 + worst 3 months
        top3  = df.nlargest(3, 'revenue')
        bot3  = df.nsmallest(3, 'revenue')
        bw = pd.concat([top3, bot3]).drop_duplicates().to_dict('records')

        return jsonify({
            'labels':  df['period'].tolist(),
            'revenue': [safe_float(v) for v in df['revenue']],
            'profit':  [safe_float(v) for v in df['profit']],
            'best_worst': [
                {
                    'period':  r['period'],
                    'revenue': safe_float(r['revenue']),
                    'profit':  safe_float(r['profit']),
                    'margin':  safe_float(r['margin']),
                } for r in bw
            ],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — CATEGORY PERFORMANCE
# ════════════════════════════════════════════════

@app.route('/api/category-performance')
def api_category_performance():
    try:
        year, region, category = parse_filters()
        where, params = build_where(year, region, category)

        df = query_df(f"""
            SELECT category,
                   SUM(sales)    AS revenue,
                   SUM(profit)   AS profit,
                   SUM(quantity) AS quantity,
                   COUNT(DISTINCT COALESCE(order_id, rowid)) AS orders
            FROM orders {where}
            GROUP BY category
            ORDER BY revenue DESC
        """, params)

        if df.empty:
            return jsonify({'categories': [], 'revenue': [], 'profit': [], 'quantity': [], 'orders': []})

        return jsonify({
            'categories': df['category'].tolist(),
            'revenue':    [safe_float(v) for v in df['revenue']],
            'profit':     [safe_float(v) for v in df['profit']],
            'quantity':   [safe_int(v)   for v in df['quantity']],
            'orders':     [safe_int(v)   for v in df['orders']],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — PRODUCT PERFORMANCE
# ════════════════════════════════════════════════

@app.route('/api/product-performance')
def api_product_performance():
    try:
        year, region, category = parse_filters()
        where, params = build_where(year, region, category)

        df = query_df(f"""
            SELECT product_name AS product,
                   SUM(sales)    AS revenue,
                   SUM(profit)   AS profit,
                   SUM(quantity) AS quantity
            FROM orders {where}
            GROUP BY product_name
        """, params)

        if df.empty:
            return jsonify({'top_revenue': [], 'top_profit': [], 'bottom': []})

        df['margin'] = df['profit'] / df['revenue'].replace(0, np.nan)

        def to_records(frame):
            return [
                {
                    'product':  r['product'],
                    'revenue':  safe_float(r['revenue']),
                    'profit':   safe_float(r['profit']),
                    'quantity': safe_int(r['quantity']),
                    'margin':   safe_float(r['margin']),
                }
                for _, r in frame.iterrows()
            ]

        top_rev    = df.nlargest(15, 'revenue')
        top_profit = df.nlargest(15, 'profit')
        bottom     = df.nsmallest(15, 'revenue')

        return jsonify({
            'top_revenue': to_records(top_rev),
            'top_profit':  to_records(top_profit),
            'bottom':      to_records(bottom),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — REGION PERFORMANCE
# ════════════════════════════════════════════════

@app.route('/api/region-performance')
def api_region_performance():
    try:
        year, region, category = parse_filters()
        where, params = build_where(year, region, category)

        df = query_df(f"""
            SELECT region,
                   SUM(sales)    AS revenue,
                   SUM(profit)   AS profit,
                   SUM(quantity) AS quantity,
                   COUNT(DISTINCT COALESCE(order_id, rowid)) AS orders
            FROM orders {where}
            GROUP BY region
            ORDER BY revenue DESC
        """, params)

        if df.empty:
            return jsonify({'regions': [], 'revenue': [], 'profit': [], 'quantity': [], 'orders': [], 'margin': []})

        df['margin'] = df['profit'] / df['revenue'].replace(0, np.nan)

        return jsonify({
            'regions':  df['region'].tolist(),
            'revenue':  [safe_float(v) for v in df['revenue']],
            'profit':   [safe_float(v) for v in df['profit']],
            'quantity': [safe_int(v)   for v in df['quantity']],
            'orders':   [safe_int(v)   for v in df['orders']],
            'margin':   [safe_float(v) for v in df['margin']],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — INSIGHTS
# ════════════════════════════════════════════════

@app.route('/api/insights')
def api_insights():
    try:
        year, region, category = parse_filters()
        where, params = build_where(year, region, category)
        insights = []

        # 1. Strongest category
        cat_df = query_df(f"""
            SELECT category, SUM(sales) AS rev, SUM(profit) AS profit
            FROM orders {where}
            GROUP BY category ORDER BY rev DESC LIMIT 1
        """, params)
        if not cat_df.empty:
            r = cat_df.iloc[0]
            insights.append({
                'type': 'positive', 'tag': 'Top Category',
                'title': f"{r['category']} leads revenue",
                'detail': 'Strongest category by total sales across all regions and periods.',
                'value': f"${r['rev']:,.0f}",
            })

        # 2. Weakest category
        weak_df = query_df(f"""
            SELECT category, SUM(sales) AS rev FROM orders {where}
            GROUP BY category ORDER BY rev ASC LIMIT 1
        """, params)
        if not weak_df.empty:
            r = weak_df.iloc[0]
            insights.append({
                'type': 'negative', 'tag': 'Weak Category',
                'title': f"{r['category']} underperforms",
                'detail': 'Lowest revenue contribution — consider promotions or inventory review.',
                'value': f"${r['rev']:,.0f}",
            })

        # 3. Best region
        reg_df = query_df(f"""
            SELECT region, SUM(sales) AS rev, SUM(profit) AS profit
            FROM orders {where}
            GROUP BY region ORDER BY rev DESC LIMIT 1
        """, params)
        if not reg_df.empty:
            r = reg_df.iloc[0]
            insights.append({
                'type': 'positive', 'tag': 'Best Region',
                'title': f"{r['region']} region is strongest",
                'detail': 'Highest revenue region — opportunity to replicate success elsewhere.',
                'value': f"${r['rev']:,.0f}",
            })

        # 4. Highest-profit product
        prod_df = query_df(f"""
            SELECT product_name, SUM(profit) AS profit
            FROM orders {where}
            GROUP BY product_name ORDER BY profit DESC LIMIT 1
        """, params)
        if not prod_df.empty:
            r = prod_df.iloc[0]
            insights.append({
                'type': 'positive', 'tag': 'Top Product',
                'title': 'Highest-profit product',
                'detail': r['product_name'][:60],
                'value': f"${r['profit']:,.0f} profit",
            })

        # 5. High-sales, low-margin category (discount pressure)
        margin_df = query_df(f"""
            SELECT category,
                   SUM(sales) AS rev,
                   SUM(profit) / NULLIF(SUM(sales), 0) AS margin
            FROM orders {where}
            GROUP BY category
            HAVING rev > 0
            ORDER BY margin ASC LIMIT 1
        """, params)
        if not margin_df.empty:
            r = margin_df.iloc[0]
            margin_pct = (r['margin'] or 0) * 100
            insights.append({
                'type': 'amber', 'tag': 'Margin Alert',
                'title': f"{r['category']} has thin margins",
                'detail': 'High sales but low profit — likely excess discounting or high cost of goods.',
                'value': f"{margin_pct:.1f}% margin",
            })

        # 6. Largest monthly revenue growth
        trend_df = query_df(f"""
            SELECT period, SUM(sales) AS rev
            FROM orders {where}
            GROUP BY period ORDER BY period
        """, params)
        if len(trend_df) >= 2:
            trend_df['growth'] = trend_df['rev'].pct_change()
            best_g = trend_df.dropna().nlargest(1, 'growth').iloc[0]
            insights.append({
                'type': 'neutral', 'tag': 'Peak Growth',
                'title': f"Biggest monthly jump: {best_g['period']}",
                'detail': 'Largest month-over-month revenue increase in the dataset.',
                'value': f"+{best_g['growth'] * 100:.1f}%",
            })

        return jsonify({'insights': insights})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# API — FORECAST  (linear regression via NumPy)
# ════════════════════════════════════════════════

@app.route('/api/forecast')
def api_forecast():
    try:
        # Always forecast on full dataset (no filters — more data = better model)
        df = query_df("""
            SELECT period, SUM(sales) AS revenue
            FROM orders
            GROUP BY period
            ORDER BY period
        """)

        if len(df) < 6:
            return jsonify({'error': 'Not enough data to forecast (need ≥ 6 months).'}), 422

        # Numeric index for regression
        df = df.reset_index(drop=True)
        X = df.index.values.astype(float)
        y = df['revenue'].values.astype(float)

        # Linear regression with NumPy (no sklearn required)
        coeffs = np.polyfit(X, y, 1)          # slope, intercept
        poly   = np.poly1d(coeffs)

        y_hat  = poly(X)
        ss_res = np.sum((y - y_hat) ** 2)
        ss_tot = np.sum((y - y.mean()) ** 2)
        r2     = 1 - ss_res / ss_tot if ss_tot else 0
        rmse   = math.sqrt(ss_res / len(y))

        # 95% prediction interval (simplified)
        n  = len(X)
        se = math.sqrt(ss_res / max(n - 2, 1))
        t_val = 2.0  # approx t_{0.025} for large n

        # Generate forecast periods
        last_period = pd.Period(df['period'].iloc[-1], freq='M')
        n_fc = 6
        fc_periods = [str(last_period + i) for i in range(1, n_fc + 1)]
        fc_X       = np.arange(n, n + n_fc, dtype=float)
        fc_y       = poly(fc_X)

        # CI width grows with distance from last known point
        x_mean = X.mean()
        ci = [
            t_val * se * math.sqrt(1 + 1/n + (xi - x_mean)**2 / max(np.sum((X - x_mean)**2), 1))
            for xi in fc_X
        ]

        historical = [
            {'period': row['period'], 'revenue': safe_float(row['revenue'])}
            for _, row in df.iterrows()
        ]
        forecast = [
            {
                'period':    fc_periods[i],
                'predicted': safe_float(fc_y[i]),
                'lower':     safe_float(max(fc_y[i] - ci[i], 0)),
                'upper':     safe_float(fc_y[i] + ci[i]),
            }
            for i in range(n_fc)
        ]

        return jsonify({
            'model':      'Linear Trend (OLS)',
            'periods':    n_fc,
            'r2':         round(r2, 4),
            'rmse':       safe_float(rmse),
            'historical': historical,
            'forecast':   forecast,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════

if __name__ == '__main__':
    init_db()
    print("Starting BI Command Centre on http://127.0.0.1:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)

"""
BUSINESS INTELLIGENCE COMMAND CENTRE
------------------------------------
Flask backend for the interactive Data Analyst portfolio project.

Files expected:
    app.py
    business_data.csv          -> automatically generated if missing
    business_intelligence.db  -> automatically generated
    templates/
        index.html
    static/
        style.css
        script.js

Run:
    python app.py
"""

from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sklearn.linear_model import LinearRegression


# ============================================================
# APPLICATION CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

CSV_FILE = BASE_DIR / "business_data.csv"
DATABASE_FILE = BASE_DIR / "business_intelligence.db"

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)

app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{DATABASE_FILE}"
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

CORS(app)


# ============================================================
# DATABASE MODEL
# ============================================================

class Sales(db.Model):
    __tablename__ = "sales"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    order_date = db.Column(
        db.Date,
        nullable=False
    )

    order_id = db.Column(
        db.String(50),
        nullable=False
    )

    product = db.Column(
        db.String(150),
        nullable=False
    )

    category = db.Column(
        db.String(100),
        nullable=False
    )

    region = db.Column(
        db.String(100),
        nullable=False
    )

    quantity = db.Column(
        db.Integer,
        nullable=False
    )

    revenue = db.Column(
        db.Float,
        nullable=False
    )

    profit = db.Column(
        db.Float,
        nullable=False
    )


# ============================================================
# SAMPLE DATASET GENERATION
# ============================================================

def create_dataset():
    """
    Creates a realistic e-commerce sales dataset locally.

    No Kaggle dataset is required.
    The generated CSV is suitable for the dashboard.
    """

    if CSV_FILE.exists():
        return

    np.random.seed(42)

    start_date = pd.Timestamp("2022-01-01")
    end_date = pd.Timestamp("2025-12-31")

    dates = pd.date_range(
        start=start_date,
        end=end_date,
        freq="D"
    )

    products = {
        "Electronics": [
            "Wireless Headphones",
            "Smartphone",
            "Laptop",
            "Bluetooth Speaker",
            "Smart Watch",
            "Tablet"
        ],
        "Home & Kitchen": [
            "Coffee Maker",
            "Air Fryer",
            "Vacuum Cleaner",
            "Mixer Grinder",
            "Electric Kettle",
            "Cookware Set"
        ],
        "Office": [
            "Office Chair",
            "Standing Desk",
            "Mechanical Keyboard",
            "Wireless Mouse",
            "Monitor",
            "Desk Lamp"
        ],
        "Fashion": [
            "Running Shoes",
            "Denim Jacket",
            "Backpack",
            "Cotton Shirt",
            "Sports T-Shirt",
            "Casual Sneakers"
        ],
        "Beauty": [
            "Face Serum",
            "Hair Dryer",
            "Skin Care Kit",
            "Perfume",
            "Electric Trimmer",
            "Makeup Kit"
        ]
    }

    regions = [
        "North",
        "South",
        "East",
        "West",
        "Central"
    ]

    rows = []

    order_number = 100001

    for _ in range(5000):

        date = np.random.choice(dates)

        category = np.random.choice(
            list(products.keys()),
            p=[
                0.28,
                0.22,
                0.17,
                0.20,
                0.13
            ]
        )

        product = np.random.choice(
            products[category]
        )

        region = np.random.choice(
            regions,
            p=[
                0.22,
                0.24,
                0.16,
                0.25,
                0.13
            ]
        )

        quantity = np.random.randint(1, 8)

        base_prices = {
            "Electronics": 18000,
            "Home & Kitchen": 6500,
            "Office": 9000,
            "Fashion": 3500,
            "Beauty": 2800
        }

        base_price = base_prices[category]

        product_factor = np.random.uniform(
            0.65,
            1.45
        )

        revenue = (
            base_price
            * product_factor
            * quantity
            * np.random.uniform(0.85, 1.15)
        )

        margin_ranges = {
            "Electronics": (0.08, 0.20),
            "Home & Kitchen": (0.12, 0.25),
            "Office": (0.15, 0.30),
            "Fashion": (0.18, 0.35),
            "Beauty": (0.20, 0.38)
        }

        low_margin, high_margin = margin_ranges[
            category
        ]

        margin = np.random.uniform(
            low_margin,
            high_margin
        )

        profit = revenue * margin

        rows.append(
            {
                "order_date": date,
                "order_id": f"ORD-{order_number}",
                "product": product,
                "category": category,
                "region": region,
                "quantity": quantity,
                "revenue": round(revenue, 2),
                "profit": round(profit, 2)
            }
        )

        order_number += 1

    df = pd.DataFrame(rows)

    # Add realistic seasonal behaviour.
    df["month"] = pd.to_datetime(
        df["order_date"]
    ).dt.month

    seasonal_multiplier = df["month"].map(
        {
            1: 0.90,
            2: 0.88,
            3: 0.95,
            4: 0.92,
            5: 1.00,
            6: 1.02,
            7: 1.04,
            8: 1.08,
            9: 1.10,
            10: 1.25,
            11: 1.40,
            12: 1.30
        }
    )

    df["revenue"] = (
        df["revenue"]
        * seasonal_multiplier
    ).round(2)

    df["profit"] = (
        df["profit"]
        * seasonal_multiplier
    ).round(2)

    df.drop(
        columns=["month"],
        inplace=True
    )

    # Introduce a small amount of missing data.
    missing_indices = np.random.choice(
        df.index,
        size=15,
        replace=False
    )

    df.loc[
        missing_indices[:7],
        "region"
    ] = np.nan

    df.loc[
        missing_indices[7:],
        "category"
    ] = np.nan

    df.to_csv(
        CSV_FILE,
        index=False
    )


# ============================================================
# DATA CLEANING
# ============================================================

def clean_dataset(df):
    """
    Cleans and standardises the source dataset.
    """

    df = df.copy()

    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_")
    )

    required_columns = [
        "order_date",
        "order_id",
        "product",
        "category",
        "region",
        "quantity",
        "revenue",
        "profit"
    ]

    missing_columns = [
        column
        for column in required_columns
        if column not in df.columns
    ]

    if missing_columns:
        raise ValueError(
            "Dataset is missing required columns: "
            + ", ".join(missing_columns)
        )

    df["order_date"] = pd.to_datetime(
        df["order_date"],
        errors="coerce"
    )

    numeric_columns = [
        "quantity",
        "revenue",
        "profit"
    ]

    for column in numeric_columns:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    text_columns = [
        "order_id",
        "product",
        "category",
        "region"
    ]

    for column in text_columns:
        df[column] = (
            df[column]
            .astype("string")
            .str.strip()
        )

    df["category"] = df["category"].fillna(
        "Unknown"
    )

    df["region"] = df["region"].fillna(
        "Unknown"
    )

    df["product"] = df["product"].fillna(
        "Unknown Product"
    )

    df["quantity"] = df["quantity"].fillna(
        0
    )

    df["revenue"] = df["revenue"].fillna(
        0
    )

    df["profit"] = df["profit"].fillna(
        0
    )

    df = df.dropna(
        subset=[
            "order_date",
            "order_id"
        ]
    )

    df = df.drop_duplicates()

    df["quantity"] = (
        df["quantity"]
        .astype(int)
    )

    df["revenue"] = (
        df["revenue"]
        .round(2)
    )

    df["profit"] = (
        df["profit"]
        .round(2)
    )

    return df


# ============================================================
# DATABASE INITIALISATION
# ============================================================

def initialise_database():
    """
    Creates the SQLite database and loads the CSV.
    """

    create_dataset()

    df = pd.read_csv(
        CSV_FILE
    )

    df = clean_dataset(df)

    with app.app_context():

        db.drop_all()

        db.create_all()

        records = []

        for _, row in df.iterrows():

            record = Sales(
                order_date=row["order_date"].date(),
                order_id=str(row["order_id"]),
                product=str(row["product"]),
                category=str(row["category"]),
                region=str(row["region"]),
                quantity=int(row["quantity"]),
                revenue=float(row["revenue"]),
                profit=float(row["profit"])
            )

            records.append(record)

        db.session.bulk_save_objects(
            records
        )

        db.session.commit()


# ============================================================
# FILTER VALIDATION
# ============================================================

def get_filters():
    """
    Reads and validates dashboard filters.
    """

    year = request.args.get(
        "year",
        ""
    ).strip()

    month = request.args.get(
        "month",
        ""
    ).strip()

    region = request.args.get(
        "region",
        ""
    ).strip()

    category = request.args.get(
        "category",
        ""
    ).strip()

    product = request.args.get(
        "product",
        ""
    ).strip()

    if year:
        try:
            year = int(year)

            if year < 2000 or year > 2100:
                raise ValueError

        except ValueError:
            raise ValueError(
                "Invalid year filter."
            )

    if month:
        try:
            month = int(month)

            if month < 1 or month > 12:
                raise ValueError

        except ValueError:
            raise ValueError(
                "Invalid month filter."
            )

    return {
        "year": year,
        "month": month,
        "region": region,
        "category": category,
        "product": product
    }


# ============================================================
# APPLY FILTERS
# ============================================================

def filtered_query(filters):
    """
    Creates a SQLAlchemy query with dashboard filters.
    """

    query = Sales.query

    if filters["year"]:
        query = query.filter(
            db.extract(
                "year",
                Sales.order_date
            ) == filters["year"]
        )

    if filters["month"]:
        query = query.filter(
            db.extract(
                "month",
                Sales.order_date
            ) == filters["month"]
        )

    if filters["region"]:
        query = query.filter(
            Sales.region == filters["region"]
        )

    if filters["category"]:
        query = query.filter(
            Sales.category == filters["category"]
        )

    if filters["product"]:
        query = query.filter(
            Sales.product == filters["product"]
        )

    return query


# ============================================================
# SERIALISATION HELPER
# ============================================================

def clean_json_value(value):
    """
    Converts NumPy/Pandas values into JSON-safe values.
    """

    if pd.isna(value):
        return None

    if isinstance(
        value,
        (
            np.integer,
            np.int64,
            np.int32
        )
    ):
        return int(value)

    if isinstance(
        value,
        (
            np.floating,
            np.float64,
            np.float32
        )
    ):
        return float(value)

    return value


# ============================================================
# FRONTEND
# ============================================================

@app.route("/")
def index():
    return app.send_static_file(
        "index.html"
    )


# ============================================================
# API: FILTERS
# ============================================================

@app.route(
    "/api/filters",
    methods=["GET"]
)
def filters_api():

    try:

        years = [
            row[0]
            for row in db.session.query(
                db.extract(
                    "year",
                    Sales.order_date
                )
            )
            .distinct()
            .order_by(
                db.extract(
                    "year",
                    Sales.order_date
                )
            )
            .all()
        ]

        months = [
            row[0]
            for row in db.session.query(
                db.extract(
                    "month",
                    Sales.order_date
                )
            )
            .distinct()
            .order_by(
                db.extract(
                    "month",
                    Sales.order_date
                )
            )
            .all()
        ]

        regions = [
            row[0]
            for row in db.session.query(
                Sales.region
            )
            .distinct()
            .order_by(
                Sales.region
            )
            .all()
        ]

        categories = [
            row[0]
            for row in db.session.query(
                Sales.category
            )
            .distinct()
            .order_by(
                Sales.category
            )
            .all()
        ]

        products = [
            row[0]
            for row in db.session.query(
                Sales.product
            )
            .distinct()
            .order_by(
                Sales.product
            )
            .all()
        ]

        return jsonify(
            {
                "success": True,

                "filters": {
                    "years": [
                        int(year)
                        for year in years
                    ],

                    "months": [
                        int(month)
                        for month in months
                    ],

                    "regions": regions,
                    "categories": categories,
                    "products": products
                }
            }
        )

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API: EXECUTIVE OVERVIEW
# ============================================================

@app.route(
    "/api/overview",
    methods=["GET"]
)
def overview_api():

    try:

        filters = get_filters()

        query = filtered_query(
            filters
        )

        rows = query.all()

        if not rows:

            return jsonify(
                {
                    "success": True,

                    "overview": {
                        "total_revenue": 0,
                        "total_profit": 0,
                        "total_orders": 0,
                        "total_quantity": 0,
                        "average_order_value": 0,
                        "profit_margin": 0,
                        "revenue_growth": 0
                    }
                }
            )

        total_revenue = sum(
            row.revenue
            for row in rows
        )

        total_profit = sum(
            row.profit
            for row in rows
        )

        total_quantity = sum(
            row.quantity
            for row in rows
        )

        total_orders = len(
            set(
                row.order_id
                for row in rows
            )
        )

        average_order_value = (
            total_revenue / total_orders
            if total_orders
            else 0
        )

        profit_margin = (
            total_profit / total_revenue * 100
            if total_revenue
            else 0
        )

        # Revenue growth based on monthly revenue.
        monthly = {}

        for row in rows:

            key = (
                row.order_date.year,
                row.order_date.month
            )

            monthly[key] = (
                monthly.get(key, 0)
                + row.revenue
            )

        ordered_months = sorted(
            monthly.keys()
        )

        revenue_growth = 0

        if len(ordered_months) >= 2:

            previous = monthly[
                ordered_months[-2]
            ]

            current = monthly[
                ordered_months[-1]
            ]

            if previous:
                revenue_growth = (
                    (current - previous)
                    / previous
                    * 100
                )

        return jsonify(
            {
                "success": True,

                "overview": {
                    "total_revenue": round(
                        total_revenue,
                        2
                    ),

                    "total_profit": round(
                        total_profit,
                        2
                    ),

                    "total_orders":
                        total_orders,

                    "total_quantity":
                        total_quantity,

                    "average_order_value":
                        round(
                            average_order_value,
                            2
                        ),

                    "profit_margin":
                        round(
                            profit_margin,
                            2
                        ),

                    "revenue_growth":
                        round(
                            revenue_growth,
                            2
                        )
                }
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API: SALES TREND
# ============================================================

@app.route(
    "/api/sales-trend",
    methods=["GET"]
)
def sales_trend_api():

    try:

        filters = get_filters()

        rows = filtered_query(
            filters
        ).all()

        monthly = {}

        for row in rows:

            key = row.order_date.strftime(
                "%Y-%m"
            )

            if key not in monthly:

                monthly[key] = {
                    "revenue": 0,
                    "profit": 0
                }

            monthly[key]["revenue"] += (
                row.revenue
            )

            monthly[key]["profit"] += (
                row.profit
            )

        data = []

        for period in sorted(
            monthly.keys()
        ):

            data.append(
                {
                    "period": period,
                    "month": period,

                    "year":
                        int(period[:4]),

                    "revenue":
                        round(
                            monthly[period][
                                "revenue"
                            ],
                            2
                        ),

                    "profit":
                        round(
                            monthly[period][
                                "profit"
                            ],
                            2
                        )
                }
            )

        return jsonify(
            {
                "success": True,
                "data": data
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API: CATEGORY PERFORMANCE
# ============================================================

@app.route(
    "/api/category-performance",
    methods=["GET"]
)
def category_performance_api():

    try:

        filters = get_filters()

        rows = filtered_query(
            filters
        ).all()

        grouped = {}

        for row in rows:

            category = row.category

            if category not in grouped:

                grouped[category] = {
                    "revenue": 0,
                    "profit": 0,
                    "quantity": 0,
                    "orders": set()
                }

            grouped[category]["revenue"] += (
                row.revenue
            )

            grouped[category]["profit"] += (
                row.profit
            )

            grouped[category]["quantity"] += (
                row.quantity
            )

            grouped[category]["orders"].add(
                row.order_id
            )

        data = []

        for category, values in grouped.items():

            data.append(
                {
                    "category": category,

                    "revenue":
                        round(
                            values["revenue"],
                            2
                        ),

                    "profit":
                        round(
                            values["profit"],
                            2
                        ),

                    "quantity":
                        values["quantity"],

                    "orders":
                        len(values["orders"])
                }
            )

        data.sort(
            key=lambda item:
                item["revenue"],
            reverse=True
        )

        return jsonify(
            {
                "success": True,
                "data": data
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API: PRODUCT PERFORMANCE
# ============================================================

@app.route(
    "/api/product-performance",
    methods=["GET"]
)
def product_performance_api():

    try:

        filters = get_filters()

        rows = filtered_query(
            filters
        ).all()

        grouped = {}

        for row in rows:

            product = row.product

            if product not in grouped:

                grouped[product] = {
                    "revenue": 0,
                    "profit": 0,
                    "quantity": 0,
                    "orders": set(),
                    "category": row.category
                }

            grouped[product]["revenue"] += (
                row.revenue
            )

            grouped[product]["profit"] += (
                row.profit
            )

            grouped[product]["quantity"] += (
                row.quantity
            )

            grouped[product]["orders"].add(
                row.order_id
            )

        data = []

        for product, values in grouped.items():

            data.append(
                {
                    "product": product,

                    "category":
                        values["category"],

                    "revenue":
                        round(
                            values["revenue"],
                            2
                        ),

                    "profit":
                        round(
                            values["profit"],
                            2
                        ),

                    "quantity":
                        values["quantity"],

                    "orders":
                        len(values["orders"])
                }
            )

        data.sort(
            key=lambda item:
                item["revenue"],
            reverse=True
        )

        return jsonify(
            {
                "success": True,
                "data": data
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API: REGION PERFORMANCE
# ============================================================

@app.route(
    "/api/region-performance",
    methods=["GET"]
)
def region_performance_api():

    try:

        filters = get_filters()

        rows = filtered_query(
            filters
        ).all()

        grouped = {}

        for row in rows:

            region = row.region

            if region not in grouped:

                grouped[region] = {
                    "revenue": 0,
                    "profit": 0,
                    "quantity": 0,
                    "orders": set()
                }

            grouped[region]["revenue"] += (
                row.revenue
            )

            grouped[region]["profit"] += (
                row.profit
            )

            grouped[region]["quantity"] += (
                row.quantity
            )

            grouped[region]["orders"].add(
                row.order_id
            )

        data = []

        for region, values in grouped.items():

            data.append(
                {
                    "region": region,

                    "revenue":
                        round(
                            values["revenue"],
                            2
                        ),

                    "profit":
                        round(
                            values["profit"],
                            2
                        ),

                    "quantity":
                        values["quantity"],

                    "orders":
                        len(values["orders"])
                }
            )

        data.sort(
            key=lambda item:
                item["revenue"],
            reverse=True
        )

        return jsonify(
            {
                "success": True,
                "data": data
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API: BUSINESS INSIGHTS
# ============================================================

@app.route(
    "/api/insights",
    methods=["GET"]
)
def insights_api():

    try:

        filters = get_filters()

        rows = filtered_query(
            filters
        ).all()

        if not rows:

            return jsonify(
                {
                    "success": True,
                    "insights": []
                }
            )

        category_data = {}
        region_data = {}
        product_data = {}
        monthly_data = {}

        for row in rows:

            category = row.category

            if category not in category_data:

                category_data[category] = {
                    "revenue": 0,
                    "profit": 0
                }

            category_data[
                category
            ]["revenue"] += row.revenue

            category_data[
                category
            ]["profit"] += row.profit


            region = row.region

            if region not in region_data:

                region_data[region] = {
                    "revenue": 0,
                    "profit": 0
                }

            region_data[
                region
            ]["revenue"] += row.revenue

            region_data[
                region
            ]["profit"] += row.profit


            product = row.product

            if product not in product_data:

                product_data[product] = {
                    "revenue": 0,
                    "profit": 0
                }

            product_data[
                product
            ]["revenue"] += row.revenue

            product_data[
                product
            ]["profit"] += row.profit


            month = row.order_date.strftime(
                "%Y-%m"
            )

            monthly_data[month] = (
                monthly_data.get(
                    month,
                    0
                )
                + row.revenue
            )

        insights = []


        # ----------------------------------------------------
        # STRONGEST CATEGORY
        # ----------------------------------------------------

        strongest_category = max(
            category_data,
            key=lambda category:
                category_data[
                    category
                ]["revenue"]
        )

        strongest_category_revenue = (
            category_data[
                strongest_category
            ]["revenue"]
        )

        insights.append(
            {
                "type": "Strongest Category",
                "icon": "↑",

                "title":
                    strongest_category,

                "description":
                    (
                        f"{strongest_category} generated "
                        f"{format_currency_text(strongest_category_revenue)} "
                        "in revenue and is currently the "
                        "strongest category."
                    )
            }
        )


        # ----------------------------------------------------
        # WEAKEST CATEGORY
        # ----------------------------------------------------

        weakest_category = min(
            category_data,
            key=lambda category:
                category_data[
                    category
                ]["revenue"]
        )

        weakest_category_revenue = (
            category_data[
                weakest_category
            ]["revenue"]
        )

        insights.append(
            {
                "type": "Weakest Category",
                "icon": "↓",

                "title":
                    weakest_category,

                "description":
                    (
                        f"{weakest_category} generated "
                        f"{format_currency_text(weakest_category_revenue)} "
                        "in revenue and may require additional "
                        "commercial attention."
                    )
            }
        )


        # ----------------------------------------------------
        # BEST REGION
        # ----------------------------------------------------

        best_region = max(
            region_data,
            key=lambda region:
                region_data[
                    region
                ]["profit"]
        )

        best_region_profit = (
            region_data[
                best_region
            ]["profit"]
        )

        insights.append(
            {
                "type": "Best Region",
                "icon": "◆",

                "title":
                    best_region,

                "description":
                    (
                        f"{best_region} generated "
                        f"{format_currency_text(best_region_profit)} "
                        "in profit, making it the strongest "
                        "regional market."
                    )
            }
        )


        # ----------------------------------------------------
        # HIGHEST PROFIT PRODUCT
        # ----------------------------------------------------

        best_product = max(
            product_data,
            key=lambda product:
                product_data[
                    product
                ]["profit"]
        )

        best_product_profit = (
            product_data[
                best_product
            ]["profit"]
        )

        insights.append(
            {
                "type": "Highest-Profit Product",
                "icon": "★",

                "title":
                    best_product,

                "description":
                    (
                        f"{best_product} generated "
                        f"{format_currency_text(best_product_profit)} "
                        "in profit and is the most profitable "
                        "product in the selected dataset."
                    )
            }
        )


        # ----------------------------------------------------
        # LARGEST MONTHLY GROWTH
        # ----------------------------------------------------

        ordered_months = sorted(
            monthly_data.keys()
        )

        largest_growth = None
        largest_growth_value = -np.inf

        for index in range(
            1,
            len(ordered_months)
        ):

            previous_month = (
                monthly_data[
                    ordered_months[index - 1]
                ]
            )

            current_month = (
                monthly_data[
                    ordered_months[index]
                ]
            )

            if previous_month == 0:
                continue

            growth = (
                (
                    current_month
                    - previous_month
                )
                / previous_month
                * 100
            )

            if growth > largest_growth_value:

                largest_growth_value = growth

                largest_growth = (
                    ordered_months[index]
                )

        if largest_growth:

            insights.append(
                {
                    "type": "Largest Monthly Growth",
                    "icon": "↗",

                    "title":
                        largest_growth,

                    "description":
                        (
                            f"Revenue increased by "
                            f"{largest_growth_value:.2f}% "
                            "compared with the previous month."
                        )
                }
            )


        # ----------------------------------------------------
        # HIGH SALES / LOW MARGIN
        # ----------------------------------------------------

        total_revenue = sum(
            item["revenue"]
            for item in category_data.values()
        )

        high_sales_low_margin = []

        for category, values in category_data.items():

            revenue = values["revenue"]
            profit = values["profit"]

            margin = (
                profit / revenue * 100
                if revenue
                else 0
            )

            if (
                revenue >= total_revenue * 0.15
                and margin < 15
            ):

                high_sales_low_margin.append(
                    (
                        category,
                        revenue,
                        margin
                    )
                )

        for (
            category,
            revenue,
            margin
        ) in high_sales_low_margin:

            insights.append(
                {
                    "type":
                        "Margin Opportunity",

                    "icon":
                        "!",

                    "title":
                        category,

                    "description":
                        (
                            f"{category} generates "
                            f"{format_currency_text(revenue)} "
                            f"in revenue but has only a "
                            f"{margin:.2f}% profit margin. "
                            "Pricing, sourcing or discount "
                            "strategy should be reviewed."
                        )
                }
            )

        return jsonify(
            {
                "success": True,
                "insights": insights
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


def format_currency_text(value):
    """
    Currency formatter used inside insight messages.
    """

    value = float(value)

    if value >= 10_000_000:
        return f"₹{value / 10_000_000:.2f} Cr"

    if value >= 100_000:
        return f"₹{value / 100_000:.2f} L"

    if value >= 1_000:
        return f"₹{value / 1_000:.2f} K"

    return f"₹{value:,.0f}"


# ============================================================
# API: FORECAST
# ============================================================

@app.route(
    "/api/forecast",
    methods=["GET"]
)
def forecast_api():

    try:

        filters = get_filters()

        periods = request.args.get(
            "periods",
            "6"
        )

        try:

            periods = int(periods)

            if periods < 1 or periods > 24:

                raise ValueError

        except ValueError:

            return jsonify(
                {
                    "success": False,
                    "error":
                        "Forecast periods must be between 1 and 24."
                }
            ), 400

        rows = filtered_query(
            filters
        ).all()

        monthly = {}

        for row in rows:

            period = row.order_date.strftime(
                "%Y-%m"
            )

            monthly[period] = (
                monthly.get(
                    period,
                    0
                )
                + row.revenue
            )

        if len(monthly) < 3:

            return jsonify(
                {
                    "success": True,

                    "historical": [],

                    "forecast": [],

                    "model":
                        "Linear Regression",

                    "confidence":
                        "Insufficient data",

                    "description":
                        (
                            "At least three historical "
                            "periods are required for forecasting."
                        )
                }
            )

        ordered_periods = sorted(
            monthly.keys()
        )

        historical_values = np.array(
            [
                monthly[period]
                for period in ordered_periods
            ],
            dtype=float
        )

        X = np.arange(
            len(historical_values)
        ).reshape(-1, 1)

        y = historical_values

        model = LinearRegression()

        model.fit(
            X,
            y
        )

        future_X = np.arange(
            len(y),
            len(y) + periods
        ).reshape(-1, 1)

        predictions = model.predict(
            future_X
        )

        predictions = np.maximum(
            predictions,
            0
        )

        # Calculate a simple uncertainty estimate
        # using historical residual standard deviation.
        fitted_values = model.predict(X)

        residuals = (
            y - fitted_values
        )

        residual_std = (
            np.std(residuals)
            if len(residuals) > 1
            else 0
        )

        confidence_level = 95

        historical = []

        for period in ordered_periods:

            historical.append(
                {
                    "period": period,
                    "revenue":
                        round(
                            monthly[period],
                            2
                        )
                }
            )

        last_date = pd.Period(
            ordered_periods[-1],
            freq="M"
        )

        forecast = []

        for index, prediction in enumerate(
            predictions,
            start=1
        ):

            future_period = (
                last_date + index
            )

            forecast.append(
                {
                    "period":
                        str(future_period),

                    "forecast":
                        round(
                            float(prediction),
                            2
                        ),

                    "lower_bound":
                        round(
                            max(
                                0,
                                float(prediction)
                                - 1.96
                                * residual_std
                            ),
                            2
                        ),

                    "upper_bound":
                        round(
                            float(prediction)
                            + 1.96
                            * residual_std,
                            2
                        )
                }
            )

        return jsonify(
            {
                "success": True,

                "historical":
                    historical,

                "forecast":
                    forecast,

                "model":
                    "Linear Regression",

                "confidence":
                    confidence_level,

                "uncertainty":
                    round(
                        float(residual_std),
                        2
                    ),

                "description":
                    (
                        "Revenue forecast generated using "
                        "a lightweight Linear Regression model "
                        "trained on historical monthly revenue. "
                        "The uncertainty estimate is based on "
                        "historical model residuals."
                    )
            }
        )

    except ValueError as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 400

    except Exception as error:

        return jsonify(
            {
                "success": False,
                "error": str(error)
            }
        ), 500


# ============================================================
# API HEALTH CHECK
# ============================================================

@app.route(
    "/api/health",
    methods=["GET"]
)
def health_api():

    try:

        record_count = Sales.query.count()

        return jsonify(
            {
                "success": True,

                "status": "healthy",

                "database":
                    "connected",

                "records":
                    record_count,

                "timestamp":
                    datetime.utcnow().isoformat()
            }
        )

    except Exception as error:

        return jsonify(
            {
                "success": False,

                "status": "unhealthy",

                "error":
                    str(error)
            }
        ), 500


# ============================================================
# GLOBAL ERROR HANDLER
# ============================================================

@app.errorhandler(404)
def not_found(error):

    return jsonify(
        {
            "success": False,
            "error": "Endpoint not found."
        }
    ), 404


@app.errorhandler(500)
def internal_error(error):

    return jsonify(
        {
            "success": False,
            "error": "Internal server error."
        }
    ), 500


# ============================================================
# START APPLICATION
# ============================================================

if __name__ == "__main__":

    print()
    print("=" * 60)
    print(" BUSINESS INTELLIGENCE COMMAND CENTRE")
    print("=" * 60)

    print()
    print("Preparing dataset...")

    create_dataset()

    print(
        f"Dataset: {CSV_FILE}"
    )

    print()
    print("Initialising SQLite database...")

    initialise_database()

    print(
        f"Database: {DATABASE_FILE}"
    )

    print()
    print("API endpoints:")
    print("  GET /api/health")
    print("  GET /api/filters")
    print("  GET /api/overview")
    print("  GET /api/sales-trend")
    print("  GET /api/category-performance")
    print("  GET /api/product-performance")
    print("  GET /api/region-performance")
    print("  GET /api/insights")
    print("  GET /api/forecast")

    print()
    print("Dashboard:")
    print("  http://127.0.0.1:5000")

    print()
    print("=" * 60)
    print()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )

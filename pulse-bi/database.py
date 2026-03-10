import pandas as pd
from sqlalchemy import create_engine, text
import os, re

engine = create_engine(
    "sqlite:///./insight_data.db",
    connect_args={"check_same_thread": False},
)

current_columns: list[str] = []
current_schema: str = ""
current_filename: str = ""
current_row_count: int = 0


def load_csv_to_db(path: str) -> list[str]:
    if not os.path.exists(path):
        print(f"[database] Not found: {path}")
        return []
    try:
        df = pd.read_csv(path)
        return load_dataframe_to_db(df, filename=os.path.basename(path))
    except Exception as e:
        print(f"[database] Failed to read '{path}': {e}")
        return []


def load_dataframe_to_db(df: pd.DataFrame, filename: str = "data.csv") -> list[str]:
    global current_columns, current_schema, current_filename, current_row_count

    try:
        if df.empty:
            return []

        df.columns = [_sanitize(c) for c in df.columns]
        df = df.loc[:, ~df.columns.duplicated()]

        # Parse date columns
        for col in df.columns:
            if re.search(r'date|time|month|year|day', col.lower()):
                parsed = pd.to_datetime(df[col], errors="coerce")
                if parsed.notna().sum() > len(df) * 0.5:
                    df[col] = parsed.dt.strftime("%Y-%m-%d")

        # Coerce numerics (handles "1,234" style values)
        for col in df.columns:
            if df[col].dtype == object:
                coerced = pd.to_numeric(
                    df[col].astype(str).str.replace(",", "", regex=False),
                    errors="coerce"
                )
                if coerced.notna().sum() > len(df) * 0.7:
                    df[col] = coerced

        df.to_sql("data_table", engine, if_exists="replace", index=False)

        current_columns   = df.columns.tolist()
        current_schema    = _build_schema(df)
        current_filename  = filename
        current_row_count = len(df)

        print(f"[database] ✓ '{filename}' — {len(df):,} rows × {len(df.columns)} cols")
        return current_columns

    except Exception as e:
        print(f"[database] ✗ {e}")
        return []


def get_row_count() -> int:
    try:
        with engine.connect() as conn:
            return conn.execute(text("SELECT COUNT(*) FROM data_table")).scalar() or 0
    except Exception:
        return 0


def _sanitize(name: str) -> str:
    return (
        name.strip()
        .replace(" ", "_").replace(".", "").replace("-", "_")
        .replace("/", "_").replace("(", "").replace(")", "")
        .replace("%", "pct").replace("#", "num").replace("&", "and")
    )


def _build_schema(df: pd.DataFrame) -> str:
    lines = [
        f"Table: data_table",
        f"Rows: {len(df):,}  |  Columns: {len(df.columns)}",
        "",
        "Columns:",
    ]
    for col in df.columns:
        nulls = int(df[col].isna().sum())
        npct  = round(nulls / len(df) * 100, 1) if len(df) else 0
        if pd.api.types.is_numeric_dtype(df[col]):
            mn   = round(float(df[col].min()), 2)
            mx   = round(float(df[col].max()), 2)
            mean = round(float(df[col].mean()), 2)
            lines.append(f"  {col} [NUMERIC]  min={mn}  max={mx}  mean={mean}  nulls={nulls}({npct}%)")
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            mn = str(df[col].min())[:10]
            mx = str(df[col].max())[:10]
            lines.append(f"  {col} [DATE]  {mn} → {mx}  nulls={nulls}({npct}%)")
        else:
            uniq  = df[col].dropna().unique()
            total = len(uniq)
            samp  = ", ".join(str(v) for v in uniq[:8])
            more  = f" ... +{total-8} more" if total > 8 else ""
            lines.append(f"  {col} [TEXT]  {total} unique: {samp}{more}  nulls={nulls}({npct}%)")
    return "\n".join(lines)

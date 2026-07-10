import os
import threading
import snowflake.connector
from snowflake.connector import DictCursor

def _build_conn():
    url = os.getenv("DATABASE_URL", "")
    if url.startswith("snowflake://"):
        from urllib.parse import urlparse, parse_qs
        p = urlparse(url)
        user     = p.username
        password = p.password
        account  = p.hostname          # e.g. oddlcce-ud41137
        parts    = [x for x in p.path.split("/") if x]
        database = parts[0] if len(parts) > 0 else "TRANSLATOR_DB"
        schema   = parts[1] if len(parts) > 1 else "PUBLIC"
        qs       = parse_qs(p.query)
        warehouse = qs.get("warehouse", ["COMPUTE_WH"])[0]
    else:
        user      = os.getenv("SNOWFLAKE_USER",      "swastik3616")
        password  = os.getenv("SNOWFLAKE_PASSWORD",  "Swastik@1234567890")
        account   = os.getenv("SNOWFLAKE_ACCOUNT",   "ODDLCCE-UD41137")
        warehouse = os.getenv("SNOWFLAKE_WAREHOUSE",  "COMPUTE_WH")
        database  = os.getenv("SNOWFLAKE_DATABASE",   "TRANSLATOR_DB")
        schema    = os.getenv("SNOWFLAKE_SCHEMA",     "PUBLIC")

    return snowflake.connector.connect(
        user=user,
        password=password,
        account=account,
        warehouse=warehouse,
        database=database,
        schema=schema,
    )


# ── Thread-local connection pool (one connection per thread) ──────────────────
_local = threading.local()

def get_conn():
    """Return a live Snowflake connection for the current thread."""
    conn = getattr(_local, "conn", None)
    if conn is None or conn.is_closed():
        _local.conn = _build_conn()
    return _local.conn

def execute(sql, params=None, fetch=None):
    """
    Run *sql* against Snowflake.
    fetch='all'  → list[dict]
    fetch='one'  → dict | None
    fetch=None   → None  (DML)
    """
    conn = get_conn()
    cur  = conn.cursor(DictCursor)
    try:
        cur.execute(sql, params or ())
        if fetch == "all":
            return cur.fetchall()
        if fetch == "one":
            return cur.fetchone()
        return None
    finally:
        cur.close()


# ── Minimal db façade so existing imports `from database import db` still work ─

class _Session:
    """Mimics db.session for add / delete / commit / rollback."""

    def __init__(self):
        self._pending = []   # list of model instances queued for INSERT/UPDATE/DELETE

    def add(self, obj):
        self._pending.append(("upsert", obj))

    def delete(self, obj):
        self._pending.append(("delete", obj))

    def commit(self):
        for op, obj in self._pending:
            if op == "upsert":
                obj._save()
            elif op == "delete":
                obj._delete()
        self._pending.clear()

    def rollback(self):
        self._pending.clear()

    def execute(self, stmt, params=None):
        """Allow db.session.execute(text(...)) calls from migrate_db.py."""
        sql = str(stmt)
        execute(sql, params)


class _DB:
    """Minimal stand-in for Flask-SQLAlchemy's `db` object."""

    def __init__(self):
        self.session = _Session()

    def init_app(self, app):
        pass   # no-op; connection is lazy per-thread

    def create_all(self):
        """Create tables in Snowflake if they don't exist yet."""
        ddl_statements = [
            """
            CREATE TABLE IF NOT EXISTS TRANSLATIONS (
                ID          NUMBER AUTOINCREMENT PRIMARY KEY,
                SOURCE_TEXT TEXT          NOT NULL,
                TARGET_LANGUAGE VARCHAR(100)  NOT NULL,
                TRANSLATED_TEXT TEXT      NOT NULL,
                CREATED_AT  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS PAGE_CONTENTS (
                ID          NUMBER AUTOINCREMENT PRIMARY KEY,
                PAGE        VARCHAR(255) NOT NULL,
                KEY         VARCHAR(255) NOT NULL,
                SOURCE_TEXT TEXT         NOT NULL,
                HTML_TAG    VARCHAR(50),
                SECTION_ID  VARCHAR(255),
                RESOURCE_ID NUMBER,
                UNIQUE (PAGE, KEY)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS AUDIT_LOGS (
                ID         NUMBER AUTOINCREMENT PRIMARY KEY,
                ACTION     VARCHAR(255) NOT NULL,
                CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS SHOPIFY_STORES (
                ID           NUMBER AUTOINCREMENT PRIMARY KEY,
                SHOP         VARCHAR(255) NOT NULL UNIQUE,
                ACCESS_TOKEN TEXT         NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS APP_SETTINGS (
                ID    NUMBER AUTOINCREMENT PRIMARY KEY,
                KEY   VARCHAR(255) NOT NULL UNIQUE,
                VALUE TEXT         NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS OVERLAY_EDITS (
                ID             NUMBER AUTOINCREMENT PRIMARY KEY,
                URL            VARCHAR(500)  NOT NULL,
                ORIGINAL_TEXT  TEXT          NOT NULL,
                NEW_TEXT       TEXT          NOT NULL,
                IS_TRANSLATION BOOLEAN       DEFAULT FALSE,
                TARGET_LANGUAGE VARCHAR(100),
                SELECTOR       VARCHAR(1000),
                ELEMENT_TAG    VARCHAR(50),
                FIELD_NAME     VARCHAR(100)
            )
            """,
        ]
        for ddl in ddl_statements:
            try:
                execute(ddl.strip())
            except Exception as e:
                print(f"[db.create_all] skipped: {e}")


db = _DB()
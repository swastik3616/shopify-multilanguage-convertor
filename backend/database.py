import os
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool

db_url = os.getenv("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

pg_pool = None
if db_url:
    try:
        pg_pool = psycopg2.pool.SimpleConnectionPool(1, 20, db_url)
    except Exception as e:
        print(f"Error creating connection pool: {e}")

def _uppercase_dict(d):
    if d is None:
        return None
    return {k.upper(): v for k, v in d.items()}

def execute(query, params=None, fetch=None):
    if not pg_pool:
        raise Exception("Database pool not initialized")
    
    conn = pg_pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            if fetch == "one":
                result = cur.fetchone()
                conn.commit()
                return _uppercase_dict(result) if result else None
            elif fetch == "all":
                result = cur.fetchall()
                conn.commit()
                return [_uppercase_dict(r) for r in result] if result else []
            else:
                conn.commit()
                return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        pg_pool.putconn(conn)
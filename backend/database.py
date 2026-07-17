import os
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

db_url = os.getenv("DATABASE_URL")

if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

pg_pool = None

if db_url:
    try:
        pg_pool = psycopg2.pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=20,
            dsn=db_url
        )
        print(" PostgreSQL connection pool initialized.")
    except Exception as e:
        print(f" Error creating PostgreSQL connection pool: {e}")


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
            try:
                print("\n" + "=" * 80)
                print("SQL QUERY:")
                print(cur.mogrify(query, params).decode("utf-8"))
                print("=" * 80 + "\n")
            except Exception as debug_error:
                print(f"Could not mogrify query: {debug_error}")

            # Execute
            cur.execute(query, params)

            if fetch == "one":
                result = cur.fetchone()
                conn.commit()
                return _uppercase_dict(result) if result else None

            elif fetch == "all":
                result = cur.fetchall()
                conn.commit()
                return [_uppercase_dict(row) for row in result]

            else:
                conn.commit()
                return None

    except Exception as e:
        conn.rollback()

        print("\n" + "=" * 80)
        print("DATABASE ERROR")
        print("=" * 80)
        print("Query:")
        print(query)
        print("\nParameters:")
        print(repr(params))
        print("\nException:")
        print(e)
        print("=" * 80 + "\n")

        raise

    finally:
        pg_pool.putconn(conn)
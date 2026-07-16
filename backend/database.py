import os
import pymysql
from pymysql.cursors import DictCursor
from dbutils.pooled_db import PooledDB

pool = PooledDB(
    creator=pymysql,
    maxconnections=20,
    mincached=1,
    maxcached=10,
    blocking=True,
    host=os.getenv("MYSQL_HOST"),
    port=int(os.getenv("MYSQL_PORT", 3306)),
    user=os.getenv("MYSQL_USER"),
    password=os.getenv("MYSQL_PASSWORD"),
    database=os.getenv("MYSQL_DATABASE"),
    charset="utf8mb4",
    cursorclass=DictCursor,
    autocommit=False
)

def execute(query, params=None, fetch=None):
    conn = pool.connection()

    try:
        with conn.cursor() as cur:
            cur.execute(query, params)

            if fetch == "one":
                result = cur.fetchone()
                conn.commit()
                return result

            elif fetch == "all":
                result = cur.fetchall()
                conn.commit()
                return result

            conn.commit()
            return None

    except Exception:
        conn.rollback()
        raise

    finally:
        conn.close()
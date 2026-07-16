import pandas as pd
from sqlalchemy import create_engine

engine = create_engine(
    "mysql+pymysql://root:root@localhost:3306/translator_db"
)

df = pd.read_csv(
    r"D:\shopify-multilingual-translator\backend\csv_backup\translations.csv"
)

df = df.fillna("")

df.to_sql(
    "translations",
    engine,
    if_exists="append",
    index=False
)

print("Translations imported successfully!")
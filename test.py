import os
import pandas as pd
import snowflake.connector
from snowflake.connector.pandas_tools import write_pandas


# Snowflake connection
conn = snowflake.connector.connect(
    user="swastik3616",
    password="Swastik@1234567890",
    account="ODDLCCE-UD41137",
    warehouse="COMPUTE_WH",
    database="TRANSLATOR_DB",
    schema="PUBLIC"
)

folder = r"D:/shopify-multilingual-translator/postgres_export"

for file in os.listdir(folder):

    if file.endswith(".csv"):

        file_path = os.path.join(folder, file)

        # Convert filename into table name
        table_name = file.replace(".csv", "").upper()

        print(f"Reading {file}...")

        # Read CSV
        df = pd.read_csv(file_path)

        # Upload dataframe to Snowflake
        success, nchunks, nrows, output = write_pandas(
            conn,
            df,
            table_name,
            auto_create_table=True
        )

        if success:
            print(f"✅ {file} uploaded")
            print(f"Rows loaded: {nrows}")

        else:
            print(f"❌ Failed: {file}")


conn.close()

print("All files uploaded successfully!")
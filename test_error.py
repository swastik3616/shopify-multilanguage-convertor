import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from app import app
from database import init_pool
import dotenv

dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), 'backend', '.env'))
init_pool()

client = app.test_client()
response = client.post('/save-languages', json={"languages": [{"id": 1, "status": "Source"}]})
print("STATUS:", response.status_code)
print("DATA:", response.data.decode('utf-8'))

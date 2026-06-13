import os

req_path = "requirements.txt"

# Dependencies
deps = "Flask\nFlask-Cors\nFlask-SQLAlchemy\nrequests\npython-dotenv\n"

# Remove the file completely to destroy the UTF-16 BOM
if os.path.exists(req_path):
    os.remove(req_path)

# Recreate it strictly as UTF-8
with open(req_path, "w", encoding="utf-8") as f:
    f.write(deps)

print("requirements.txt has been successfully recreated in UTF-8 format without BOM.")

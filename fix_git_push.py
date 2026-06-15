import subprocess

def run_cmd(cmd):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    print("-" * 40)

print("Fixing Git Push Protection Issue...")

# 1. Undo all local unpushed commits but keep the files
run_cmd(["git", "reset", "--soft", "origin/main"])

# 2. Force Git to stop tracking the database file
run_cmd(["git", "rm", "-f", "--cached", "backend/instance/translator.db"])

# 3. Add all files back (the .gitignore will now block the DB)
run_cmd(["git", "add", "."])

# 4. Create a fresh clean commit
run_cmd(["git", "commit", "-m", "Fix: Update frontend API and Postgres config"])

# 5. Push to GitHub
run_cmd(["git", "push", "origin", "main"])

print("Done! If you see any errors above, please copy and paste them for me.")

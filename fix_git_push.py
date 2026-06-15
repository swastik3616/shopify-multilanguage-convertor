import subprocess

def run_cmd(cmd):
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    print("-" * 40)

print("Running Bulletproof Git Fix...")

# 1. Reset everything to exactly match GitHub (but keep file changes)
run_cmd(["git", "reset", "--mixed", "origin/main"])

# 2. Add all files (the .gitignore will automatically drop the .db file)
run_cmd(["git", "add", "."])

# 3. Create a fresh clean commit
run_cmd(["git", "commit", "-m", "Fix: Update frontend API and Postgres config"])

# 4. Push to GitHub
run_cmd(["git", "push", "origin", "main"])

print("Done! Please check the output above. If it says 'remote rejected', paste the error here.")

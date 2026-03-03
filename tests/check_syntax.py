import ast
import sys

def check_file(filepath):
    try:
        with open(filepath, 'r') as f:
            source = f.read()
        ast.parse(source)
        print(f"OK: {filepath}")
        return True
    except SyntaxError as e:
        print(f"Syntax Error in {filepath}: {e}")
        print(f"  Line {e.lineno}: {e.text}")
        return False

files = [
    'tests/unit/backend/test_config_api.py',
    'tests/unit/backend/test_model_gateway.py',
    'tests/unit/backend/test_retrieval_service.py',
]

all_ok = True
for f in files:
    if not check_file(f):
        all_ok = False

sys.exit(0 if all_ok else 1)

import ast

with open('tests/unit/backend/test_config_api.py', 'r') as f:
    lines = f.readlines()

# Try parsing up to line 134, 135, etc.
for end_line in [130, 131, 132, 133, 134, 135, 136]:
    source = ''.join(lines[:end_line])
    try:
        ast.parse(source)
        print(f'Lines 1-{end_line}: OK')
    except SyntaxError as e:
        print(f'Lines 1-{end_line}: ERROR at line {e.lineno}: {e.msg}')

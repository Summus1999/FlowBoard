import ast

with open('tests/unit/backend/test_config_api.py', 'r') as f:
    source = f.read()

try:
    ast.parse(source)
    print('Parse successful!')
except SyntaxError as e:
    print(f'Line {e.lineno}, col {e.offset}: {e.msg}')
    lines = source.split('\n')
    line = lines[e.lineno-1]
    print(f'Line: {repr(line)}')
    print('Error at:', line[max(0,e.offset-5):e.offset+5])

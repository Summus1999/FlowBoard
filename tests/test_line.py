line = '        """CFG-005: localhost             """'
print('Testing line:', repr(line))
try:
    compile(line, '<test>', 'exec')
    print('Line compiles OK!')
except SyntaxError as e:
    print(f'Error: {e}')

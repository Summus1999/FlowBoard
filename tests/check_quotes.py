with open('tests/unit/backend/test_config_api.py', 'r') as f:
    lines = f.readlines()

# Check all lines before 135 for potential string issues
for i in range(134):
    line = lines[i]
    # Count quotes
    single = line.count("'")
    double = line.count('"')
    triple_single = line.count("'''")
    triple_double = line.count('"""')
    
    # Skip comment lines
    stripped = line.lstrip()
    if stripped.startswith('#'):
        continue
        
    if single % 2 == 1 and triple_single == 0:
        print(f'Line {i+1} odd single quotes ({single}): {repr(line[:80])}')
    if double % 2 == 1 and triple_double == 0:
        print(f'Line {i+1} odd double quotes ({double}): {repr(line[:80])}')

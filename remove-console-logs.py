#!/usr/bin/env python3
"""
Script to remove all console.log statements from TypeScript/TSX files.
Handles multi-line console.log statements properly.
Only removes console.log (not console.error, console.warn, or console.info).
"""

import os
import re
from pathlib import Path

def remove_console_logs(content):
    """Remove all console.log statements from the content."""
    lines = content.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if this line contains a console.log (not commented out)
        # Match console.log that is NOT preceded by //
        stripped = line.lstrip()
        
        # Skip if it's a commented console.log
        if stripped.startswith('//') and 'console.log' in stripped:
            # Check if there's code after the comment that needs to be kept
            comment_match = re.match(r'^(\s*)//.*console\.log.*$', line)
            if comment_match:
                # Only comment, no code after - skip this line
                # But check if next lines have orphaned object properties
                i += 1
                # Skip orphaned object properties from broken console.log removal
                while i < len(lines):
                    next_line = lines[i].strip()
                    # Check for orphaned object properties (key: value, pattern)
                    if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*\s*:', next_line) or \
                       re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*:\s*[^=]', next_line) or \
                       next_line.startswith('}') or \
                       next_line.startswith('),') or \
                       next_line.startswith(');'):
                        i += 1
                    else:
                        break
                continue
        
        # Check for active (non-commented) console.log
        # Pattern: line has console.log but not inside a comment
        if 'console.log' in line and not stripped.startswith('//'):
            # Check if console.log is actually in a comment on this line
            # by finding the position of // and console.log
            comment_pos = line.find('//')
            log_pos = line.find('console.log')
            
            if comment_pos != -1 and comment_pos < log_pos:
                # console.log is in a comment, skip
                i += 1
                continue
            
            # This is an active console.log - need to remove it
            # Find the start of console.log
            log_start = line.find('console.log')
            if log_start == -1:
                i += 1
                continue
            
            # Get the indentation before console.log
            indent = line[:log_start]
            
            # Check if it's a simple one-liner
            if 'console.log(' in line and line.rstrip().endswith(');'):
                # Simple one-liner, remove entire statement
                # But keep the line if there's code before console.log
                before_log = line[:log_start].rstrip()
                after_log = line[line.find(');') + 2:].strip()
                if before_log or after_log:
                    result_lines.append(before_log + (' ' + after_log if after_log else ''))
                i += 1
                continue
            
            # Multi-line console.log - find where it ends
            # Count parentheses to find the end
            paren_count = 0
            in_string = False
            string_char = None
            end_line = i
            
            # Start counting from console.log
            search_start = log_start
            for j in range(i, len(lines)):
                curr_line = lines[j]
                if j == i:
                    curr_line = curr_line[log_start:]  # Start from console.log
                
                for k, char in enumerate(curr_line):
                    if char in '"\'`' and (k == 0 or curr_line[k-1] != '\\'):
                        if not in_string:
                            in_string = True
                            string_char = char
                        elif char == string_char:
                            in_string = False
                            string_char = None
                    elif not in_string:
                        if char == '(':
                            paren_count += 1
                        elif char == ')':
                            paren_count -= 1
                            if paren_count == 0:
                                end_line = j
                                # Check what's after the closing paren
                                rest_of_line = curr_line[k+1:].strip()
                                break
                
                if paren_count == 0 and end_line == j:
                    break
            
            # Now we know the console.log spans from line i to end_line
            # Check if there's code before console.log on line i
            before_log = line[:log_start].rstrip()
            
            # Check if there's code after the console.log on end_line
            if end_line == i:
                # Same line - check what's after
                match = re.search(r'console\.log\([^)]*\)\s*(;|\),?)?', line[log_start:])
                if match:
                    after_log = line[log_start + match.end():].strip()
                    if before_log or after_log:
                        result_lines.append(before_log + (' ' + after_log if after_log else ''))
            else:
                # Multi-line - check what's after on end_line
                end_line_content = lines[end_line]
                # Find the closing )
                match = re.search(r'\)\s*(;|\),?)?', end_line_content)
                if match:
                    after_log = end_line_content[match.end():].strip()
                    if before_log:
                        result_lines.append(before_log)
                    if after_log:
                        # This shouldn't happen often, but handle it
                        result_lines.append(indent + after_log)
            
            i = end_line + 1
            continue
        
        # Regular line - keep it
        result_lines.append(line)
        i += 1
    
    return '\n'.join(result_lines)


def process_file(filepath):
    """Process a single file and remove console.log statements."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = remove_console_logs(content)
        
        if content != new_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return True
        return False
    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False


def main():
    apps = [
        r'C:\Users\Administrator\restaurant-app\deliverapp',
        r'C:\Users\Administrator\restaurant-app\admins-app',
        r'C:\Users\Administrator\restaurant-app\userapp'
    ]
    
    total_files = 0
    modified_files = 0
    
    for app_dir in apps:
        print(f"\nProcessing {app_dir}...")
        app_modified = 0
        
        for root, dirs, files in os.walk(app_dir):
            # Skip node_modules, build, dist folders
            dirs[:] = [d for d in dirs if d not in ['node_modules', 'build', 'dist', '.expo', '.git']]
            
            for file in files:
                if file.endswith(('.ts', '.tsx')):
                    filepath = os.path.join(root, file)
                    total_files += 1
                    if process_file(filepath):
                        modified_files += 1
                        app_modified += 1
        
        print(f"  Modified {app_modified} files in {os.path.basename(app_dir)}")
    
    print(f"\n{'='*60}")
    print(f"Total files scanned: {total_files}")
    print(f"Total files modified: {modified_files}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

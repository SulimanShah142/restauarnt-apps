#!/usr/bin/env python3
"""
Script to fix broken console.log removals in TypeScript/TSX files.
Looks for patterns where console.log was commented but the object was left behind.
"""

import os
import re
from pathlib import Path

def fix_broken_console_logs(content):
    """Fix broken console.log statements where object was left behind."""
    lines = content.split('\n')
    result_lines = []
    i = 0
    modified = False
    
    while i < len(lines):
        line = lines[i]
        stripped = line.lstrip()
        
        # Pattern 1: Commented console.log followed by object properties on next lines
        # Example:
        #  // console.log('message:', {
        #   key: value,
        # });
        if stripped.startswith('//') and 'console.log' in stripped and stripped.rstrip().endswith('{'):
            # Find the closing });
            brace_count = 1
            j = i + 1
            while j < len(lines) and brace_count > 0:
                next_line = lines[j]
                brace_count += next_line.count('{') - next_line.count('}')
                if brace_count > 0:
                    j += 1
                else:
                    break
            
            if brace_count == 0 and j < len(lines):
                # Check if this line ends with });
                if lines[j].strip().endswith('});'):
                    # Remove the commented console.log and the object
                    i = j + 1
                    modified = True
                    continue
        
        # Pattern 2: Commented console.log with object on same line
        # Example: // console.log('message:', {
        #   key: value,
        # });
        if stripped.startswith('//') and 'console.log' in stripped:
            # Check if there's an opening brace but no closing
            if '{' in stripped and not stripped.rstrip().endswith('});'):
                # Find the closing });
                brace_count = stripped.count('{') - stripped.count('}')
                if brace_count > 0:
                    j = i + 1
                    while j < len(lines) and brace_count > 0:
                        next_line = lines[j]
                        brace_count += next_line.count('{') - next_line.count('}')
                        j += 1
                    
                    if brace_count == 0 and j < len(lines):
                        if lines[j-1].strip().endswith('});'):
                            # Remove the commented console.log and the object
                            i = j
                            modified = True
                            continue
        
        result_lines.append(line)
        i += 1
    
    return '\n'.join(result_lines), modified


def process_file(filepath):
    """Process a single file and fix broken console.log statements."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content, modified = fix_broken_console_logs(content)
        
        if modified:
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
        
        print(f"  Fixed {app_modified} files in {os.path.basename(app_dir)}")
    
    print(f"\n{'='*60}")
    print(f"Total files scanned: {total_files}")
    print(f"Total files fixed: {modified_files}")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()

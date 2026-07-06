import os

def merge_code(output_file="merged_code.txt"):
    # Directories to completely ignore
    ignore_dirs = {
        'node_modules', 
        '.next', 
        '.git', 
        'dist', 
        'build', 
        'coverage',
        '.vscode',
        'public', # Ignoring static assets like images
    }
    
    # File extensions to ignore (binary files, images, fonts, locks)
    ignore_exts = {
        '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.mp4', '.webm',
        '.woff', '.woff2', '.ttf', '.eot',
        '.pdf', '.zip', '.tar', '.gz',
        '.pyc', '.pyo', '.pyd', '.so', '.dll', '.class',
        '.lock' # Ignore lock files like yarn.lock or package-lock.json (they are huge and usually not needed)
    }
    
    files_merged = 0
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk('.'):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in ignore_exts:
                    continue
                    
                # Also ignore specific large files directly
                if file in ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml']:
                    continue
                    
                file_path = os.path.join(root, file)
                
                # Skip the output file itself
                if os.path.basename(file_path) == output_file:
                    continue
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as infile:
                        content = infile.read()
                        
                        # Write separator and file path
                        outfile.write(f"{'='*80}\n")
                        outfile.write(f"File: {os.path.normpath(file_path)}\n")
                        outfile.write(f"{'='*80}\n\n")
                        
                        # Write file content
                        outfile.write(content)
                        outfile.write("\n\n")
                        
                        files_merged += 1
                        print(f"Merged: {file_path}")
                        
                except Exception as e:
                    print(f"Skipping {file_path} (could not read as text): {e}")
                    
    print(f"\nSuccessfully merged {files_merged} files into {output_file}")

if __name__ == "__main__":
    merge_code()

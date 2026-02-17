import os
import sys

def load_env_file(filepath):
    """Load env vars from a file into a set of keys."""
    keys = set()
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return keys
    
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key = line.split('=')[0].strip()
                keys.add(key)
    return keys

def validate_env():
    example_path = 'backend/.env.example'
    actual_path = 'backend/.env'
    
    print(f"Validating {actual_path} against {example_path}...")
    
    example_keys = load_env_file(example_path)
    actual_keys = load_env_file(actual_path)
    
    missing_keys = example_keys - actual_keys
    
    if missing_keys:
        print("\n❌ Missing environment variables in backend/.env:")
        for key in missing_keys:
            print(f"  - {key}")
        print("\nPlease add these variables to your .env file.")
        sys.exit(1)
    else:
        print("\n✅ All required environment variables are present.")
        sys.exit(0)

if __name__ == "__main__":
    validate_env()

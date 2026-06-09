#!/usr/bin/env python3
import os
import argparse
import sys
import subprocess

def check_cuda() -> str:
    """
    Checks if CUDA is available in PyTorch.
    Returns 'cuda' or 'cpu'.
    """
    try:
        import torch
        if torch.cuda.is_available():
            print("CUDA is available. Using GPU acceleration.")
            return "cuda"
        else:
            print("CUDA is not available. Using CPU.")
            return "cpu"
    except ImportError:
        print("PyTorch/torch is not installed. Defaulting to CPU.")
        return "cpu"

def separate_audio(input_file: str, output_dir: str):
    """
    Separates the input audio file into vocals and instrumentals.
    Executes Meta Demucs model via subprocess.
    """
    if not os.path.exists(input_file):
        raise FileNotFoundError(f"Input file not found at: {input_file}")
        
    os.makedirs(output_dir, exist_ok=True)
    
    device = check_cuda()
    
    # Locate the demucs executable in the same virtual environment
    venv_bin_dir = os.path.dirname(sys.executable)
    demucs_bin = os.path.join(venv_bin_dir, 'demucs')
    
    # Set up the command.
    if os.path.exists(demucs_bin):
        cmd = [demucs_bin]
    else:
        # Fallback to python -m demucs or python -m demucs.separate
        print(f"Warning: demucs binary not found at {demucs_bin}. Trying python fallback...")
        cmd = [sys.executable, "-m", "demucs"]
        
    cmd.extend([
        "--two-stems=vocals",
        "-d", device,
        "-o", output_dir,
        input_file
    ])
    
    print(f"Executing separation command: {' '.join(cmd)}")
    
    # Run the demucs command
    result = subprocess.run(cmd)
    if result.returncode != 0:
        raise RuntimeError(f"Demucs separation failed with exit code {result.returncode}")
        
    print(f"Demucs separation completed. Output saved to: {output_dir}")

def main():
    parser = argparse.ArgumentParser(description="Separate vocals and instrumentals from audio using Meta Demucs.")
    parser.add_argument("--input", required=True, help="Path to input audio file")
    parser.add_argument("--output", required=True, help="Output directory for separated audio tracks")
    args = parser.parse_args()
    
    try:
        separate_audio(args.input, args.output)
    except Exception as e:
        print(f"Error executing separator: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

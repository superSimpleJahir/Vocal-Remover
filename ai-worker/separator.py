#!/usr/bin/env python3
import os
import argparse
import sys
import subprocess
import wave
import contextlib

try:
    from dotenv import load_dotenv
    # Load env variables from root .env
    base_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(base_dir)
    dotenv_path = os.path.join(project_root, '.env')
    load_dotenv(dotenv_path)
except ImportError:
    pass

def get_wav_duration(wav_path: str) -> float:
    """
    Returns the duration of a WAV file in seconds.
    Uses standard library's wave module.
    """
    with contextlib.closing(wave.open(wav_path, 'rb')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        duration = frames / float(rate)
        return duration

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
    
    # Check audio duration limit (default 10 minutes / 600 seconds)
    max_duration_limit = float(os.getenv("MAX_AUDIO_DURATION_LIMIT", "600"))
    try:
        duration = get_wav_duration(input_file)
        print(f"Input WAV duration: {duration:.2f} seconds")
        if duration > max_duration_limit:
            raise ValueError(
                f"Audio duration ({duration / 60.0:.1f} minutes) exceeds the maximum limit "
                f"of {max_duration_limit / 60.0:.1f} minutes."
            )
    except ValueError as ve:
        raise ve
    except Exception as e:
        print(f"Warning: Could not check WAV duration: {e}", file=sys.stderr)
    
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
        
    # Determine optimal CPU threads for parallel processing (use half of the cores to avoid CPU choking)
    cpu_cores = os.cpu_count() or 1
    jobs = max(1, cpu_cores // 2)

    model = os.getenv("DEMUCS_MODEL", "htdemucs")
    cmd.extend([
        "-n", model,
        "--two-stems=vocals",
        "-d", device,
    ])

    if device == "cpu":
        cmd.extend(["-j", str(jobs)])
        print(f"Using {jobs} CPU threads for parallel separation.")

    cmd.extend([
        "-o", output_dir,
        input_file
    ])
    
    print(f"Executing separation command: {' '.join(cmd)}")
    
    # Run the demucs command
    result = subprocess.run(cmd)
    if result.returncode != 0:
        if result.returncode == 137:
            raise RuntimeError("Demucs separation process was terminated (out of memory). The audio file may be too large or complex for the server's resources.")
        else:
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

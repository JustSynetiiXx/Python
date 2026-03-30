"""Sandboxed Python code execution for NETRUNNER."""

import subprocess
import sys
import tempfile
import os

TIMEOUT_SECONDS = 5
MAX_OUTPUT_LENGTH = 5000

# Restricted execution wrapper that limits builtins and blocks imports
SANDBOX_TEMPLATE = r'''
import sys
import signal

# Block dangerous modules
_blocked = {"os", "subprocess", "shutil", "socket", "http", "urllib",
            "ftplib", "smtplib", "ctypes", "importlib", "pathlib",
            "glob", "tempfile", "pickle", "shelve", "sqlite3",
            "multiprocessing", "threading", "signal", "code", "codeop",
            "compile", "compileall", "webbrowser", "antigravity", "turtle"}

_original_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

def _safe_import(name, *args, **kwargs):
    if name.split(".")[0] in _blocked:
        raise ImportError(f"Module '{name}' is not available")
    return _original_import(name, *args, **kwargs)

import builtins
builtins.__import__ = _safe_import

# Allowed builtins only
_allowed_builtins = {
    "print", "input", "len", "range", "int", "float", "str", "bool",
    "list", "dict", "tuple", "set", "type", "isinstance", "sorted",
    "reversed", "enumerate", "zip", "map", "filter", "sum", "min",
    "max", "abs", "round", "pow", "divmod", "hex", "oct", "bin",
    "chr", "ord", "repr", "format", "hash", "id", "dir", "vars",
    "hasattr", "getattr", "setattr", "callable", "iter", "next",
    "slice", "property", "staticmethod", "classmethod", "super",
    "object", "True", "False", "None", "__import__",
    "__name__", "__build_class__",
}

_safe_builtins = {}
for name in _allowed_builtins:
    if hasattr(builtins, name):
        _safe_builtins[name] = getattr(builtins, name)

# Keep Exception classes accessible
for name in dir(builtins):
    obj = getattr(builtins, name)
    if isinstance(obj, type) and issubclass(obj, BaseException):
        _safe_builtins[name] = obj

# Execute user code
try:
    exec(compile(open("CODE_FILE_PLACEHOLDER").read(), "<netrunner>", "exec"), {"__builtins__": _safe_builtins})
except SystemExit:
    pass
except Exception as e:
    print(f"{type(e).__name__}: {e}", file=sys.stderr)
'''


def execute_code(code: str, stdin_input: str = "") -> dict:
    """Execute Python code in a sandboxed subprocess.

    Returns:
        dict with keys: output, error, success, timeout
    """
    # Write user code to temp file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as code_f:
        code_f.write(code)
        code_file = code_f.name

    # Write sandbox wrapper
    wrapper_code = SANDBOX_TEMPLATE.replace("CODE_FILE_PLACEHOLDER", code_file)
    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as wrapper_f:
        wrapper_f.write(wrapper_code)
        wrapper_file = wrapper_f.name

    try:
        result = subprocess.run(
            [sys.executable, wrapper_file],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
            input=stdin_input or None,
            env={
                "PATH": os.environ.get("PATH", ""),
                "HOME": "/tmp",
                "LANG": "en_US.UTF-8",
            },
        )

        output = result.stdout[:MAX_OUTPUT_LENGTH]
        error = result.stderr[:MAX_OUTPUT_LENGTH]

        return {
            "output": output,
            "error": error,
            "success": result.returncode == 0 and not error,
            "timeout": False,
        }

    except subprocess.TimeoutExpired:
        return {
            "output": "",
            "error": "Timeout: Code hat zu lange gebraucht (max 5 Sekunden).",
            "success": False,
            "timeout": True,
        }
    finally:
        os.unlink(code_file)
        os.unlink(wrapper_file)

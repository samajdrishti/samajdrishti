import sys
try:
    import pandas
    print("PASS pandas", pandas.__version__, "from", pandas.__file__, "| python", sys.version.split()[0])
except BaseException as exc:
    print("FAIL pandas ->", type(exc).__name__, str(exc)[:200])

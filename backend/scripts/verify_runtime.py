#!/usr/bin/env python3
import importlib
import sys

CHECKS = [
    ('cv2', 'OpenCV face/image processing'),
    ('face_recognition', 'Face embeddings'),
    ('deepface', 'Deep anti-spoof model path'),
    ('sqlalchemy', 'Database ORM'),
    ('alembic', 'Migrations'),
    ('redis', 'Distributed rate limiting backend'),
]


def main() -> int:
    print('== ShadowGraph Runtime Dependency Check ==')
    failures = []
    for mod, desc in CHECKS:
        try:
            importlib.import_module(mod)
            print(f"[OK] {mod:16} - {desc}")
        except Exception as exc:
            print(f"[FAIL] {mod:16} - {desc} ({exc})")
            failures.append(mod)

    if failures:
        print('\nMissing/broken modules:', ', '.join(failures))
        return 1

    print('\nAll runtime dependencies import successfully.')
    return 0


if __name__ == '__main__':
    sys.exit(main())

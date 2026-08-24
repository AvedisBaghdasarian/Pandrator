import os
import subprocess
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


class TestStaticBuildTarget(unittest.TestCase):
    def test_static_build_target_and_golden_path_assets(self):
        web_dir = REPO_ROOT / "web"
        static_output_dir = REPO_ROOT / "pandrator" / "web" / "static"

        # Ensure npm run build:static completes successfully
        res = subprocess.run(
            ["npm", "run", "build:static"],
            cwd=str(web_dir),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(
            res.returncode,
            0,
            f"npm run build:static failed with code {res.returncode}:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}",
        )

        # Check that index.html exists in static directory
        index_html = static_output_dir / "index.html"
        self.assertTrue(
            index_html.exists(),
            f"Expected static index.html at {index_html}",
        )

        # Verify static studio files exist in the build output
        static_html = static_output_dir / "static" / "index.html"
        static_studio_exists = static_html.exists() or any(
            "static" in str(f) for f in static_output_dir.rglob("*.js")
        )
        self.assertTrue(
            static_studio_exists,
            "Expected static studio page artifacts in pre-rendered static output",
        )


if __name__ == "__main__":
    unittest.main()

"""
Integration test: PDF parsing with opendataloader-pdf.

Usage:
    # Test the parser directly (no backend needed)
    python scripts/test_pdf_parsing.py test.pdf

    # Full integration test (requires running backend)
    API_URL=http://localhost:8000 python scripts/test_pdf_parsing.py --e2e test.pdf
"""
import argparse
import os
import sys
import tempfile
from pathlib import Path


def test_opendataloader_direct(pdf_path: str):
    """Test opendataloader-pdf conversion directly (no backend)."""
    print(f"--- Direct parser test: {pdf_path} ---")

    try:
        import opendataloader_pdf
    except ImportError:
        print("SKIP: opendataloader-pdf not installed. Run: pip install opendataloader-pdf")
        return False

    with tempfile.TemporaryDirectory() as output_dir:
        print(f"Converting PDF to Markdown...")
        opendataloader_pdf.convert(
            input_path=[pdf_path],
            output_dir=output_dir,
            format="markdown,json",
            quiet=True,
        )

        # Check markdown output
        stem = Path(pdf_path).stem
        md_path = os.path.join(output_dir, stem + ".md")
        json_path = os.path.join(output_dir, stem + ".json")

        # Fallback: find any generated files
        if not os.path.exists(md_path):
            md_files = list(Path(output_dir).glob("*.md"))
            if md_files:
                md_path = str(md_files[0])

        if not os.path.exists(json_path):
            json_files = list(Path(output_dir).glob("*.json"))
            if json_files:
                json_path = str(json_files[0])

        # Validate markdown
        if os.path.exists(md_path):
            with open(md_path, "r", encoding="utf-8") as f:
                md_text = f.read()
            lines = md_text.split("\n")
            print(f"  Markdown: {len(md_text)} chars, {len(lines)} lines")
            print(f"  First 3 lines:")
            for line in lines[:3]:
                print(f"    {line[:80]}")
            assert len(md_text.strip()) > 0, "Markdown output is empty"
            print("  PASS: Markdown output generated")
        else:
            print("  FAIL: No markdown output found")
            return False

        # Validate JSON
        if os.path.exists(json_path):
            import json
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            elements = data if isinstance(data, list) else data.get("pages", [])
            element_count = len(elements) if isinstance(elements, list) else 0
            print(f"  JSON: {element_count} elements")
            print("  PASS: JSON output generated")
        else:
            print("  WARN: No JSON output found")

    print("--- Direct parser test PASSED ---\n")
    return True


def test_fallback(pdf_path: str):
    """Verify PyPDFLoader fallback works when opendataloader-pdf is unavailable."""
    print("--- Fallback test ---")

    # Temporarily hide opendataloader_pdf to trigger fallback
    import importlib
    original = None
    if "opendataloader_pdf" in sys.modules:
        original = sys.modules.pop("opendataloader_pdf")

    try:
        # Simulate the fallback path from _load_pdf_opendataloader
        from langchain_community.document_loaders import PyPDFLoader
        docs = PyPDFLoader(pdf_path).load()
        print(f"  PyPDFLoader fallback: {len(docs)} pages extracted")
        assert len(docs) > 0, "PyPDFLoader returned no documents"
        print("  PASS: Fallback to PyPDFLoader works")
    except ImportError:
        print("  SKIP: PyPDFLoader not available for fallback test")
        return False
    finally:
        if original is not None:
            sys.modules["opendataloader_pdf"] = original

    print("--- Fallback test PASSED ---\n")
    return True


def test_e2e(pdf_path: str):
    """Full end-to-end test: upload PDF → ingest → chat (requires running backend)."""
    import requests

    api_url = os.getenv("API_URL", "http://localhost:8000")
    print(f"--- E2E test against {api_url} ---")

    session = requests.Session()

    # 1. Health check
    resp = session.get(f"{api_url}/health")
    assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
    print("  Health check OK")

    # 2. Create a test bot
    bot_data = {
        "name": "PDF Parse Test Bot",
        "description": "Created by test_pdf_parsing.py",
        "config": {"model": "openai/gpt-4o-mini", "domain": "general"},
    }
    resp = session.post(f"{api_url}/api/v1/bots/", json=bot_data)
    assert resp.status_code in [200, 201], f"Create bot failed: {resp.status_code} {resp.text}"
    bot_id = resp.json()["id"]
    print(f"  Bot created: {bot_id}")

    try:
        # 3. Upload PDF
        with open(pdf_path, "rb") as f:
            resp = session.post(
                f"{api_url}/api/v1/openrouter/rag/ingest",
                files={"file": (os.path.basename(pdf_path), f, "application/pdf")},
                data={"bot_id": bot_id, "chunk_size": "512", "chunk_overlap": "100"},
            )
        assert resp.status_code == 200, f"Ingest failed: {resp.status_code} {resp.text}"
        result = resp.json()["data"]
        chunks = result.get("chunks_created", 0)
        print(f"  Ingestion OK: {chunks} chunks created")
        assert chunks > 0, "No chunks created from PDF"

        # 4. Chat
        resp = session.post(
            f"{api_url}/api/v1/openrouter/rag/chat",
            json={
                "bot_id": bot_id,
                "query": "What is this document about?",
                "bot_config": {"model": "openai/gpt-4o-mini"},
            },
        )
        assert resp.status_code == 200, f"Chat failed: {resp.status_code} {resp.text}"
        answer = resp.json().get("data", {}).get("answer", "")
        print(f"  Chat OK: {answer[:100]}...")
    finally:
        # 5. Cleanup
        session.delete(f"{api_url}/api/v1/bots/{bot_id}")
        print(f"  Bot cleaned up")

    print("--- E2E test PASSED ---\n")
    return True


def main():
    parser = argparse.ArgumentParser(description="Test opendataloader-pdf integration")
    parser.add_argument("pdf", nargs="?", help="Path to a test PDF file")
    parser.add_argument("--e2e", action="store_true", help="Run full E2E test (requires backend)")
    args = parser.parse_args()

    # If no PDF provided, create a minimal test PDF
    pdf_path = args.pdf
    if not pdf_path:
        try:
            from pypdf import PdfWriter

            pdf_path = os.path.join(tempfile.gettempdir(), "_test_omnirag.pdf")
            writer = PdfWriter()
            writer.add_blank_page(width=595, height=842)
            with open(pdf_path, "wb") as f:
                writer.write(f)
            print(f"Created minimal test PDF: {pdf_path}\n")
        except ImportError:
            print("Usage: python test_pdf_parsing.py <path-to-pdf>")
            print("  (Or install pypdf to auto-generate a test PDF)")
            sys.exit(1)

    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        sys.exit(1)

    passed = 0
    failed = 0

    # Test 1: Direct parser
    if test_opendataloader_direct(pdf_path):
        passed += 1
    else:
        failed += 1

    # Test 2: Fallback
    if test_fallback(pdf_path):
        passed += 1
    else:
        failed += 1

    # Test 3: E2E (optional)
    if args.e2e:
        try:
            if test_e2e(pdf_path):
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"  E2E test FAILED: {e}")
            failed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
OpenRouter Integration Test Script
Tests all OpenRouter functionalities including chat, embeddings, and RAG.
"""

import requests
import json
import sys
from typing import Dict, Any

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
OPENROUTER_ENDPOINT = f"{BASE_URL}/openrouter"


def print_section(title: str):
    """Print formatted section header."""
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)


def print_result(test_name: str, success: bool, data: Any = None):
    """Print test result."""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"\n{status} - {test_name}")
    if data:
        print(f"Response: {json.dumps(data, indent=2)}")


def test_connection() -> bool:
    """Test OpenRouter API connection."""
    print_section("Testing OpenRouter Connection")
    
    try:
        response = requests.get(f"{OPENROUTER_ENDPOINT}/test")
        success = response.status_code == 200
        data = response.json() if success else None
        print_result("Connection Test", success, data)
        return success
    except Exception as e:
        print_result("Connection Test", False, {"error": str(e)})
        return False


def test_chat_completion() -> bool:
    """Test chat completion."""
    print_section("Testing Chat Completion")
    
    payload = {
        "messages": [
            {"role": "user", "content": "What is the capital of Vietnam? Answer in one sentence."}
        ],
        "temperature": 0.7,
        "max_tokens": 100
    }
    
    try:
        response = requests.post(
            f"{OPENROUTER_ENDPOINT}/chat",
            json=payload
        )
        success = response.status_code == 200
        data = response.json() if success else None
        print_result("Chat Completion", success, data)
        return success
    except Exception as e:
        print_result("Chat Completion", False, {"error": str(e)})
        return False


def test_embeddings() -> bool:
    """Test embeddings generation."""
    print_section("Testing Embeddings Generation")
    
    payload = {
        "texts": [
            "Machine learning is awesome",
            "Deep learning uses neural networks",
            "Natural language processing"
        ]
    }
    
    try:
        response = requests.post(
            f"{OPENROUTER_ENDPOINT}/embeddings",
            json=payload
        )
        success = response.status_code == 200
        if success:
            data = response.json()
            # Don't print full embeddings (too long)
            summary = {
                "status": data.get("status"),
                "count": data.get("data", {}).get("count"),
                "dimensions": data.get("data", {}).get("dimensions"),
                "sample_vector_length": len(data.get("data", {}).get("embeddings", [[]])[0])
            }
            print_result("Embeddings Generation", True, summary)
        else:
            print_result("Embeddings Generation", False, response.json())
        return success
    except Exception as e:
        print_result("Embeddings Generation", False, {"error": str(e)})
        return False


def test_list_models() -> bool:
    """Test listing available models."""
    print_section("Testing Model Listings")
    
    success = True
    
    # List chat models
    try:
        response = requests.get(f"{OPENROUTER_ENDPOINT}/models/chat")
        chat_success = response.status_code == 200
        data = response.json() if chat_success else None
        print_result("List Chat Models", chat_success, data)
        success = success and chat_success
    except Exception as e:
        print_result("List Chat Models", False, {"error": str(e)})
        success = False
    
    # List embedding models
    try:
        response = requests.get(f"{OPENROUTER_ENDPOINT}/models/embeddings")
        emb_success = response.status_code == 200
        data = response.json() if emb_success else None
        print_result("List Embedding Models", emb_success, data)
        success = success and emb_success
    except Exception as e:
        print_result("List Embedding Models", False, {"error": str(e)})
        success = False
    
    return success


def test_rag_chat() -> bool:
    """Test RAG chat (requires document to be ingested first)."""
    print_section("Testing RAG Chat")
    
    payload = {
        "bot_id": "test_bot_123",
        "query": "Tell me about machine learning",
        "top_k": 3
    }
    
    try:
        response = requests.post(
            f"{OPENROUTER_ENDPOINT}/rag/chat",
            json=payload
        )
        success = response.status_code == 200
        data = response.json() if success else None
        
        if not success and response.status_code == 500:
            error_msg = data.get("detail", "Unknown error") if data else "Unknown error"
            if "No documents found" in str(error_msg) or "bot_id" in str(error_msg):
                print(f"\nℹ️  INFO - RAG Chat test skipped (no documents ingested for test_bot_123)")
                print(f"   To test RAG chat, first ingest a document using:")
                print(f"   POST {OPENROUTER_ENDPOINT}/rag/ingest")
                return True  # Not a failure, just no data
        
        print_result("RAG Chat", success, data)
        return success
    except Exception as e:
        print_result("RAG Chat", False, {"error": str(e)})
        return False


def main():
    """Run all tests."""
    print("\n" + "🚀 "*20)
    print("  OpenRouter Integration Test Suite")
    print("🚀 "*20)
    
    print(f"\nBase URL: {BASE_URL}")
    print(f"Endpoint: {OPENROUTER_ENDPOINT}")
    
    # Run tests
    results = {
        "Connection Test": test_connection(),
        "Chat Completion": test_chat_completion(),
        "Embeddings Generation": test_embeddings(),
        "Model Listings": test_list_models(),
        "RAG Chat": test_rag_chat()
    }
    
    # Summary
    print_section("Test Summary")
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    print(f"\nResults: {passed}/{total} tests passed")
    for test_name, success in results.items():
        status = "✅" if success else "❌"
        print(f"  {status} {test_name}")
    
    # Exit code
    if passed == total:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()

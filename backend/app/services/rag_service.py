import os
from typing import List
from datetime import datetime
from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_community.vectorstores import Qdrant
from langchain.chains import RetrievalQA
from langchain.schema import Document as LangChainDocument
from qdrant_client import QdrantClient
from qdrant_client.http import models as rest
from app.core.config import settings
from app.db.mongodb import get_mongodb
import tempfile
import shutil
import time
import uuid

class RAGService:
    def __init__(self):
        # Configure AI Provider (OpenRouter or OpenAI)
        self.api_key = settings.OPENAI_API_KEY
        self.api_base = None
        self.chat_model = "gpt-3.5-turbo"
        self.embedding_model = "text-embedding-ada-002"

        if settings.AI_PROVIDER == "openrouter":
            self.api_key = settings.OPENROUTER_API_KEY
            self.api_base = "https://openrouter.ai/api/v1"
            self.chat_model = settings.OPENROUTER_CHAT_MODEL
            self.embedding_model = settings.OPENROUTER_EMBEDDING_MODEL

        if not self.api_key:
            print(f"WARNING: API Key missing for provider {settings.AI_PROVIDER}. RAGService may fail.")

        self.embeddings = OpenAIEmbeddings(
            openai_api_key=self.api_key,
            openai_api_base=self.api_base,
            model=self.embedding_model
        )
        self.qdrant_client = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
        self.llm = ChatOpenAI(
            temperature=0, 
            openai_api_key=self.api_key, 
            openai_api_base=self.api_base,
            model_name=self.chat_model
        )

    async def ingest_file(self, file: UploadFile, bot_id: int):
        # 1. Save temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        try:
            # 2. Load document
            if file.filename.endswith(".pdf"):
                loader = PyPDFLoader(tmp_path)
            else:
                loader = TextLoader(tmp_path)
            
            documents = loader.load()

            # 3. Split text
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
            texts = text_splitter.split_documents(documents)

            # 4. Add metadata
            for doc in texts:
                doc.metadata["bot_id"] = bot_id
                doc.metadata["source"] = file.filename

            # 5. Store in Qdrant
            # Ensure collection exists
            collection_name = "omnirag_collection"
            try:
                self.qdrant_client.get_collection(collection_name)
            except Exception:
                self.qdrant_client.create_collection(
                    collection_name=collection_name,
                    vectors_config=rest.VectorParams(size=1536, distance=rest.Distance.COSINE),
                )

            Qdrant.from_documents(
                texts,
                self.embeddings,
                url=f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}",
                prefer_grpc=False,
                collection_name=collection_name
            )
            
            return len(texts)

        finally:
            os.remove(tmp_path)

    def chat(self, bot_id: int, query: str, session_id: str = None):
        """
        Chat with the bot and log conversation to MongoDB for analytics.
        """
        collection_name = "omnirag_collection"
        
        # Track response time
        start_time = time.time()
        
        vectorstore = Qdrant(
            client=self.qdrant_client,
            collection_name=collection_name,
            embeddings=self.embeddings,
        )

        # Filter by bot_id
        retriever = vectorstore.as_retriever(
            search_kwargs={"filter": {"bot_id": bot_id}, "k": 3}
        )

        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True
        )

        result = qa_chain.invoke({"query": query})
        
        # Calculate response time
        response_time = time.time() - start_time
        
        response_data = {
            "response": result["result"],
            "sources": [doc.metadata.get("source", "unknown") for doc in result["source_documents"]]
        }
        
        # Log conversation to MongoDB asynchronously (fire and forget)
        # We'll use a background task or just log it here
        try:
            import asyncio
            asyncio.create_task(self._log_conversation(
                bot_id=str(bot_id),
                session_id=session_id or str(uuid.uuid4()),
                user_message=query,
                response=result["result"],
                sources=response_data["sources"],
                response_time=response_time
            ))
        except Exception as e:
            # Don't fail the chat if logging fails
            print(f"Failed to log conversation: {e}")
        
        return response_data
    
    async def _log_conversation(
        self,
        bot_id: str,
        session_id: str,
        user_message: str,
        response: str,
        sources: List[str],
        response_time: float
    ):
        """
        Log conversation to MongoDB for analytics.
        """
        try:
            mongo_db = await get_mongodb()
            conversations_collection = mongo_db.conversations
            
            conversation_doc = {
                "bot_id": bot_id,
                "session_id": session_id,
                "user_message": user_message,
                "response": response,
                "sources": sources,
                "response_time": round(response_time, 2),
                "timestamp": datetime.utcnow(),
            }
            
            await conversations_collection.insert_one(conversation_doc)
        except Exception as e:
            print(f"Error logging conversation to MongoDB: {e}")

rag_service = RAGService()

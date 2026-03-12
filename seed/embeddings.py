"""
Gerador de embeddings usando OpenAI
"""
import os
from typing import List
from openai import OpenAI

class EmbeddingGenerator:
    """Gerador de embeddings usando OpenAI"""
    
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
        self.model = "text-embedding-3-small"
        self.dimensions = 1536
    
    def generate(self, text: str) -> List[float]:
        """Gera embedding para um texto"""
        if not text or len(text.strip()) == 0:
            # Retornar embedding zero se texto vazio
            return [0.0] * self.dimensions
        
        response = self.client.embeddings.create(
            model=self.model,
            input=text
        )
        
        return response.data[0].embedding
    
    def generate_batch(self, texts: List[str]) -> List[List[float]]:
        """Gera embeddings para múltiplos textos (mais eficiente)"""
        if not texts:
            return []
        
        # Filtrar textos vazios
        valid_texts = [text if text and len(text.strip()) > 0 else "game" for text in texts]
        
        response = self.client.embeddings.create(
            model=self.model,
            input=valid_texts
        )
        
        return [item.embedding for item in response.data]

def get_embedding_generator() -> EmbeddingGenerator:
    """Factory para criar gerador de embeddings"""
    provider = os.getenv('EMBEDDING_PROVIDER', 'openai')
    
    if provider == 'openai':
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        return EmbeddingGenerator(api_key)
    else:
        raise ValueError(f"Unsupported embedding provider: {provider}")


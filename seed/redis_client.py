"""
Cliente Redis para seed
"""
import os
import sys
from redis import Redis
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def get_redis_client() -> Redis:
    """Cria e retorna cliente Redis"""
    redis_url = os.getenv('REDIS_URL')
    
    if not redis_url:
        print("❌ ERROR: REDIS_URL not found in environment variables")
        print("Please create a .env file with:")
        print("REDIS_URL=redis://default:password@host:port")
        sys.exit(1)
    
    try:
        client = Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        
        # Testar conexão
        client.ping()
        
        return client
    except Exception as e:
        print(f"❌ ERROR: Could not connect to Redis")
        print(f"URL: {redis_url}")
        print(f"Error: {e}")
        sys.exit(1)


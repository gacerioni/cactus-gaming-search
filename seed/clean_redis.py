#!/usr/bin/env python3
"""
Limpa o Redis: drop index + delete all game keys
"""
import redis

client = redis.Redis(host="localhost", port=6379, decode_responses=True)

# Drop index
try:
    client.execute_command("FT.DROPINDEX", "idx:jogos", "DD")
    print("✓ Dropped index idx:jogos")
except Exception as e:
    print(f"✓ Index did not exist: {e}")

# Flush all game keys
keys = client.keys("jogo:*")
if keys:
    client.delete(*keys)
    print(f"✓ Deleted {len(keys)} game keys")
else:
    print("✓ No game keys to delete")

print("✅ Redis cleaned")


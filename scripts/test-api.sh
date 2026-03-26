#!/bin/bash

# Script de teste da API Cactus Gaming Search
# Uso: ./test-api.sh [URL]
# Exemplo: ./test-api.sh https://api-backend.platformengineer.io

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# URL base (padrão: produção)
BASE_URL="${1:-https://api-backend.platformengineer.io}"

echo "🧪 Testing Cactus Gaming Search API"
echo "📡 Base URL: $BASE_URL"
echo ""

# Função para testar endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ OK${NC} (HTTP $http_code)"
        echo "   Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body | head -c 100)"
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
        echo "   Response: $body"
        return 1
    fi
}

# Contador de testes
total=0
passed=0

# 1. Health Check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Health" "GET" "/health"
((total++))
[ $? -eq 0 ] && ((passed++))
echo ""

# 2. Autocomplete
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  Autocomplete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Autocomplete (tig)" "GET" "/api/autocomplete?q=tig"
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Autocomplete (avi)" "GET" "/api/autocomplete?q=avi"
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Autocomplete (olymp)" "GET" "/api/autocomplete?q=olymp"
((total++))
[ $? -eq 0 ] && ((passed++))
echo ""

# 3. Search (Hybrid)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  Hybrid Search"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Search (tigre)" "POST" "/api/search" '{"query":"tigre"}'
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Search (mengao - alias)" "POST" "/api/search" '{"query":"mengao"}'
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Search (aviator)" "POST" "/api/search" '{"query":"aviator"}'
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Search with provider filter" "POST" "/api/search" '{"query":"fortune","filters":{"provider":"PG Soft"}}'
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Search with categoria filter" "POST" "/api/search" '{"query":"fortune","filters":{"categoria":"slot"}}'
((total++))
[ $? -eq 0 ] && ((passed++))
echo ""

# 4. Categories
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  Categories"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Categories" "GET" "/api/categories"
((total++))
[ $? -eq 0 ] && ((passed++))
echo ""

# 5. Vector Search
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  Vector Search"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Vector Search (tigre asiático)" "POST" "/api/vector-search" '{"query":"jogos de tigre asiático com multiplicadores"}'
((total++))
[ $? -eq 0 ] && ((passed++))

test_endpoint "Vector Search (aviãozinho)" "POST" "/api/vector-search" '{"query":"jogo do aviãozinho que sobe"}'
((total++))
[ $? -eq 0 ] && ((passed++))
echo ""

# 6. Validate new fields in response
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  New Fields Validation (image, rtp, slug, categoria)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "Checking new fields in search response... "
fields_response=$(curl -s -X POST "$BASE_URL/api/search" \
    -H "Content-Type: application/json" \
    -d '{"query":"Fortune Tiger"}')
has_image=$(echo "$fields_response" | jq -r '.games[0].image // empty' 2>/dev/null)
has_rtp=$(echo "$fields_response" | jq -r '.games[0].rtp // empty' 2>/dev/null)
has_slug=$(echo "$fields_response" | jq -r '.games[0].slug // empty' 2>/dev/null)
has_cat=$(echo "$fields_response" | jq -r '.games[0].categoria // empty' 2>/dev/null)
if [ -n "$has_image" ] && [ -n "$has_rtp" ] && [ -n "$has_slug" ] && [ -n "$has_cat" ]; then
    echo -e "${GREEN}✓ OK${NC}"
    echo "   image: $has_image"
    echo "   rtp: $has_rtp"
    echo "   slug: $has_slug"
    echo "   categoria: $has_cat"
    ((passed++))
else
    echo -e "${RED}✗ FAIL${NC} - Missing fields (image=$has_image rtp=$has_rtp slug=$has_slug cat=$has_cat)"
fi
((total++))
echo ""

# Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Total tests: $total"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$((total - passed))${NC}"

if [ $passed -eq $total ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed${NC}"
    exit 1
fi


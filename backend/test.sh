#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login -d "username=irem@gmail.com&password=password" | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')
echo "Token: $TOKEN"

curl -s -X POST http://localhost:8000/api/v1/chat-history \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "123e4567-e89b-12d3-a456-426614174000", "role": "user", "content": "Hello bash test"}'

echo -e "\nSessions:"
curl -s -X GET http://localhost:8000/api/v1/chat-history/sessions \
  -H "Authorization: Bearer $TOKEN"

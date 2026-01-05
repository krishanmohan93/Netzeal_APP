import httpx
import asyncio
import os

async def test_groq():
    # Get API key from environment variable
    groq_api_key = os.getenv('GROQ_API_KEY')
    if not groq_api_key:
        print('Error: GROQ_API_KEY environment variable not set')
        return
    
    headers = {
        'Authorization': f'Bearer {groq_api_key}',
        'Content-Type': 'application/json'
    }
    payload = {
        'model': 'llama-3.1-8b-instant',
        'messages': [{'role': 'user', 'content': 'Say hello in 5 words'}],
        'temperature': 0.7,
        'max_tokens': 100
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                'https://api.groq.com/openai/v1/chat/completions',
                headers=headers,
                json=payload
            )
            print(f'Status Code: {response.status_code}')
            if response.status_code == 200:
                data = response.json()
                print(f'Success! Response: {data["choices"][0]["message"]["content"]}')
            else:
                print(f'Error: {response.text}')
    except Exception as e:
        print(f'Exception: {e}')

asyncio.run(test_groq())

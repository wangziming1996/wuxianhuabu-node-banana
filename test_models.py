#!/usr/bin/env python3
"""Test all three Agnes AI models with the given API key."""
import urllib.request, urllib.error, json, sys, os

api_key = sys.argv[1] if len(sys.argv) > 1 else ''
if not api_key:
    print('Usage: python3 test_models.py <API_KEY>')
    sys.exit(1)

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

def test_model(name, url, data, timeout=60):
    print(f'\n=== {name} ===')
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode(),
            headers=headers
        )
        resp = urllib.request.urlopen(req, timeout=timeout)
        result = json.loads(resp.read())
        print(f'  HTTP {resp.status} ✅')
        return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  HTTP {e.code} ❌')
        print(f'  Response: {body[:300]}')
        return None
    except Exception as e:
        print(f'  ERROR: {e}')
        return None

# 1. Text model
test_model(
    'Text: Agnes-2.0-Flash',
    'https://apihub.agnes-ai.com/v1/chat/completions',
    {
        'model': 'agnes-2.0-flash',
        'messages': [{'role': 'user', 'content': 'say hello in 3 words'}],
        'max_tokens': 30
    },
    timeout=30
)

# 2. Image model - with extra_body.response_format as per docs
result = test_model(
    'Image: Agnes-Image-2.0-Flash',
    'https://apihub.agnes-ai.com/v1/images/generations',
    {
        'model': 'agnes-image-2.0-flash',
        'prompt': 'a cute cat cartoon style',
        'size': '1024x768',
        'extra_body': {'response_format': 'url'}
    },
    timeout=60
)
if result:
    print(f'  Image URL: {result.get("data", [{}])[0].get("url", "N/A")[:80]}')

# 3. Video model - create task
video_result = test_model(
    'Video: Agnes-Video-V2.0 (create)',
    'https://apihub.agnes-ai.com/v1/videos',
    {
        'model': 'agnes-video-v2.0',
        'prompt': 'a cute cat walking on beach cinematic',
        'num_frames': 81,
        'frame_rate': 24,
        'width': 1152,
        'height': 768
    },
    timeout=120
)
if video_result:
    print(f'  task_id: {video_result.get("task_id", "N/A")}')
    print(f'  video_id: {video_result.get("video_id", "N/A")}')
    print(f'  status: {video_result.get("status", "N/A")}')

print('\n=== ALL TESTS DONE ===')
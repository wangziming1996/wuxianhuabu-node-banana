#!/usr/bin/env python3
import urllib.request, urllib.error, json

api_key = 'sk-Ho69OoRQpz9NSMdv5jnwM59Ge9EMpH6SjOMtdW2SyLOYLhYj'

headers = {
    'Authorization': f'Bearer {api_key}',
    'Content-Type': 'application/json'
}

def test(name, url, data, timeout=60):
    print(f'\n=== {name} ===')
    print(f'  POST {url}')
    try:
        req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers)
        resp = urllib.request.urlopen(req, timeout=timeout)
        result = json.loads(resp.read())
        print(f'  HTTP {resp.status} ✅')
        return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  HTTP {e.code} ❌')
        print(f'  Body: {body[:500]}')
    except Exception as e:
        print(f'  ERROR: {e}')

# Text
r = test('Text: Agnes-2.0-Flash', 'https://apihub.agnes-ai.com/v1/chat/completions',
    {'model':'agnes-2.0-flash','messages':[{'role':'user','content':'say hi in 2 words'}],'max_tokens':20}, 30)
if r: print(f'  -> {r["choices"][0]["message"]["content"]}')

# Image - try WITHOUT extra_body first
r = test('Image: Agnes-Image-2.0-Flash', 'https://apihub.agnes-ai.com/v1/images/generations',
    {'model':'agnes-image-2.0-flash','prompt':'a cute cat','size':'1024x768','n':1}, 60)
if r: print(f'  -> {r["data"][0]["url"][:100]}')

# Video
r = test('Video: Agnes-Video-V2.0', 'https://apihub.agnes-ai.com/v1/videos',
    {'model':'agnes-video-v2.0','prompt':'a cute cat','num_frames':81,'frame_rate':24,'width':1152,'height':768}, 120)
if r:
    print(f'  task_id: {r.get("task_id","?")}')
    print(f'  video_id: {r.get("video_id","?")}')
    print(f'  status: {r.get("status","?")}')

print('\n=== DONE ===')
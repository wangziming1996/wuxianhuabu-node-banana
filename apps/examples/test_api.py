#!/usr/bin/env python3
import urllib.request, json, sys

with open('/Users/wangziming/zmt/wuxianhuabu/apps/examples/.env.local') as f:
    for line in f:
        if line.startswith('IMAGE_API_KEY='):
            key = line.split('=', 1)[1].strip()
            break

print(f'Key loaded: {key[:10]}...{key[-8:]}', file=sys.stderr)

base = 'https://apihub.agnes-ai.com/v1'
h = {'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'}

print('Test 1: agnes-2.0-flash')
try:
    req = urllib.request.Request(f'{base}/chat/completions', data=json.dumps({'model': 'agnes-2.0-flash', 'messages': [{'role': 'user', 'content': 'Say hi in one word'}]}).encode(), headers=h)
    resp = urllib.request.urlopen(req, timeout=30)
    d = json.loads(resp.read())
    print(f'OK: {d["choices"][0]["message"]["content"]}')
except urllib.request.HTTPError as e:
    print(f'FAIL ({e.code}): {e.read().decode()[:200]}')

print('Test 2: agnes-image-2.0-flash')
try:
    req = urllib.request.Request(f'{base}/images/generations', data=json.dumps({'model': 'agnes-image-2.0-flash', 'prompt': 'a cute orange cat, digital art style', 'n': 1, 'size': '1024x1024'}).encode(), headers=h)
    resp = urllib.request.urlopen(req, timeout=120)
    d = json.loads(resp.read())
    print(f'OK: {d["data"][0]["url"][:80]}...')
except urllib.request.HTTPError as e:
    print(f'FAIL ({e.code}): {e.read().decode()[:300]}')

print('Test 3: agnes-video-v2.0')
try:
    req = urllib.request.Request(f'{base}/videos', data=json.dumps({'model': 'agnes-video-v2.0', 'prompt': 'a cat walking on grass', 'width': 1152, 'height': 648, 'num_frames': 121, 'frame_rate': 24}).encode(), headers=h)
    resp = urllib.request.urlopen(req, timeout=60)
    d = json.loads(resp.read())
    print(f'OK: task_id={d.get("id", d.get("task_id", "unknown"))}')
except urllib.request.HTTPError as e:
    print(f'FAIL ({e.code}): {e.read().decode()[:300]}')

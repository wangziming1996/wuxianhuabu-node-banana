import urllib.request, json, os

# Read key from .env.local
env_path = os.path.expanduser('~/zmt/wuxianhuabu/apps/examples/.env.local')
env = open(env_path).read()
key = ''
for line in env.split('\n'):
    if line.startswith('IMAGE_API_KEY='):
        if line.startswith('IMAGE_API_KEY='):
                key = line.split('=', 1)[1].strip()
                break

if not key:
    print('ERROR: no key found')
    exit(1)

print('KEY starts with:', key[:10])

# 1. Test text model
print('\n=== TEXT MODEL ===')
data = json.dumps({
    'model': 'agnes-2.0-flash',
    'messages': [{'role': 'user', 'content': 'say hello in one word'}],
    'max_tokens': 20
}).encode()
req = urllib.request.Request(
    'https://apihub.agnes-ai.com/v1/chat/completions',
    data=data,
    headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req, timeout=30)
result = json.loads(resp.read())
print('OK:', result['choices'][0]['message']['content'])

# 2. Test image model
print('\n=== IMAGE MODEL ===')
data = json.dumps({
    'model': 'agnes-image-2.0-flash',
    'prompt': 'a cute cat cartoon style',
    'size': '1024x768',
    'extra_body': {'response_format': 'url'}
}).encode()
req = urllib.request.Request(
    'https://apihub.agnes-ai.com/v1/images/generations',
    data=data,
    headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req, timeout=60)
result = json.loads(resp.read())
print('OK:', result['data'][0]['url'][:100])

# 3. Test video model  
print('\n=== VIDEO MODEL ===')
data = json.dumps({
    'model': 'agnes-video-v2.0',
    'prompt': 'a cute cat walking on beach sunset cinematic',
    'num_frames': 81,
    'frame_rate': 24,
    'width': 1152,
    'height': 768
}).encode()
req = urllib.request.Request(
    'https://apihub.agnes-ai.com/v1/videos',
    data=data,
    headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'}
)
resp = urllib.request.urlopen(req, timeout=120)
result = json.loads(resp.read())
print('task_id:', result.get('task_id', ''))
print('video_id:', result.get('video_id', ''))
print('status:', result.get('status', ''))
print('full response keys:', list(result.keys()))

print('\nALL TESTS PASSED')
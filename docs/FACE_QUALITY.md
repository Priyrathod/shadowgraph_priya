# Face System Quality Checklist

## Gallery Curation
- Use clear frontal face photos.
- One primary face per image.
- Avoid heavy filters/occlusion.
- Keep consistent lighting where possible.

## Metadata
Update:
- `backend/app/data/face_gallery/metadata.json`

Each item:
```json
{
  "name": "Person Name",
  "platform": "GitHub",
  "profile_url": "https://github.com/username",
  "image": "filename.jpg"
}
```

## DeepFace Runtime
The anti-spoof primary path uses DeepFace.
If model runtime/dependencies are unavailable, backend auto-falls back to heuristic anti-spoof.

Use `/ops/readiness` to check `deepface_available`.

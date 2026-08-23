# Face Gallery

Drop reference face images in this folder and register them in `metadata.json`.

Example `metadata.json`:

```json
[
  {
    "name": "John Doe",
    "platform": "LinkedIn",
    "profile_url": "https://linkedin.com/in/janedoe",
    "image": "janedoe.jpg"
  },
  {
    "name": "John Doe",
    "platform": "GitHub",
    "profile_url": "https://github.com/janedoe",
    "image": "janedoe_github.jpg"
  }
]
```

Notes:
- Use clear frontal photos where the face is visible.
- Keep one primary face per image for best match quality.
- Supported formats depend on OpenCV image codecs (`jpg`, `jpeg`, `png`, etc.).

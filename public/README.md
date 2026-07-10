# Public Static Assets Directory

This directory is used for static assets that are served at the root URL path (e.g. `/`).

## Demo Juggling Video

To provide the demo juggling video that users can load under **Quick Test**, simply place your MP4 video file in this directory and name it:

`juggling-demo.mp4`

When Vite builds/serves the project:
- Locally, the file will be accessible at `http://localhost:5173/juggling-demo.mp4`.
- On production / GitHub Pages (or other base URL subfolders), Vite handles the path prefixing automatically using `import.meta.env.BASE_URL`.

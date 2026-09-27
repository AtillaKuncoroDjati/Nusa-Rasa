# Video fixtures

`recipe-video.mp4` and `recipe-video.webm` are original synthetic test patterns (160×90, 12 fps, two seconds, no audio), generated with FFmpeg's `testsrc2`. They contain no personal or third-party footage.

The MP4 uses H.264/yuv420p with fast start; the WebM uses VP8. Integration tests upload real media, inspect it, save its path, and verify byte-range playback. FFmpeg is only needed to regenerate these fixtures, not to run Nusa Rasa or its tests.

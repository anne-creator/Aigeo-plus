# Allocation animation

Source: Anne’s `CoFloor-Scan-Drop-Standalone/CoFloor-Scan-Drop-Silent.mp4` supplied on 2026-10-25.

`scan-drop.mp4` is an unmodified copy: H.264, 1920×1080, 30 fps, 12 seconds, no audio. Original visual names, text and captions are preserved at Anne’s request. These frames play as supplied; they are not bound to live assignment data.

SHA-256: `88b98df3ed2f3a7faa9ced9f35daff0f3b2b3087f9e31d248c95c355cdb42441`.

The React allocation screen mounts this video only while a request is pending, with muted inline autoplay and looping. Only a valid board snapshot ends allocation. Media load errors, autoplay rejection, pause, page visibility and reduced-motion preferences fall back to existing static office art. Unmount pauses and releases playback. The package’s editable Three.js player, audio, startup scripts and vendor runtime are not required or imported.

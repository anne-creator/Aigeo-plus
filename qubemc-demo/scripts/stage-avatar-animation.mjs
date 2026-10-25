import { mkdir, copyFile, cp } from 'node:fs/promises';
const source = new URL('../../assets/cofloor-avatar-forge-5s/', import.meta.url);
const destination = new URL('../public/avatar-forge/', import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(new URL('CoFloor-Avatar-Forge-5s-Silent.mp4', source), new URL('success.mp4', destination));
await copyFile(new URL('CoFloor-Avatar-Forge-5s-Silent.webm', source), new URL('success.webm', destination));
// Preserve the standalone interactive preview alongside the integrated success video.
for (const name of ['index.html', 'player.js', 'scene.js', 'style.css', 'soundtrack.m4a', 'assets', 'vendor']) {
  await cp(new URL(name, source), new URL(name, destination), { recursive: true });
}

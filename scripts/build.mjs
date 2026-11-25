import { mkdir, copyFile, cp } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
// Copy only public files. Secrets, functions, dependencies and tests stay out.
for (const name of ['index.html', 'about.html', 'contact.html', 'services.html', 'booking.html', 'sitemap.xml', 'robots.txt', 'car.mp4']) {
  await copyFile(path.join(root, name), path.join(output, name));
}
for (const name of ['assets', 'css', 'js', 'booking']) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true, filter: source => !source.endsWith('.md') });
}
console.log('Public site prepared in dist/.');

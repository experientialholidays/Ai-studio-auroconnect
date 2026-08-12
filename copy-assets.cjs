const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'about.html',
  'contact.html',
  'dashboard.html',
  'event_details.html',
  'privacy.html',
  'submit.html',
  'terms.html',
  'common.js',
  'logo.png',
  'logo.jpg'
];

// Ensure dist/ exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Ensure dist/assets/ exists
if (!fs.existsSync(path.join('dist', 'assets'))) {
  fs.mkdirSync(path.join('dist', 'assets'), { recursive: true });
}

// Copy top level files
filesToCopy.forEach(file => {
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, path.join('dist', file));
    console.log(`Copied ${file} to dist/`);
  }
});

// Copy files from assets/ to dist/assets/
const assetsDir = 'assets';
if (fs.existsSync(assetsDir)) {
  const assetsFiles = fs.readdirSync(assetsDir);
  assetsFiles.forEach(file => {
    const srcPath = path.join(assetsDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, path.join('dist', 'assets', file));
      console.log(`Copied assets/${file} to dist/assets/`);
    }
  });
}

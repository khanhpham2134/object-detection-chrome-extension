import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

async function build() {
  console.log('Building extension with Vite...');
  
  // Run Vite build
  await new Promise((resolve, reject) => {
    exec('npx vite build', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during build: ${error.message}`);
        return reject(error);
      }
      console.log(stdout);
      resolve();
    });
  });
  
  console.log('Copying extension files...');
  
  // Create directories if they don't exist
  await fs.mkdir('dist/yolo11n_web_model', { recursive: true });
  
  // Copy manifest.json
  await fs.copyFile('manifest.json', 'dist/manifest.json');

  await fs.copyFile('service-worker.js', 'dist/service-worker.js');
  
  // Copy HTML files
  await fs.copyFile('detection/detection.html', 'dist/detection.html');
  await fs.copyFile('popup/popup.html', 'dist/popup.html');
  
  // Copy model files
  const modelFiles = await fs.readdir('yolo11n_web_model');
  for (const file of modelFiles) {
    await fs.copyFile(
      path.join('yolo11n_web_model', file), 
      path.join('dist', 'yolo11n_web_model', file)
    );
  }
  
  console.log('Build complete! Extension files are in the dist directory.');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
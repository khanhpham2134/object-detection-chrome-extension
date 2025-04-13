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
  
  console.log('Build complete! Extension files are in the dist directory.');
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
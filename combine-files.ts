import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, relative } from 'path';

const outputFile = 'combined.txt'; // Name of the output file
const srcFolder = 'src'; // Source folder to scan

async function getFilesRecursive(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return getFilesRecursive(fullPath);
      }
      return fullPath;
    })
  );
  return files.flat();
}

async function combineFiles() {
  try {
    const allFiles = await getFilesRecursive(srcFolder);
    const fileContents = await Promise.all(
      allFiles.map(async (file) => {
        const content = await readFile(file, 'utf8');
        const relativePath = relative('.', file);
        return `\n${relativePath}\n${'-'.repeat(relativePath.length)}\n${content}`;
      })
    );
    const finalContent = fileContents.join('\n');
    await writeFile(outputFile, finalContent, 'utf8');
    console.log(`Combined content written to ${outputFile}`);
  } catch (error) {
    console.error('Error combining files:', error);
  }
}

combineFiles();

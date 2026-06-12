const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'node_modules', 'expo-status-bar', 'tsconfig.json'),
];

for (const target of targets) {
  try {
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
      console.log(`[postinstall] Removed ${target}`);
    }
  } catch (error) {
    console.warn(`[postinstall] Could not remove ${target}:`, error.message);
  }
}

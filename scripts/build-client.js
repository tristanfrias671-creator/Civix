// Builds the website into client/build for hosting.
// The upload ZIP already contains a finished client/build (and no client source),
// so on the host this only confirms it. From a full copy of the project it builds.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const client = path.join(__dirname, '..', 'client');
const built = path.join(client, 'build', 'index.html');

if (!fs.existsSync(path.join(client, 'package.json'))) {
  if (!fs.existsSync(built)) {
    console.error('client/build is missing and there is no client source to build it from.');
    process.exit(1);
  }
  console.log('Using the prebuilt website in client/build.');
  process.exit(0);
}

const run = cmd => execSync(cmd, { cwd: client, stdio: 'inherit' });
run('npm install');
run('npm run build');

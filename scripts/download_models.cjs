const fs = require('fs');
const https = require('https');
const path = require('path');

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'face_expression_model-weights_manifest.json',
  'face_expression_model-shard1'
];

const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';
const destDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(destDir)){
    fs.mkdirSync(destDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, function(response) {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', function() {
          file.close(resolve);
        });
      } else {
        file.close();
        fs.unlink(dest, () => reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage}`)));
      }
    }).on('error', function(err) {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  for (const model of models) {
    console.log(`Downloading ${model}...`);
    try {
      await download(`${baseUrl}${model}`, path.join(destDir, model));
      console.log(`Successfully downloaded ${model}`);
    } catch (e) {
      console.error(`Failed to download ${model}: ${e.message}`);
    }
  }
}

main();

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const FONTS = [
  {
    url: 'https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf',
    file: 'Montserrat.ttf'
  }
];

module.exports = async function downloadFonts() {
  for (const font of FONTS) {
    const dest = path.join(__dirname, font.file);
    if (fs.existsSync(dest)) continue;
    console.log('Telechargement police : ' + font.file);
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https.get(font.url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          https.get(res.headers.location, (res2) => {
            res2.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
          }).on('error', reject);
        } else {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }
      }).on('error', reject);
    });
    console.log('Police OK : ' + font.file);
  }
};

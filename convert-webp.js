const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.match(/^img_.*\.png$/i));

(async () => {
  for (const file of files) {
    const src = path.join(dir, file);
    const dest = path.join(dir, file.replace(/\.png$/i, '.webp'));
    await sharp(src).webp({ quality: 85 }).toFile(dest);
    const before = fs.statSync(src).size;
    const after = fs.statSync(dest).size;
    console.log(`${file} → ${file.replace('.png','.webp')}  (${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB, -${Math.round((1-after/before)*100)}%)`);
  }
  console.log(`\n완료: ${files.length}개 변환`);
})();

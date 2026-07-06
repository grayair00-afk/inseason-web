#!/usr/bin/env node
/* update_web.bat이 실행하는 콘텐츠 업데이트 스크립트.
   - content/backgrounds/, content/music/ 폴더를 스캔해서 매니페스트 갱신
   - 원하면 새 영상을 videos.json에 추가 (제목/링크만 필수, 나머지는 Enter로 건너뜀)
   - 끝나면 git add + commit + push까지 자동 실행 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VIDEOS_JSON = path.join(ROOT, 'content', 'videos.json');
const BG_DIR = path.join(ROOT, 'content', 'backgrounds');
const BG_MANIFEST = path.join(BG_DIR, 'manifest.json');
const MUSIC_DIR = path.join(ROOT, 'content', 'music');

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const MUSIC_EXT = ['.mp3', '.wav', '.m4a', '.ogg'];

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/* backgrounds 폴더를 스캔해서 매니페스트에 없는 새 이미지만 추가 (기존 항목은 그대로 보존) */
function syncBackgroundsManifest() {
  if (!fs.existsSync(BG_DIR)) fs.mkdirSync(BG_DIR, { recursive: true });
  const manifest = readJson(BG_MANIFEST, []);
  const existing = new Set(manifest);
  const files = fs.readdirSync(BG_DIR).filter(function (f) {
    return IMAGE_EXT.indexOf(path.extname(f).toLowerCase()) !== -1;
  });
  var added = 0;
  files.forEach(function (f) {
    var rel = 'content/backgrounds/' + f;
    if (!existing.has(rel) && !existing.has(f)) {
      manifest.push(rel);
      added++;
    }
  });
  writeJson(BG_MANIFEST, manifest);
  return added;
}

function listMusicFiles() {
  if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
  return fs.readdirSync(MUSIC_DIR).filter(function (f) {
    return MUSIC_EXT.indexOf(path.extname(f).toLowerCase()) !== -1;
  });
}

function ask(rl, question) {
  return new Promise(function (resolve) { rl.question(question, resolve); });
}

async function main() {
  console.log('=== 웹페이지 콘텐츠 업데이트 ===\n');

  var addedBg = syncBackgroundsManifest();
  console.log('배경 이미지: 새 이미지 ' + addedBg + '개 추가됨');

  var musicFiles = listMusicFiles();
  console.log('음악 파일: 총 ' + musicFiles.length + '개 확인됨\n');

  var rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  var videoAdded = false;

  var addVideo = await ask(rl, '새 영상을 추가하시겠습니까? (y/n): ');
  if (/^y/i.test(addVideo.trim())) {
    var title = (await ask(rl, '제목: ')).trim();
    var subtitle = (await ask(rl, '부제목 (예: Art Director · Jung.K, 없으면 Enter): ')).trim();
    var youtube = (await ask(rl, '유튜브 링크 또는 영상 ID: ')).trim();

    var music = '';
    if (musicFiles.length) {
      console.log('\n사용 가능한 음악 파일:');
      musicFiles.forEach(function (f, i) { console.log('  ' + (i + 1) + '. ' + f); });
      var musicAns = (await ask(rl, '이 영상에 사용할 배경음악 번호 (없으면 Enter): ')).trim();
      var idx = parseInt(musicAns, 10) - 1;
      if (!isNaN(idx) && musicFiles[idx]) music = musicFiles[idx];
    }

    if (!title || !youtube) {
      console.log('\n제목과 유튜브 링크는 필수입니다. 영상 추가를 건너뜁니다.');
    } else {
      var videos = readJson(VIDEOS_JSON, []);
      videos.push({ title: title, subtitle: subtitle, youtube: youtube, thumbnail: '', music: music });
      writeJson(VIDEOS_JSON, videos);
      videoAdded = true;
      console.log('\n"' + title + '" 영상이 추가되었습니다. (갤러리 왼쪽에 새로 쌓입니다)');
    }
  }

  rl.close();

  console.log('\ngit에 반영하는 중...');
  try {
    execSync('git add content/', { cwd: ROOT, stdio: 'inherit' });
    var msg = videoAdded ? 'content: 영상 추가 및 콘텐츠 업데이트' : 'content: 배경/음악 업데이트';
    execSync('git commit -m "' + msg + '"', { cwd: ROOT, stdio: 'inherit' });
    execSync('git push', { cwd: ROOT, stdio: 'inherit' });
    console.log('\n완료! 1~2분 후 웹페이지에 반영됩니다.');
  } catch (e) {
    console.log('\ngit에 새로 반영할 변경사항이 없거나 커밋 중 문제가 발생했습니다.');
  }
}

main();

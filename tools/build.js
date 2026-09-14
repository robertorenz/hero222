// Bundles index.html + css + js into two single-file builds:
//   dist/hero.html      - complete standalone page (open anywhere)
//   dist/artifact.html  - body-only fragment for hosts that supply their own <html>/<head>
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const css = read('css/style.css');
const js = ['js/levels.js', 'js/game.js', 'js/editor.js', 'js/main.js'].map(read).join('\n');
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script src="js\/[^"]+"><\/script>\s*/g, '');

const full = html
  .replace(/<link rel="stylesheet" href="css\/style.css">/, '<style>\n' + css + '\n</style>')
  .replace(/(<script src="js\/[^"]+"><\/script>\s*)+/, '<script>\n' + js + '\n</script>\n');
const fragment = '<title>H.E.R.O. Revamped</title>\n' + fonts + '\n<style>\n' + css + '\n</style>\n' + body + '<script>\n' + js + '\n</script>\n';

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/hero.html'), full);
fs.writeFileSync(path.join(root, 'dist/artifact.html'), fragment);
console.log('dist/hero.html ' + (full.length / 1024).toFixed(1) + ' KB, dist/artifact.html ' + (fragment.length / 1024).toFixed(1) + ' KB');

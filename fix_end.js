const fs = require('fs');
let code = fs.readFileSync('app/ui/primitives.tsx', 'utf8');
if (code.endsWith('}')) {
  code = code.substring(0, code.length - 1) + '});\n';
} else if (code.endsWith('}\n')) {
  code = code.substring(0, code.length - 2) + '});\n';
}
fs.writeFileSync('app/ui/primitives.tsx', code);

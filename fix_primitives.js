const fs = require('fs');
let code = fs.readFileSync('app/ui/primitives.tsx', 'utf8');

// The sed command changed `export function X(` to `export const X = React.memo(function X(`.
// It also changed all `}` at the end of lines to `}`.
// Let's just restore everything back to `export function` to be safe and clean.
code = code.replace(/export const ([A-Za-z0-9_]+) = React\.memo\(function \1/g, 'export function $1');
// And make sure no stray `});` remain at the top level
code = code.replace(/^}\);/gm, '}');

fs.writeFileSync('app/ui/primitives.tsx', code);

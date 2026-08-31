const fs = require('fs');
let code = fs.readFileSync('app/ui/primitives.tsx', 'utf8');

// The StyleSheet.create was missing its );
code = code.replace(/level3: shadows\.level3,\n}/g, 'level3: shadows.level3,\n});');
// Are there other StyleSheet.create missing ); ?
code = code.replace(/    paddingHorizontal: spacing\.xl,\n    alignItems: 'center',\n}/g, "    paddingHorizontal: spacing.xl,\n    alignItems: 'center',\n  },\n});");

fs.writeFileSync('app/ui/primitives.tsx', code);

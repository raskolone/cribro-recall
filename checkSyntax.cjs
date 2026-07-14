const fs = require('fs');
const code = fs.readFileSync('components/admin/AdminPanel.tsx', 'utf-8');
const ts = require('typescript');
const sourceFile = ts.createSourceFile('AdminPanel.tsx', code, ts.ScriptTarget.Latest, true);

function traverse(node) {
  if (node.kind === ts.SyntaxKind.JsxExpression) {
    if (!node.expression && !code.substring(node.pos, node.end).includes('/*')) {
       // empty expression?
    }
  }
  ts.forEachChild(node, traverse);
}
traverse(sourceFile);
console.log('Done');

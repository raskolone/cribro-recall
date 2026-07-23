import { Project, SyntaxKind, JsxText, JsxAttribute, StringLiteral } from 'ts-morph';
import * as fs from 'fs';

const project = new Project();
project.addSourceFilesAtPaths(["components/**/*.tsx", "App.tsx", "LandingPage.tsx"]);

const dict = new Set<string>();

const files = project.getSourceFiles();

files.forEach(file => {
    let modified = false;

    // Process JSX Text
    const jsxTexts = file.getDescendantsOfKind(SyntaxKind.JsxText);
    jsxTexts.forEach(jsxText => {
        const text = jsxText.getLiteralText();
        if (text.trim().length > 0 && /[a-zA-Z\u0104\u0105\u0106\u0107\u0118\u0119\u0141\u0142\u0143\u0144\u015A\u015B\u0179\u017A\u017B\u017C]/.test(text)) {
            const trimmed = text.trim();
            // skip single characters or numbers
            if (trimmed.length > 1) {
                const leadingSpace = text.substring(0, text.indexOf(trimmed));
                const trailingSpace = text.substring(text.indexOf(trimmed) + trimmed.length);
                
                const safeKey = trimmed.replace(/"/g, '\\"').replace(/\n/g, ' ');
                dict.add(trimmed);
                
                jsxText.replaceWithText(`${leadingSpace}{i18n.t("${safeKey}")}${trailingSpace}`);
                modified = true;
            }
        }
    });

    // Process JSX Attributes
    const jsxAttributes = file.getDescendantsOfKind(SyntaxKind.JsxAttribute);
    jsxAttributes.forEach(attr => {
        const name = attr.getNameNode().getText();
        if (['placeholder', 'title', 'label', 'alt', 'description'].includes(name)) {
            const init = attr.getInitializer();
            if (init && init.getKind() === SyntaxKind.StringLiteral) {
                const text = (init as StringLiteral).getLiteralValue();
                if (text.trim().length > 0) {
                    const safeKey = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
                    dict.add(text);
                    attr.setInitializer(`{i18n.t("${safeKey}")}`);
                    modified = true;
                }
            }
        }
    });

    if (modified) {
        file.addImportDeclaration({
            defaultImport: 'i18n',
            moduleSpecifier: 'i18next'
        });
    }
});

project.saveSync();

fs.writeFileSync('dictionary.json', JSON.stringify(Array.from(dict), null, 2));
console.log(`Extracted ${dict.size} unique strings.`);

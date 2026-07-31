require('@babel/register')({
  presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
  extensions: ['.js', '.jsx', '.ts', '.tsx']
});
const React = require('react');
const ReactDOMServer = require('react-dom/server');

// Mock out some stuff
global.window = { _initialStudyMode: undefined, location: { search: '' } };
global.document = { getElementById: () => null };
global.localStorage = { getItem: () => null, setItem: () => {} };

try {
  const App = require('./components/dashboard/Dashboard').default;
  const html = ReactDOMServer.renderToString(React.createElement(App));
  console.log("Rendered successfully");
} catch (e) {
  console.error("RENDER ERROR:", e);
}

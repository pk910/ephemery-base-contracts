
const { compile } = require('nexe');
var path = require('path');
var fs = require('fs');
const nexeUpxPlugin = require('./utils/nexe-upx-plugin');

(function() {

  var distPath = path.join(__dirname, "dist");
  if (!fs.existsSync(distPath))
    fs.mkdirSync(distPath);

  var buildPath = path.join(__dirname, "build");
  if (!fs.existsSync(buildPath))
    fs.mkdirSync(buildPath);
  
  var binPath = path.join(__dirname, "..", "bin");
  if (!fs.existsSync(binPath))
    fs.mkdirSync(binPath);

  let cliBuildList = [
    {
      arch: 'linux-x64',
      output: 'deployer',
      target: 'linux-x64-14.15.3'
    },
    {
      arch: 'linux-x86',
      output: 'deployer-x86',
      target: 'linux-x86-14.15.3'
    },
    {
      arch: 'win32-x64',
      output: 'deployer.exe',
      target: 'windows-x64-14.15.3'
    },
    {
      arch: 'win32-x86',
      output: 'deployer32.exe',
      target: 'windows-x86-14.15.3'
    },
  ];

  let jsbundle = fs.readFileSync(path.join(distPath, 'deployer.js'), "utf-8");
  jsbundle = [
    // prepend a Buffer polyfill to get rid of this damn `new Buffer()` DeprecationWarning (coming from somewhere deep within the node_modules...)
    '(function() {',
      'var Buffer = global.Buffer;',
      'global.Buffer = function() {',
        'if(typeof arguments[0] == "string")',
          'return Buffer.from(arguments[0]);',
        'else if(typeof arguments[0] == "number")',
          'return Buffer.alloc(arguments[0]);',
        'return new Buffer(arguments[0]);',
      '};',
      'Object.setPrototypeOf(global.Buffer, Buffer);',
    '})();',
    jsbundle,
  ].join("");
  jsbundle = jsbundle.replace(/node:crypto/g, "crypto"); // ugly fix to replace `node:crypto` imports by `crypto` 
  fs.writeFileSync(path.join(distPath, 'deployer.compat.js'), jsbundle);

  console.log("Building executables to '" + binPath + "'");
  Promise.all(cliBuildList.map((cliBuild) => {
    console.log("Building target: " + cliBuild.target);
    return compile({
      input: path.join(distPath, 'deployer.compat.js'),
      output: path.join(binPath, cliBuild.output),
      target: cliBuild.target,
      temp: buildPath,
      silent: true,
      resources: [ path.join(distPath, 'deployer.js') ],
      plugins: [ nexeUpxPlugin(true) ]
    });
  })).then(function() {
    console.log("All builds finished.");
  });

})();

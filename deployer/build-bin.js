
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
  
  var binPath = path.join(__dirname, "bin");
  if (!fs.existsSync(binPath))
    fs.mkdirSync(binPath);

  let cliBuildList = [
    {
      arch: 'linux-x64',
      output: 'deployer',
      //target: 'linux-x64-14.15.3'
      target: 'linux-x64-18.16.0'
    },
    /*
    {
      arch: 'linux-x86',
      output: 'deployer-x86',
      //target: 'linux-x86-14.15.3'
      target: 'linux-x86-18.16.0'
    },
    */
    {
      arch: 'win32-x64',
      output: 'deployer.exe',
      //target: 'windows-x64-14.15.3'
      target: 'windows-x64-18.16.0'
    },
    /*
    {
      arch: 'win32-x86',
      output: 'deployer32.exe',
      //target: 'windows-x86-14.15.3'
      target: 'windows-x86-18.16.0'
    },
    */
  ];

  console.log("Building executables to '" + binPath + "'");
  Promise.all(cliBuildList.map((cliBuild) => {
    console.log("Building target: " + cliBuild.target);
    return compile({
      input: path.join(distPath, 'deployer.js'),
      output: path.join(binPath, cliBuild.output),
      build: true,
      target: cliBuild.target,
      temp: buildPath,
      silent: true,
      resources: [ path.join(distPath, 'deployer.js') ],
      //plugins: [ nexeUpxPlugin(true) ]
    });
  })).then(function() {
    console.log("All builds finished.");
  });

})();

#!/usr/bin/env node

var stl = require('../stl');
var through = require('through');
var fs = require('fs');
var path = require('path');

var parser = stl.createParseStream();
parser.pipe(through(function(obj) {
  process.stdout.write(JSON.stringify(obj, null, '  ') + '\n');
}));

if (process.argv.length < 3) {
  var stdin = false;
  var parser =
  process.stdin.once('data', function() {
    stdin = true;
  });

  process.stdin.pipe(parser);

  process.stdin.once('end', function() {
    if (!stdin) {
      usage();
    }
  })
} else {
  fs.createReadStream(path.resolve(process.cwd(), process.argv[2]))
    .pipe(parser)
}

function usage() {
  console.log('usage: `stl file.stl` or `cat file.stl | stl`');
}

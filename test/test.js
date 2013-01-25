var stl = require('../stl');
var assert = require('assert');
var fs = require('fs');

function d(array) {
  console.log(JSON.stringify(array, null, '  '));
}

function compareAscii(a, b) {
  var regex = /([0-9]*[\.0-9]*E[\-\+]+[0-9]+)/gi;

  var am = a.match(regex);
  var bm = b.match(regex);

  assert.equal(am.length, bm.length);
  for (var i=0; i<am.length; i++) {
    assert.ok(parseFloat(am[i]) === parseFloat(bm[i]));
  }
}

var binarySTL = fs.readFileSync(__dirname + '/binary/ship.stl');
var basicAsciiSTL = fs.readFileSync(__dirname + '/ascii/tri.stl').toString();
var asciiSTL = fs.readFileSync(__dirname + '/ascii/teapot.stl').toString();

// ASCII
var array = stl.toArray(asciiSTL);
var string = stl.fromArray(array);
compareAscii(string, asciiSTL);

// BINARY
// var binary = stl.fromArray(stl.toArray(binarySTL), true);
// assert.deepEqual(binary, binarySTL);
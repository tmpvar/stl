var stl = require('../stl');
var assert = require('assert');
var fs = require('fs');

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
var array = stl.toObject(asciiSTL);
var basicarray = stl.toObject(basicAsciiSTL);

var string = stl.fromObject(array);
compareAscii(string, asciiSTL);

// BINARY
var binaryArray = stl.toObject(binarySTL);
var binary = stl.fromObject(binaryArray, true);
var syncSharkResult = stl.toObject(fs.readFileSync(__dirname + '/binary/shark.stl'));

assert.ok(binarySTL.length === binary.length);
assert.deepEqual(binary, binarySTL);

// Convert from binary to ascii back to binary
var out = stl.fromObject(
  stl.toObject(
    stl.fromObject(
      stl.toObject(
        binarySTL
      )
    )
  )
  // binary
, true);

var cubeResult = { description : null, facets: [] }
fs.createReadStream(__dirname + '/binary/cube-20mm-with-hole.stl')
  .pipe(stl.createParseStream())
  .on('data', function(obj) {
    if (obj.description) {
      cubeResult.description = obj.description;
    } else {
      cubeResult.facets.push(obj);
    }

  }).on('end', function() {
    assert.equal(cubeResult.description.trim(), 'solid cube-20-5mm-wall    facet');
    assert.equal(cubeResult.facets.length, 32);
  });


var binaryResult = { facets : [] };
fs.createReadStream(__dirname + '/binary/ship.stl')
  .pipe(stl.createParseStream())
  .on('data', function(obj) {
    if (obj.description) {
      binaryResult.description = obj.description;
    } else {
      binaryResult.facets.push(obj);
    }

  }).on('end', function() {
    assert.deepEqual(binaryResult.verts, binaryArray.verts);
  });


var asciiResult = { description: null, facets : [] };
fs.createReadStream(__dirname + '/ascii/tri.stl')
  .pipe(stl.createParseStream())
  .on('data', function(obj) {
    if (obj.description) {
      asciiResult.description = obj.description;
    } else {
      asciiResult.facets.push(obj);
    }

  }).on('end', function() {
    assert.deepEqual(asciiResult, basicarray);
  });


var sharkResult = { description : null, facets: [] }
fs.createReadStream(__dirname + '/binary/shark.stl')
  .pipe(stl.createParseStream())
  .on('data', function(obj) {
    if (obj.description) {
      sharkResult.description = obj.description;
    } else {
      sharkResult.facets.push(obj);
    }

  }).on('end', function() {
    assert.deepEqual(sharkResult, syncSharkResult);
  });


assert.deepEqual(binary, binarySTL)

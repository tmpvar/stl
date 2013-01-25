# STL

Stereo Lithography file format parser

## Install

`npm install stl`

## Use

Convert binary stl to ascii stl

```javascript

var stl = require('stl')
var fs = require('fs');

var facets = stl.toArray(fs.readFileSync('/path/to/binary.stl'));
fs.writeFileSync('/path/to/ascii.stl', stl.fromArray(facets));

```


Convert ascii stl to binary stl

```javascript

var stl = require('stl')
var fs = require('fs');

var facets = stl.toArray(fs.readFileSync('/path/to/ascii.stl').toString());
fs.writeFileSync('/path/to/binary.stl', stl.fromArray(facets, true));

```

## array structure

`toArray` and `fromArray` use the following array structure

```javascript

[
  {
    normal: [x, y, z],
    verts: [
      [x, y, z],
      [x, y, z],
      [x, y, z]
    ]
  }
  // repeats ...
]

```

# License

MIT
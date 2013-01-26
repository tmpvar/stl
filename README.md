# STL

Stereo Lithography file format parser

## Install

`npm install stl`

## Use

Convert binary stl to ascii stl

```javascript

var stl = require('stl')
var fs = require('fs');

var facets = stl.toObject(fs.readFileSync('/path/to/binary.stl'));
fs.writeFileSync('/path/to/ascii.stl', stl.fromObject(facets));

```


Convert ascii stl to binary stl

```javascript

var stl = require('stl')
var fs = require('fs');

var facets = stl.toObject(fs.readFileSync('/path/to/ascii.stl').toString());
fs.writeFileSync('/path/to/binary.stl', stl.fromObject(facets, true));

```

## Object Structure

`toObject` and `fromObject` use the following array structure

```javascript
{
  description: "abc 123", // (optional)
  facets: [
    {
      normal: [x, y, z],
      verts: [
        [x, y, z],
        [x, y, z],
        [x, y, z]
      ]
      // attributeByteCount (optional uint16)
    }
    // repeats ...
  ]
}
```

# License

MIT

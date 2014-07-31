var fsm = require('stream-fsm');
var split = require('split');
var Transform = require('stream').Transform;
var normalize = require('triangle-normal');

function trim(a) {
  var nullTerm = a.indexOf('\u0000');
  if (nullTerm > -1) {
    a = a.substr(0, nullTerm-1);
  }
  return a.trim();
};

function computeNormal(facet) {
  var v = facet.verts;
  return normalize(
    v[0][0], v[0][1], v[0][2],
    v[1][0], v[1][1], v[1][2],
    v[2][0], v[2][1], v[2][2]
  );
}

module.exports = {

  // `stl` may be binary or ascii
  toObject : function(stl) {

    var ret = {};

    var facets = [];
    var binary = false;
    var count = 0;
    if (stl.readUInt32LE) {
      count = stl.readUInt32LE(80);
      binary = (84 + count*12*4 + count*2) === stl.length;
    }

    if (!binary) {
      var stlString = stl.toString();
      if (stlString.indexOf && stlString.indexOf('solid') > -1) {
        stlString = stlString.replace(/\t/g, ' ');

        var lines = stlString.split('\n');
        var facet, loop;

        lines.forEach(function(line) {
          line = line.trim();

          if (line.indexOf('solid') > -1 && line.indexOf('endsolid') < 0) {
            ret.description = trim(line.replace(/ *solid */,''));
          } else {
            line = line.replace(/  /g, ' ');
          }


          if (line.indexOf('endfacet') > -1) {
            if (!facet.normal) {
              var v = facet.verts
              facet.normal = computeNormal(facet)
            }
            facets.push(facet);
          } else if (line.indexOf('facet') > -1) {
            facet = {
              normal : null,
              verts : [],
              attributeByteCount : 0
            };
          }

          if (facet) {
            if (line.indexOf('normal') > -1) {
              var nparts = line.split(' ');
              facet.normal = [
                parseFloat(nparts[2]),
                parseFloat(nparts[3]),
                parseFloat(nparts[4]),
              ];
            }

            if (line.indexOf('vertex') > -1) {
              var vparts = line.split(' ');
              var vert = [
                parseFloat(vparts[1]),
                parseFloat(vparts[2]),
                parseFloat(vparts[3])
              ];
              facet.verts.push(vert);
            }
          }
        });
      }
    // Binary mode
    } else {
      ret.description = trim(stl.toString('ascii', 0, 80));

      var offset = 84;

      var float = function() {
        var ret = stl.readFloatLE(offset);
        offset+=4;
        return ret;
      }

      for (var i=0; i<count; i++) {
        facets.push({
          normal: [float(), float(), float()],
          verts: [
            [float(), float(), float()],
            [float(), float(), float()],
            [float(), float(), float()]
          ],
          attributeByteCount : stl.readUInt16LE(offset)
        });

        offset+=2; // Clear off the attribute byte count
      }
    }

    ret.facets = facets;
    return ret;
  },

  // Convert the incoming object into the stl
  // file format. Passing a truthy value for
  // binary causes a binary stl to be created.
  fromObject: function(obj, binary) {

    if (!binary) {
      var str = [
        'solid ' + obj.description.trim()
      ];

      obj.facets.forEach(function(facet) {
        if (facet.normal) {
          var exponential = []
          facet.normal.forEach(function(a) {
            exponential.push(a.toExponential());
          });

          str.push('  facet normal ' + exponential.join(' '));
        } else {
          str.push('  facet');
        }

        str.push('    outer loop')
        facet.verts.forEach(function(vert) {
          var exponential = []
          vert.forEach(function(a) {
            exponential.push(a.toExponential());
          });
          str.push('      vertex ' + exponential.join(' '))
        });

        str.push('    endloop');
        str.push('  endfacet');
      });

      str.push('endsolid');
      return str.join('\n');
    } else {

      var count = obj.facets.length;

      var ret = new Buffer(84 +  count*12*4 + count*2);
      ret.fill(0, 0, 80);
      ret.write(obj.description || '');
      ret.writeUInt32LE(count, 80);

      var offset = 84;

      var write = function(val) {
        ret.writeFloatLE(val, offset);
        offset+=4;
      };

      obj.facets.forEach(function(facet) {
        if (!facet.normal) {
          facet.normal = computeNormal(facet);
        }

        facet.normal.forEach(write);

        facet.verts.forEach(function(vert) {
          vert.forEach(write);
        });

        ret.writeUInt16LE(facet.attributeByteCount || 0, offset);
        offset+=2;
      });
      return ret;
    }
  },

  createParseStream : function() {
    var binaryMode = false;
    var facetCount = 0;
    var facets = [];
    var description = null;
    var currentFacet;
    var asciiValid = false;
    var ended = false;
    var splitter = null;

    var stream = fsm({
      init : fsm.want(84, function readBinaryHeader(data) {
        var dataString = data.toString();

        if (dataString.toLowerCase().indexOf('solid') > -1) {
          facetCount = data.readUInt32LE(80);
          this.change('ascii');
        } else {
          this.change('binary');
        }

        return 0;
      }),

      binary : fsm.want(80, function(data) {
        description = data.toString();
        var nullTerm = description.indexOf('\u0000');
        if (nullTerm > -1) {
          description = description.substr(0, nullTerm-1);
        }

        description = description.trim();

        this.change('count');
      }),

      count : fsm.want(4, function(data) {
        facetCount = data.readUInt32LE(0);
        this.queue({
          description : description,
          facetCount: facetCount
        });

        this.change('normal');
      }),

      normal : fsm.want(12, function(data) {
        currentFacet = {
          normal : [
            data.readFloatLE(0),
            data.readFloatLE(4),
            data.readFloatLE(8)
          ],
          verts : []
        };

        this.change('verts');
      }),

      verts : fsm.want(36, function(data) {

        for (var i=0; i<36; i+=12) {
          currentFacet.verts.push([
            data.readFloatLE(i),
            data.readFloatLE(i+4),
            data.readFloatLE(i+8)
          ]);
        }

        this.change('attributeBytes');
      }),

      attributeBytes : fsm.want(2, function(data) {
        currentFacet.attributeByteCount = data.readUInt16LE(0);
        this.queue(currentFacet);

        currentFacet = null;
        facetCount--;

        if (facetCount <= 0) {
          this.done();
        } else {
          this.change('normal');
        }

      }),

      ascii : function(pending) {
        if (!splitter) {
          splitter = split();

          stream.on('end', function() {
            splitter.end();
          });

          var inFacet = false;
          var facet;
          var that = this;
          splitter.on('data', function(data) {
            if (!data.trim().length) {
              return;
            }

            if (data.indexOf('solid') > -1) {
              stream.queue({
                description : data.trim().split(' ').slice(1).join(' ')
              });

            } else if (data.indexOf('endfacet') > -1) {
              inFacet = false;
              stream.queue(facet);
              facet = null
            } else if (data.indexOf('facet') > -1) {
              // This is not fool proof, but far better than
              // "OH LOOK I NAMED MY STL 'solid'" *sigh*

              asciiValid = true;
              var normal = data.replace(/ +/g, ' ').trim().split(' ').slice(2).map(parseFloat);

              facet = {
                normal : normal,
                verts : [],
                attributeByteCount: 0
              };

            } else if (data.indexOf('vertex') > -1) {
              var coords = data.replace(/ +/g, ' ').trim().split(' ').slice(1).map(parseFloat);
              facet.verts.push(coords);
            } else if (!asciiValid) {
              that.mode('binary');
            }
          });

          stream.originalWrite = stream.write;
        }

        splitter.write(pending);
        ended && stream.end();

        // Returning false here buffers the data.
        // If we are not "sure" this is an ascii stl file then
        // we need to continue buffering

        return (asciiValid) ? pending.length : false;
      }

    }, function() {
    });

    stream.originalEnd = stream.end;
    stream.end = function(d) {

      var mode = stream.fsm.mode();
      var cache = stream.fsm.cache();
      if (mode === 'ascii' && !asciiValid && cache) {
        // this is a binary file that has the description: "solid ..."
        // send the complete file through binary mode
        stream.fsm.change('binary');

        // trigger a write since we have the entire file buffered in memory
        stream.fsm();

        stream.originalEnd();
      } else {
        ended = true;
        stream.originalEnd();
      }
    };

    return stream;
  }
};

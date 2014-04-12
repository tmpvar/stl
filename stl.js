var fsm = require('stream-fsm');
var split = require('split');
var Transform = require('stream').Transform;

module.exports = {

  // `stl` may be binary or ascii
  toObject : function(stl) {
    var ret = {
      description: ''
    };

    var facets = [];

    // ASCII mode
    if (stl.indexOf && stl.indexOf('solid') > -1) {
      stl = stl.replace(/\t/g, ' ').replace(/  /g, ' ');

      var lines = stl.split('\n');
      var facet, loop;

      lines.forEach(function(line) {
        line = line.replace(/ *$/,'');

        if (line.indexOf('solid') > -1 && line.indexOf('endsolid') < 0) {
          ret.description = line.replace(/ *solid */,'');
        }

        if (line.indexOf('endfacet') > -1) {
          facets.push(facet);
        } else if (line.indexOf('facet') > -1) {
          facet = {
            normal : [],
            verts : []
          };
        }

        if (line.indexOf('normal') > -1) {
          var parts = line.split(' ');
          facet.normal.unshift(parseFloat(parts.pop()));
          facet.normal.unshift(parseFloat(parts.pop()));
          facet.normal.unshift(parseFloat(parts.pop()));
        }

        if (line.indexOf('vertex') > -1) {
          var parts = line.split(' ');
          var vert = [];
          vert.unshift(parseFloat(parts.pop()));
          vert.unshift(parseFloat(parts.pop()));
          vert.unshift(parseFloat(parts.pop()));
          facet.verts.push(vert);
        }
      });
    // Binary mode
    } else {
      var facets = [];
      var count = stl.readUInt32LE(80);
      ret.description = stl.slice(0, 80).toString();
      var nullTerm = ret.description.indexOf('\u0000');
      if (nullTerm > -1) {
        ret.description = ret.description.substr(0, nullTerm-1);
      }

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
        'solid'
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
        var splitter = split();

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
              verts : []
            };

          } else if (data.indexOf('vertex') > -1) {
            var coords = data.replace(/ +/g, ' ').trim().split(' ').slice(1).map(parseFloat);
            facet.verts.push(coords);
          } else if (!asciiValid) {
            that.mode('binary');
          }
        });

        stream.originalWrite = stream.write;

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

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
          ]
        });
        facets[i].attributeByteCount = stl.readUInt16LE(offset);
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
  }
};
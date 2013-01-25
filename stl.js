module.exports = {

  // `stl` may be binary or ascii
  toArray : function(stl) {

    // ASCII mode
    if (stl.indexOf && stl.indexOf('solid') > -1) {
      stl = stl.replace(/\t/g, ' ').replace(/  /g, ' ');

      var lines = stl.split('\n');
      var facets = [];
      var facet, loop;

      lines.forEach(function(line) {
        line = line.replace(/ *$/,'');

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
      return facets;

    // Binary mode
    } else {

    }
  },

  // Convert the incoming array into the stl
  // file format. Passing a truthy value for
  // binary causes a binary stl to be created.
  fromArray: function(facets, binary) {
    if (!binary) {
      var str = [
        'solid'
      ];

      facets.forEach(function(facet) {
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
    }
  }
};
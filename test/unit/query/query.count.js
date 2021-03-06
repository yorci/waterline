var assert = require('assert');
var Waterline = require('../../../lib/waterline');

describe('Collection Query ::', function() {
  describe('.count()', function() {
    var query;

    before(function(done) {
      var waterline = new Waterline();
      var Model = Waterline.Model.extend({
        identity: 'user',
        connection: 'foo',
        primaryKey: 'id',
        attributes: {
          id: {
            type: 'number'
          },
          name: {
            type: 'string'
          }
        }
      });

      waterline.registerModel(Model);

      // Fixture Adapter Def
      var adapterDef = { count: function(con, query, cb) { return cb(null, 1); }};

      var connections = {
        'foo': {
          adapter: 'foobar'
        }
      };

      waterline.initialize({ adapters: { foobar: adapterDef }, datastores: connections }, function(err, orm) {
        if(err) {
          return done(err);
        }
        query = orm.collections.user;
        return done();
      });
    });

    it('should return a count', function(done) {
      query.count({ name: 'foo'}, {}, function(err, count) {
        if(err) {
          return done(err);
        }

        assert(count > 0);
        done();
      });
    });

    it('should allow a query to be built using deferreds', function(done) {
      query.count()
      .exec(function(err, result) {
        if(err) {
          return done(err);
        }

        assert(result);
        done();
      });
    });
  });
});
